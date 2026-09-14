import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hydrate } from './StorageService';
import { SKILL_IDS } from '../../types/chunk';

test('an empty / garbage store yields a clean profile', () => {
  for (const input of [null, undefined, 'nope', 42]) {
    const p = hydrate(input);
    assert.equal(p.xp, 0);
    assert.deepEqual(p.chunkMastery, []);
    assert.deepEqual(p.personalChunks, []);
  }
});

test('unknown/missing fields fall back to defaults', () => {
  const p = hydrate({ xp: 120 });
  assert.equal(p.xp, 120);
  assert.equal(p.settings.showLearningHints, true);
  assert.equal(p.weakness.length, SKILL_IDS.length);
  assert.equal(p.signals.spontaneousUsage, 0);
});

test('a v1 profile is migrated to chunks and keeps its XP', () => {
  const v1 = {
    xp: 300,
    level: 2,
    completedLessons: [
      { lessonId: 'project-01', score: 80, xpEarned: 35, completedAt: '2026-01-01T00:00:00.000Z' },
    ],
    chapterProgress: { 'project-communication': 1 },
    languageGaps: [
      {
        id: 'wait-for-thing-person',
        concept: 'wait for + thing/person',
        betterExpression: "I'm waiting for the UX feedback.",
        patternId: 'wait-for',
        status: 'familiar',
        sourceLessons: ['project-01'],
        masteryEvidence: [
          { timestamp: '2026-01-01T00:00:00.000Z', context: 'project-01', result: 'natural_spontaneous', expression: 'x' },
        ],
        firstSeenAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  };

  const p = hydrate(v1);

  assert.equal(p.xp, 300, 'XP survives');
  assert.equal(p.completedLessons.length, 1, 'lesson history survives');
  assert.equal(p.chapterProgress['project-communication'], 1);

  assert.equal(p.chunkMastery.length, 1, 'the gap became a tracked chunk');
  assert.equal(p.chunkMastery[0]?.chunkId, 'wait-for', 'merged onto the library chunk');
  assert.equal(p.chunkMastery[0]?.spontaneousUsage, 1, 'history preserved');
  assert.ok((p.chunkMastery[0]?.score ?? 0) > 0);

  assert.equal(
    (p as unknown as { languageGaps?: unknown }).languageGaps,
    undefined,
    'the old store is dropped, not kept alongside',
  );
});

test('migration is idempotent for an already-migrated profile', () => {
  const once = hydrate({
    languageGaps: [
      {
        id: 'g',
        concept: 'by + deadline',
        betterExpression: 'I should have it done by Friday.',
        patternId: 'by-deadline',
        status: 'developing',
        masteryEvidence: [],
      },
    ],
  });
  const twice = hydrate(once);

  assert.equal(twice.chunkMastery.length, once.chunkMastery.length);
  assert.equal(twice.chunkMastery[0]?.score, once.chunkMastery[0]?.score);
});
