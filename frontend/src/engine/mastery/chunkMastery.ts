import { learningConfig } from '../../config/learningConfig';
import {
  emptyMastery,
  type ChunkMastery,
  type HintLevel,
  type MasteryStage,
  type RetrievalEvidence,
  type RetrievalOutcome,
  type RetrievalStage,
} from '../../types/mastery';
import { computeNextReviewAt } from './scheduler';

/* ==========================================================================
 * Chunk mastery — pure, deterministic. The AI never writes these numbers
 * (§8/§18); it only reports what happened and this engine decides what that
 * means.
 *
 * Core principle: seeing ≠ understanding ≠ producing. Evidence is weighted by
 * how much support the player needed.
 * ======================================================================== */

/** Points for a clean success at each retrieval stage. */
const STAGE_POINTS: Record<RetrievalStage, number> = {
  prompted: 6,
  supported: 14,
  independent: 24,
};

/**
 * How much the evidence is worth given the support used.
 * A full reveal is very weak evidence; unaided production is full strength.
 */
const HINT_WEIGHT: Record<HintLevel, number> = {
  none: 1,
  context: 0.85,
  semantic: 0.7,
  partial: 0.5,
  first_word: 0.35,
  full_answer: 0.1,
};

const VARIATION_BONUS = 10;
const DELAYED_BONUS = 12;
const SPONTANEOUS_BONUS = 20;
const FAILURE_PENALTY = 8;

export function hintWeight(level: HintLevel): number {
  return HINT_WEIGHT[level];
}

/** Single-turn retrieval strength, 0..1 — used for learner-level signals. */
export function retrievalStrength(ev: RetrievalEvidence): number {
  if (ev.outcome === 'failed') return 0;
  const base = STAGE_POINTS[ev.stage] / STAGE_POINTS.independent;
  const weighted = base * HINT_WEIGHT[ev.hintLevel];
  const partialFactor = ev.outcome === 'partial' ? 0.5 : 1;
  return Math.max(0, Math.min(1, weighted * partialFactor));
}

export function deriveStage(m: ChunkMastery): MasteryStage {
  const varied = m.contextsUsed.length >= learningConfig.contextsForFlexible;

  if (
    m.independentSuccess >= 1 &&
    varied &&
    m.delayedSuccess >= 1 &&
    m.spontaneousUsage >= 1
  ) {
    return 'automatic';
  }
  if (m.independentSuccess >= 1 && varied) return 'flexible';
  if (m.independentSuccess >= 1) return 'independent';
  if (m.supportedSuccess >= 1) return 'supported';
  if (m.promptedSuccess >= 1) return 'prompted';
  return 'familiar';
}

export function computeScore(m: ChunkMastery): number {
  const raw =
    m.promptedSuccess * STAGE_POINTS.prompted +
    m.supportedSuccess * STAGE_POINTS.supported +
    m.independentSuccess * STAGE_POINTS.independent +
    m.variationSuccess * VARIATION_BONUS +
    m.delayedSuccess * DELAYED_BONUS +
    m.spontaneousUsage * SPONTANEOUS_BONUS -
    m.failedRetrievals * FAILURE_PENALTY;

  return Math.max(0, Math.min(100, Math.round(raw)));
}

/** Recompute the derived fields after the counters change. */
function finalise(m: ChunkMastery): ChunkMastery {
  return { ...m, score: computeScore(m), currentStage: deriveStage(m) };
}

/**
 * The player has just MET the chunk (discovery card, or it appeared in a
 * hint). This is not mastery — it only starts the review clock.
 */
export function recordEncounter(
  mastery: ChunkMastery | undefined,
  chunkId: string,
  now: Date = new Date(),
): ChunkMastery {
  const iso = now.toISOString();
  const base = mastery ?? emptyMastery(chunkId, iso);
  const next: ChunkMastery = {
    ...base,
    lastSeenAt: iso,
    nextReviewAt:
      base.nextReviewAt ?? computeNextReviewAt(base, 'success', now),
  };
  return finalise(next);
}

/**
 * The player attempted to PRODUCE the chunk. This is the only thing that
 * moves mastery.
 */
export function recordRetrieval(
  mastery: ChunkMastery | undefined,
  chunkId: string,
  ev: RetrievalEvidence,
  now: Date = new Date(),
): ChunkMastery {
  const base = mastery ?? emptyMastery(chunkId, ev.at);
  const succeeded = ev.outcome === 'success' || ev.outcome === 'partial';

  const next: ChunkMastery = {
    ...base,
    promptedSuccess: base.promptedSuccess,
    supportedSuccess: base.supportedSuccess,
    independentSuccess: base.independentSuccess,
    contextsUsed: [...base.contextsUsed],
    evidence: [...base.evidence, ev].slice(-learningConfig.maxEvidencePerChunk),
    lastSeenAt: ev.at,
  };

  if (succeeded) {
    next.lastRetrievedAt = ev.at;

    // A partial counts as the weakest kind of success no matter what stage was
    // asked for — they got there, but with real support.
    const creditedStage: RetrievalStage =
      ev.outcome === 'partial' ? 'prompted' : ev.stage;

    if (creditedStage === 'independent') next.independentSuccess += 1;
    else if (creditedStage === 'supported') next.supportedSuccess += 1;
    else next.promptedSuccess += 1;

    if (ev.contextKey && !next.contextsUsed.includes(ev.contextKey)) {
      // The first context is just "where they learned it"; every context after
      // that is evidence of transfer.
      if (next.contextsUsed.length > 0) next.variationSuccess += 1;
      next.contextsUsed.push(ev.contextKey);
    }

    if (ev.delayed) next.delayedSuccess += 1;
    if (ev.spontaneous) next.spontaneousUsage += 1;
  } else {
    next.failedRetrievals += 1;
  }

  next.nextReviewAt = computeNextReviewAt(
    next,
    succeeded ? 'success' : 'failed',
    now,
  );

  return finalise(next);
}

/**
 * The player used the chunk correctly in free conversation without being
 * asked — the strongest evidence there is.
 */
export function recordSpontaneousUse(
  mastery: ChunkMastery | undefined,
  chunkId: string,
  opts: { lessonId?: string; contextKey?: string; now?: Date } = {},
): ChunkMastery {
  const now = opts.now ?? new Date();
  const ev: RetrievalEvidence = {
    at: now.toISOString(),
    stage: 'independent',
    hintLevel: 'none',
    outcome: 'success',
    spontaneous: true,
    ...(opts.contextKey !== undefined ? { contextKey: opts.contextKey } : {}),
    ...(opts.lessonId !== undefined ? { lessonId: opts.lessonId } : {}),
  };
  return recordRetrieval(mastery, chunkId, ev, now);
}

export function isComfortable(m: ChunkMastery): boolean {
  return (
    m.currentStage === 'independent' ||
    m.currentStage === 'flexible' ||
    m.currentStage === 'automatic'
  );
}

export function outcomeFor(
  produced: boolean,
  hintLevel: HintLevel,
): RetrievalOutcome {
  if (!produced) return 'failed';
  return hintLevel === 'full_answer' ? 'partial' : 'success';
}
