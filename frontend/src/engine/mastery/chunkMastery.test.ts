import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeScore,
  deriveStage,
  isComfortable,
  outcomeFor,
  recordEncounter,
  recordRetrieval,
  recordSpontaneousUse,
  retrievalStrength,
} from './chunkMastery';
import { emptyMastery, type RetrievalEvidence } from '../../types/mastery';

const NOW = new Date('2026-01-01T09:00:00.000Z');
const ev = (over: Partial<RetrievalEvidence> = {}): RetrievalEvidence => ({
  at: NOW.toISOString(),
  stage: 'independent',
  hintLevel: 'none',
  outcome: 'success',
  ...over,
});

test('seeing a chunk is not mastery', () => {
  const m = recordEncounter(undefined, 'not-sure-how-to', NOW);
  assert.equal(m.currentStage, 'familiar');
  assert.equal(m.score, 0);
  assert.equal(m.independentSuccess, 0);
  assert.ok(m.nextReviewAt, 'encounter starts the review clock');
});

test('stages climb only with the matching kind of evidence', () => {
  let m = recordRetrieval(undefined, 'c', ev({ stage: 'prompted', hintLevel: 'partial' }), NOW);
  assert.equal(m.currentStage, 'prompted');

  m = recordRetrieval(m, 'c', ev({ stage: 'supported' }), NOW);
  assert.equal(m.currentStage, 'supported');

  m = recordRetrieval(m, 'c', ev({ stage: 'independent', contextKey: 'a' }), NOW);
  assert.equal(m.currentStage, 'independent');

  // a second, DIFFERENT context is what proves transfer
  m = recordRetrieval(m, 'c', ev({ stage: 'independent', contextKey: 'b' }), NOW);
  assert.equal(m.currentStage, 'flexible');
  assert.equal(m.variationSuccess, 1);
});

test('repeating in the same context does not count as variation', () => {
  let m = recordRetrieval(undefined, 'c', ev({ contextKey: 'same' }), NOW);
  m = recordRetrieval(m, 'c', ev({ contextKey: 'same' }), NOW);
  assert.equal(m.variationSuccess, 0);
  assert.equal(m.contextsUsed.length, 1);
  assert.equal(m.currentStage, 'independent');
});

test('automatic needs independent + variation + delayed + spontaneous', () => {
  let m = recordRetrieval(undefined, 'c', ev({ contextKey: 'a' }), NOW);
  m = recordRetrieval(m, 'c', ev({ contextKey: 'b', delayed: true }), NOW);
  assert.equal(m.currentStage, 'flexible', 'no spontaneous use yet');

  m = recordSpontaneousUse(m, 'c', { contextKey: 'c', now: NOW });
  assert.equal(m.currentStage, 'automatic');
});

test('a full reveal is very weak evidence', () => {
  const revealed = recordRetrieval(
    undefined,
    'c',
    ev({ stage: 'independent', hintLevel: 'full_answer', outcome: 'partial' }),
    NOW,
  );
  const unaided = recordRetrieval(undefined, 'c', ev(), NOW);

  assert.ok(revealed.score < unaided.score);
  assert.equal(revealed.currentStage, 'prompted', 'a reveal only earns prompted');
  assert.equal(unaided.currentStage, 'independent');
});

test('retrievalStrength ranks support levels correctly', () => {
  const independent = retrievalStrength(ev());
  const supported = retrievalStrength(ev({ stage: 'supported' }));
  const prompted = retrievalStrength(ev({ stage: 'prompted', hintLevel: 'partial' }));
  const failed = retrievalStrength(ev({ outcome: 'failed' }));

  assert.ok(independent > supported, 'independent > supported');
  assert.ok(supported > prompted, 'supported > prompted');
  assert.equal(failed, 0);
});

test('failure lowers the score but never erases earned stages', () => {
  let m = recordRetrieval(undefined, 'c', ev(), NOW);
  const before = m.score;
  m = recordRetrieval(m, 'c', ev({ outcome: 'failed' }), NOW);

  assert.ok(m.score < before);
  assert.equal(m.failedRetrievals, 1);
  assert.equal(m.currentStage, 'independent', 'stage is monotonic');
});

test('score stays within 0..100', () => {
  let m = emptyMastery('c', NOW.toISOString());
  for (let i = 0; i < 30; i += 1) {
    m = recordRetrieval(m, 'c', ev({ contextKey: `ctx-${i}` }), NOW);
  }
  assert.equal(m.score, 100);

  const sunk = { ...emptyMastery('c', NOW.toISOString()), failedRetrievals: 50 };
  assert.equal(computeScore(sunk), 0);
});

test('isComfortable only from independent upward', () => {
  const base = emptyMastery('c', NOW.toISOString());
  assert.equal(isComfortable({ ...base, currentStage: 'supported' }), false);
  assert.equal(isComfortable({ ...base, currentStage: 'independent' }), true);
  assert.equal(isComfortable({ ...base, currentStage: 'automatic' }), true);
});

test('outcomeFor maps production + support to an outcome', () => {
  assert.equal(outcomeFor(false, 'none'), 'failed');
  assert.equal(outcomeFor(true, 'none'), 'success');
  assert.equal(outcomeFor(true, 'full_answer'), 'partial');
});

test('deriveStage is a pure function of the counters', () => {
  const m = {
    ...emptyMastery('c', NOW.toISOString()),
    supportedSuccess: 3,
  };
  assert.equal(deriveStage(m), 'supported');
});
