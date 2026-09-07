import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  fallbackModelTurn,
  normalizeModelTurn,
  parseModelTurn,
  type ModelTurn,
} from './openaiSchema';
import { scoreTurn } from './turnScoring';
import { makeContext } from '../test/helpers';

const validTurn: ModelTurn = {
  characterResponse: { text: 'Got it. Anything blocking you?', emotion: 'talking' },
  analysis: {
    understoodIntent: 'say the implementation is nearly done',
    meaningCommunicated: true,
    grammarOk: true,
    natural: true,
    contextAppropriate: true,
    gap: null,
    patternsUsedNaturally: ['working-on'],
  },
  demonstratedObjectiveIds: ['describe_progress'],
};

test('10a. valid structured output passes validation', () => {
  const res = parseModelTurn(validTurn);
  assert.equal(res.ok, true);
  assert.ok(res.data);
});

test('10b. invalid structured output is rejected (not thrown)', () => {
  const bad = {
    characterResponse: { text: '', emotion: 'grumpy' },
    analysis: { meaningCommunicated: 'yes' },
  };
  const res = parseModelTurn(bad);
  assert.equal(res.ok, false);
  assert.ok(res.error && res.error.length > 0);
});

test('10c. null / garbage is rejected', () => {
  assert.equal(parseModelTurn(null).ok, false);
  assert.equal(parseModelTurn('not json').ok, false);
  assert.equal(parseModelTurn(42).ok, false);
});

test('10d. fallback turn is itself valid and harmless', () => {
  const ctx = makeContext('project-01', 'whatever');
  const fb = fallbackModelTurn(ctx);
  assert.equal(parseModelTurn(fb).ok, true);

  const { analysis, demonstratedObjectiveIds } = normalizeModelTurn(fb);
  const scored = scoreTurn(ctx, analysis, { demonstratedObjectiveIds, degraded: true });
  assert.equal(scored.gap, null);
  assert.equal(scored.xpEarned, 0);
  assert.equal(scored.lessonComplete, false);
  assert.deepEqual(
    Object.values(scored.objectiveProgress).filter(Boolean),
    [],
    'fallback advances no objectives',
  );
});

test('normalizeModelTurn maps gap.type -> gapType and clamps confidence', () => {
  const withGap: ModelTurn = {
    ...validTurn,
    analysis: {
      ...validTurn.analysis,
      gap: {
        type: 'sentence_pattern',
        concept: 'wait for + thing/person',
        userIntent: 'explain the blocker',
        userAttempt: 'I am waiting the feedback',
        betterExpression: "I'm waiting for the feedback",
        explanation: 'wait for + noun',
        priority: 'useful',
        confidence: 2,
        patternId: 'wait-for',
      },
    },
  };
  const { analysis } = normalizeModelTurn(withGap);
  assert.equal(analysis.gap?.gapType, 'sentence_pattern');
  assert.equal(analysis.gap?.confidence, 1);
  assert.equal(analysis.gap?.patternId, 'wait-for');
});

test('scoreTurn keeps completion server-authoritative for OpenAI output', () => {
  // Model claims every objective done, but only turn 1 -> not complete.
  const ctx = makeContext('project-04', 'It broke prod and I need a day.', {
    playerTurnNumber: 1,
  });
  const { analysis } = normalizeModelTurn(validTurn);
  const scored = scoreTurn(ctx, analysis, {
    demonstratedObjectiveIds: ['identify_blocker', 'explain_cause', 'explain_impact'],
  });
  assert.equal(scored.lessonComplete, false);
});

test('scoreTurn drops a gap for a comfortable concept (OpenAI path)', () => {
  const ctx = makeContext('project-01', 'I am waiting the feedback', {
    comfortableConcepts: ['wait-for-thing-person'],
  });
  const withGap: ModelTurn = {
    ...validTurn,
    analysis: {
      ...validTurn.analysis,
      gap: {
        type: 'sentence_pattern',
        concept: 'wait for + thing/person',
        userIntent: 'x',
        userAttempt: 'I am waiting the feedback',
        betterExpression: "I'm waiting for the feedback",
        explanation: 'y',
        priority: 'useful',
        confidence: 0.9,
        patternId: 'wait-for',
      },
    },
  };
  const { analysis } = normalizeModelTurn(withGap);
  const scored = scoreTurn(ctx, analysis);
  assert.equal(scored.gap, null);
});
