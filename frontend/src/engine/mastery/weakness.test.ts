import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeSignals,
  ensureAllSkills,
  recordSkillAttempt,
  weakestSkills,
} from './weakness';
import { SKILL_IDS } from '../../types/chunk';
import {
  EMPTY_SIGNALS,
  emptyMastery,
  type RetrievalEvidence,
} from '../../types/mastery';

const NOW = '2026-01-01T09:00:00.000Z';
const ev = (over: Partial<RetrievalEvidence> = {}): RetrievalEvidence => ({
  at: NOW,
  stage: 'independent',
  hintLevel: 'none',
  outcome: 'success',
  ...over,
});

test('every skill is always present', () => {
  assert.equal(ensureAllSkills([]).length, SKILL_IDS.length);
});

test('success raises the skill score, failure lowers it', () => {
  let p = recordSkillAttempt([], 'expressing_uncertainty', ev());
  const afterSuccess = p.find((s) => s.skillId === 'expressing_uncertainty')!;
  assert.equal(afterSuccess.attempts, 1);
  assert.equal(afterSuccess.successes, 1);
  assert.ok(afterSuccess.score > 0);

  p = recordSkillAttempt(p, 'expressing_uncertainty', ev({ outcome: 'failed' }));
  const afterFailure = p.find((s) => s.skillId === 'expressing_uncertainty')!;
  assert.equal(afterFailure.attempts, 2);
  assert.equal(afterFailure.successes, 1);
  assert.equal(afterFailure.recentFailures, 1);
  assert.ok(afterFailure.score < afterSuccess.score);
});

test('only the targeted skill changes', () => {
  const p = recordSkillAttempt([], 'giving_timeline', ev());
  const untouched = p.filter((s) => s.skillId !== 'giving_timeline');
  assert.ok(untouched.every((s) => s.attempts === 0 && s.score === 0));
});

test('recent failures decay as the player recovers', () => {
  let p = recordSkillAttempt([], 'small_talk', ev({ outcome: 'failed' }));
  assert.equal(p.find((s) => s.skillId === 'small_talk')!.recentFailures, 1);
  p = recordSkillAttempt(p, 'small_talk', ev());
  assert.equal(p.find((s) => s.skillId === 'small_talk')!.recentFailures, 0.5);
});

test('weakestSkills ignores skills never attempted', () => {
  let p = recordSkillAttempt([], 'making_suggestions', ev({ outcome: 'failed' }));
  p = recordSkillAttempt(p, 'small_talk', ev());

  const weakest = weakestSkills(p, 5);
  assert.equal(weakest.length, 2, 'only attempted skills are ranked');
  assert.equal(weakest[0]?.skillId, 'making_suggestions');
});

test('signals summarise the whole mastery store', () => {
  const a = { ...emptyMastery('a', NOW), score: 80, lastRetrievedAt: NOW, spontaneousUsage: 2 };
  const b = { ...emptyMastery('b', NOW), score: 20, lastRetrievedAt: NOW };
  const unseen = emptyMastery('c', NOW);

  const s = computeSignals([a, b, unseen], EMPTY_SIGNALS);
  assert.equal(s.chunkRetrievalStrength, 0.5, 'mean of retrieved chunks only');
  assert.equal(s.spontaneousUsage, 2);
});

test('directTranslationTendency moves toward recent behaviour', () => {
  const up = computeSignals([], EMPTY_SIGNALS, { translationLikeTurn: true });
  assert.ok(up.directTranslationTendency > 0);

  const down = computeSignals([], up, { translationLikeTurn: false });
  assert.ok(down.directTranslationTendency < up.directTranslationTendency);
});

test('response speed is a rolling average', () => {
  const first = computeSignals([], EMPTY_SIGNALS, { responseSeconds: 10 });
  assert.equal(first.responseSpeedSeconds, 10);

  const second = computeSignals([], first, { responseSeconds: 20 });
  assert.ok(second.responseSpeedSeconds! > 10 && second.responseSpeedSeconds! < 20);
});
