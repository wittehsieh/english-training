import { learningConfig } from '../../config/learningConfig';
import type { ChunkMastery, RetrievalOutcome } from '../../types/mastery';

/**
 * Spaced retrieval — deliberately simple and deterministic (§13, §16).
 * A chunk climbs a fixed interval ladder on success and steps back on failure.
 * Swap this file out for SM-2/FSRS later; nothing else depends on the maths.
 */

/** How far up the ladder this chunk currently is. */
export function ladderStep(mastery: ChunkMastery): number {
  const successes =
    mastery.promptedSuccess +
    mastery.supportedSuccess +
    mastery.independentSuccess;
  const penalty = mastery.failedRetrievals * learningConfig.reviewFailureStepBack;
  const step = successes - penalty;
  return Math.max(0, Math.min(step, learningConfig.reviewIntervalsMinutes.length - 1));
}

export function intervalMinutes(step: number): number {
  const ladder = learningConfig.reviewIntervalsMinutes;
  const i = Math.max(0, Math.min(step, ladder.length - 1));
  return ladder[i]!;
}

/** Next review timestamp for a chunk after an outcome, as an ISO string. */
export function computeNextReviewAt(
  mastery: ChunkMastery,
  outcome: RetrievalOutcome,
  now: Date,
): string {
  const base = ladderStep(mastery);
  const step =
    outcome === 'success'
      ? base
      : Math.max(0, base - learningConfig.reviewFailureStepBack);
  const due = new Date(now.getTime() + intervalMinutes(step) * 60_000);
  return due.toISOString();
}

export function isDue(mastery: ChunkMastery, now: Date = new Date()): boolean {
  if (!mastery.nextReviewAt) return false;
  const due = Date.parse(mastery.nextReviewAt);
  return Number.isFinite(due) && due <= now.getTime();
}

/**
 * Chunks due for review, weakest first. The retrieval engine (M2/M3) uses this
 * to decide what to weave into the conversation.
 */
export function dueChunks(
  masteries: ChunkMastery[],
  now: Date = new Date(),
): ChunkMastery[] {
  return masteries
    .filter((m) => isDue(m, now))
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return Date.parse(a.nextReviewAt ?? '') - Date.parse(b.nextReviewAt ?? '');
    });
}
