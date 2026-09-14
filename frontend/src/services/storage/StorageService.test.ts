import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hydrate } from './StorageService';
import { SKILL_IDS } from '../../types/chunk';

test('an empty / garbage store yields a clean profile', () => {
  for (const input of [null, undefined, 'nope', 42]) {
    const p = hydrate(input);
    assert.deepEqual(p.chunkMastery, []);
    assert.deepEqual(p.personalChunks, []);
    assert.deepEqual(p.completedLessons, []);
  }
});

test('unknown/missing fields fall back to defaults', () => {
  const p = hydrate({ chapterProgress: { 'everyday-office': 2 } });
  assert.equal(p.chapterProgress['everyday-office'], 2);
  assert.equal(p.settings.showLearningHints, true);
  assert.equal(p.weakness.length, SKILL_IDS.length);
  assert.equal(p.signals.spontaneousUsage, 0);
});

test('a v1 profile is migrated to chunks and keeps its lesson history', () => {
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

  assert.equal(p.completedLessons.length, 1, 'lesson history survives');
  assert.equal(p.completedLessons[0]?.score, 80);
  assert.equal(p.chapterProgress['project-communication'], 1);

  assert.equal(p.chunkMastery.length, 1, 'the gap became a tracked chunk');
  assert.equal(p.chunkMastery[0]?.chunkId, 'wait-for', 'merged onto the library chunk');
  assert.equal(p.chunkMastery[0]?.spontaneousUsage, 1, 'history preserved');
  assert.ok((p.chunkMastery[0]?.score ?? 0) > 0);

  // stale v1-only fields (xp, level, languageGaps) must not survive migration
  const loose = p as unknown as Record<string, unknown>;
  assert.equal(loose.languageGaps, undefined, 'the old store is dropped, not kept alongside');
  assert.equal(loose.xp, undefined, 'XP is not a concept anymore');
  assert.equal(loose.level, undefined, 'leveling is not a concept anymore');
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
