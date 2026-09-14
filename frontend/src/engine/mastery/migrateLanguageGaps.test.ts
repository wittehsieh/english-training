import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  migrateLanguageGaps,
  type LegacyLanguageGap,
} from './migrateLanguageGaps';
import { getLibraryChunk } from '../../data/chunks';

const gap = (over: Partial<LegacyLanguageGap> = {}): LegacyLanguageGap => ({
  id: 'wait-for-thing-person',
  concept: 'wait for + thing/person',
  userIntent: 'explain what is blocking your progress',
  userAttempt: 'I am waiting the UX feedback.',
  betterExpression: "I'm waiting for the UX feedback.",
  gapType: 'sentence_pattern',
  priority: 'useful',
  status: 'needs_practice',
  patternId: 'wait-for',
  sourceLessons: ['project-01'],
  timesObserved: 1,
  masteryEvidence: [],
  firstSeenAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  ...over,
});

test('a gap with a known patternId merges onto the library chunk', () => {
  const { chunks, mastery, migratedCount } = migrateLanguageGaps([gap()]);

  assert.equal(migratedCount, 1);
  assert.equal(chunks.length, 0, 'no duplicate personal chunk is created');
  assert.equal(mastery[0]?.chunkId, 'wait-for');
  assert.ok(getLibraryChunk('wait-for'), 'library chunk exists');
});

test('a gap with no library match becomes a personal chunk', () => {
  const { chunks, mastery } = migrateLanguageGaps([
    gap({
      id: 'x',
      concept: 'bring something up with someone',
      betterExpression: 'I wanted to bring something up with you.',
      patternId: undefined,
    }),
  ]);

  assert.equal(chunks.length, 1);
  assert.equal(chunks[0]?.source, 'personal');
  assert.equal(chunks[0]?.phrase, 'I wanted to bring something up with you.');
  assert.equal(chunks[0]?.originalAttempt, 'I am waiting the UX feedback.');
  assert.equal(mastery[0]?.chunkId, chunks[0]?.id);
});

test('evidence history is replayed into the new counters', () => {
  const { mastery } = migrateLanguageGaps([
    gap({
      status: 'familiar',
      masteryEvidence: [
        { timestamp: '2026-01-01T00:00:00.000Z', context: 'project-01', result: 'incorrect', expression: 'x' },
        { timestamp: '2026-01-02T00:00:00.000Z', context: 'project-01', result: 'correct_after_hint', expression: 'x' },
        { timestamp: '2026-01-03T00:00:00.000Z', context: 'project-04', result: 'natural_spontaneous', expression: 'x' },
      ],
    }),
  ]);

  const m = mastery[0]!;
  assert.equal(m.failedRetrievals, 1);
  assert.equal(m.promptedSuccess, 1);
  assert.equal(m.independentSuccess, 1);
  assert.equal(m.spontaneousUsage, 1);
  assert.equal(m.evidence.length, 3);
});

test('old status is a floor — nobody comes out of migration worse off', () => {
  const { mastery } = migrateLanguageGaps([
    gap({ status: 'mastered', masteryEvidence: [] }),
  ]);

  // No evidence at all, but they had reached "mastered" under the old model.
  assert.equal(mastery[0]?.currentStage, 'independent');
  assert.ok((mastery[0]?.score ?? 0) > 0);
});

test('status floors map across the whole old scale', () => {
  const expected: Record<string, string> = {
    needs_practice: 'familiar',
    developing: 'prompted',
    familiar: 'supported',
    mastered: 'independent',
  };
  for (const [status, stage] of Object.entries(expected)) {
    const { mastery } = migrateLanguageGaps([
      gap({ status: status as LegacyLanguageGap['status'], masteryEvidence: [] }),
    ]);
    assert.equal(mastery[0]?.currentStage, stage, `${status} -> ${stage}`);
  }
});

test('two gaps pointing at the same chunk merge rather than duplicate', () => {
  const { chunks, mastery } = migrateLanguageGaps([
    gap({ id: 'a', masteryEvidence: [{ timestamp: '2026-01-01T00:00:00.000Z', context: 'l1', result: 'correct_after_hint', expression: 'x' }] }),
    gap({ id: 'b', masteryEvidence: [{ timestamp: '2026-01-02T00:00:00.000Z', context: 'l2', result: 'correct_after_hint', expression: 'x' }] }),
  ]);

  assert.equal(chunks.length, 0);
  assert.equal(mastery.length, 1);
  assert.equal(mastery[0]?.promptedSuccess, 2, 'both histories are kept');
});

test('malformed records are skipped, not crashed on', () => {
  const { migratedCount } = migrateLanguageGaps([
    { id: 'broken', concept: 'x', betterExpression: '' } as LegacyLanguageGap,
  ]);
  assert.equal(migratedCount, 0);
});
