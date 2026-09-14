import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeNextReviewAt, dueChunks, isDue, ladderStep } from './scheduler';
import { recordRetrieval } from './chunkMastery';
import { emptyMastery, type RetrievalEvidence } from '../../types/mastery';
import { learningConfig } from '../../config/learningConfig';

const NOW = new Date('2026-01-01T09:00:00.000Z');
const ev = (over: Partial<RetrievalEvidence> = {}): RetrievalEvidence => ({
  at: NOW.toISOString(),
  stage: 'independent',
  hintLevel: 'none',
  outcome: 'success',
  ...over,
});

test('first review is soon after discovery, then intervals grow', () => {
  let m = recordRetrieval(undefined, 'c', ev(), NOW);
  const first = Date.parse(m.nextReviewAt!) - NOW.getTime();

  m = recordRetrieval(m, 'c', ev({ contextKey: 'b' }), NOW);
  const second = Date.parse(m.nextReviewAt!) - NOW.getTime();

  assert.ok(second > first, 'interval grows with each success');
  assert.equal(first, learningConfig.reviewIntervalsMinutes[1]! * 60_000);
});

test('failure shortens the next interval', () => {
  let m = emptyMastery('c', NOW.toISOString());
  for (let i = 0; i < 4; i += 1) m = recordRetrieval(m, 'c', ev(), NOW);
  const afterSuccess = Date.parse(m.nextReviewAt!);

  const failed = recordRetrieval(m, 'c', ev({ outcome: 'failed' }), NOW);
  assert.ok(Date.parse(failed.nextReviewAt!) < afterSuccess);
});

test('ladder is clamped to the configured intervals', () => {
  const maxed = {
    ...emptyMastery('c', NOW.toISOString()),
    independentSuccess: 999,
  };
  assert.equal(
    ladderStep(maxed),
    learningConfig.reviewIntervalsMinutes.length - 1,
  );

  const sunk = { ...emptyMastery('c', NOW.toISOString()), failedRetrievals: 99 };
  assert.equal(ladderStep(sunk), 0);
});

test('isDue / dueChunks respect nextReviewAt', () => {
  const soon = {
    ...emptyMastery('a', NOW.toISOString()),
    nextReviewAt: new Date(NOW.getTime() - 1000).toISOString(),
    score: 10,
  };
  const later = {
    ...emptyMastery('b', NOW.toISOString()),
    nextReviewAt: new Date(NOW.getTime() + 60_000).toISOString(),
  };
  const never = emptyMastery('c', NOW.toISOString());

  assert.equal(isDue(soon, NOW), true);
  assert.equal(isDue(later, NOW), false);
  assert.equal(isDue(never, NOW), false, 'no schedule = not due');

  const due = dueChunks([later, soon, never], NOW);
  assert.deepEqual(due.map((m) => m.chunkId), ['a']);
});

test('due chunks come back weakest first', () => {
  const past = new Date(NOW.getTime() - 1000).toISOString();
  const strong = { ...emptyMastery('strong', past), nextReviewAt: past, score: 80 };
  const weak = { ...emptyMastery('weak', past), nextReviewAt: past, score: 5 };

  assert.deepEqual(
    dueChunks([strong, weak], NOW).map((m) => m.chunkId),
    ['weak', 'strong'],
  );
});

test('computeNextReviewAt is deterministic', () => {
  const m = emptyMastery('c', NOW.toISOString());
  assert.equal(
    computeNextReviewAt(m, 'success', NOW),
    computeNextReviewAt(m, 'success', NOW),
  );
});
