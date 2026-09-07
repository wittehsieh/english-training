import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MockAIConversationService } from './MockAIConversationService';
import { makeContext } from '../test/helpers';

const ai = new MockAIConversationService();

test('1. natural, correct response -> no language gap', async () => {
  const res = await ai.evaluateTurn(
    makeContext(
      'project-01',
      "It's going pretty well. I'm still working on the animation.",
    ),
  );
  assert.equal(res.analysis.gap, null);
  assert.equal(res.learning.shouldShow, false);
  assert.equal(res.analysis.meaningCommunicated, true);
});

test('2. "I am waiting the UX feedback" -> wait for + noun gap', async () => {
  const res = await ai.evaluateTurn(
    makeContext('project-01', 'I am waiting the UX feedback before I continue.'),
  );
  assert.ok(res.analysis.gap, 'expected a gap');
  assert.equal(res.analysis.gap?.concept, 'wait for + thing/person');
  assert.equal(res.analysis.gap?.gapType, 'sentence_pattern');
  assert.match(res.analysis.gap?.betterExpression ?? '', /waiting for the UX feedback/i);
  assert.equal(res.learning.shouldShow, true);
});

test('3. "complete it until Friday" -> by + deadline gap', async () => {
  const res = await ai.evaluateTurn(
    makeContext('project-01', 'I think I can complete it until Friday.'),
  );
  assert.ok(res.analysis.gap);
  assert.equal(res.analysis.gap?.concept, 'by + deadline (not "until")');
  assert.match(res.analysis.gap?.betterExpression ?? '', /\bby Friday\b/i);
});

test('4. "explain me this" -> explain + thing + to + person gap', async () => {
  const res = await ai.evaluateTurn(
    makeContext('project-03', 'Can you explain me this requirement?'),
  );
  assert.ok(res.analysis.gap);
  assert.equal(res.analysis.gap?.concept, 'explain + thing + to + person');
  assert.equal(res.analysis.gap?.gapType, 'sentence_pattern');
});

test('5. correct use of a pattern -> mastery evidence (patternsUsedNaturally)', async () => {
  const res = await ai.evaluateTurn(
    makeContext(
      'project-01',
      "The main part is done. I'm still working on the tests and I should have it done by Friday.",
    ),
  );
  assert.equal(res.analysis.gap, null);
  assert.ok(
    res.analysis.patternsUsedNaturally.includes('by-deadline'),
    `expected by-deadline in ${JSON.stringify(res.analysis.patternsUsedNaturally)}`,
  );
});

test('6. comfortable concept -> not re-taught', async () => {
  const ctx = makeContext('project-01', 'I am waiting the UX feedback.', {
    comfortableConcepts: ['wait-for-thing-person'],
  });
  const res = await ai.evaluateTurn(ctx);
  assert.equal(res.analysis.gap, null, 'gap should be suppressed');
  assert.equal(res.learning.shouldShow, false);
});

test('7. too-short reply -> meaning not communicated, no gap spam', async () => {
  const res = await ai.evaluateTurn(makeContext('project-01', 'ok'));
  assert.equal(res.analysis.meaningCommunicated, false);
  assert.equal(res.evaluation.overall, 'poor');
  assert.equal(res.analysis.gap, null);
});

test('8. objective progression: a solid answer advances an objective', async () => {
  const res = await ai.evaluateTurn(
    makeContext('project-01', "The UI is mostly done, I'm working on the animation."),
  );
  const progressed = Object.values(res.objectiveProgress).some(Boolean);
  assert.equal(progressed, true);
});

test('9. lesson completion needs required objectives AND minimum turns', async () => {
  const lessonId = 'project-04'; // 3 required objectives, minTurns 3
  // 2 objectives already done, this is only turn 2 -> not complete yet
  const early = await ai.evaluateTurn(
    makeContext(lessonId, 'The root cause was a race condition in the queue.', {
      completedObjectiveIds: ['identify_blocker', 'explain_cause'],
      playerTurnNumber: 2,
    }),
  );
  assert.equal(early.lessonComplete, false);

  // all 3 done and turn 4 -> complete
  const done = await ai.evaluateTurn(
    makeContext(lessonId, 'It delayed the release, so I need another day to fix it.', {
      completedObjectiveIds: ['identify_blocker', 'explain_cause', 'explain_impact'],
      playerTurnNumber: 4,
    }),
  );
  assert.equal(done.lessonComplete, true);
  assert.ok(done.xpEarned >= 35, 'completion should add lesson xp');
});

test('does not complete just because a target expression was used', async () => {
  const res = await ai.evaluateTurn(
    makeContext('project-04', "I'm blocked by the flaky test suite.", {
      completedObjectiveIds: [],
      playerTurnNumber: 1,
    }),
  );
  assert.equal(res.lessonComplete, false);
});
