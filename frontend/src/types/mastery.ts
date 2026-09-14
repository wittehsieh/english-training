import type { SkillId } from './chunk';

/**
 * Mastery = evidence that the player can PRODUCE the chunk when a situation
 * calls for it. Seeing it, understanding it, and repeating it after seeing the
 * answer are all weak evidence. Independent + varied + delayed + spontaneous
 * production is strong evidence.
 */

export type MasteryStage =
  | 'familiar' // has met it, never retrieved it
  | 'prompted' // produced it with the pattern shown
  | 'supported' // produced it from the situation alone
  | 'independent' // produced it with no indication it was being practised
  | 'flexible' // produced it independently in different situations
  | 'automatic'; // delayed + spontaneous production

export const MASTERY_STAGES: MasteryStage[] = [
  'familiar',
  'prompted',
  'supported',
  'independent',
  'flexible',
  'automatic',
];

export const STAGE_LABELS: Record<MasteryStage, string> = {
  familiar: 'Familiar',
  prompted: 'Emerging',
  supported: 'Usable',
  independent: 'Independent',
  flexible: 'Flexible',
  automatic: 'Automatic',
};

export const STAGE_ICONS: Record<MasteryStage, string> = {
  familiar: '🌱',
  prompted: '🌿',
  supported: '🌳',
  independent: '🌲',
  flexible: '🌲',
  automatic: '⭐',
};

/** What the player is asked to do (§7). */
export type RetrievalStage = 'prompted' | 'supported' | 'independent';

/**
 * Internal support granularity (§7). The player only ever experiences
 * "a hint"; the engine uses the level to weight the evidence.
 */
export type HintLevel =
  | 'none'
  | 'context' // "Think about how much time you've had."
  | 'semantic' // nudge toward the meaning
  | 'partial' // "I haven't had much time to..."
  | 'first_word' // "I..."
  | 'full_answer'; // reveal

export const HINT_LEVELS: HintLevel[] = [
  'none',
  'context',
  'semantic',
  'partial',
  'first_word',
  'full_answer',
];

export function nextHintLevel(level: HintLevel): HintLevel {
  const i = HINT_LEVELS.indexOf(level);
  return HINT_LEVELS[Math.min(i + 1, HINT_LEVELS.length - 1)]!;
}

export type RetrievalOutcome = 'success' | 'partial' | 'failed';

export interface RetrievalEvidence {
  at: string;
  stage: RetrievalStage;
  hintLevel: HintLevel;
  outcome: RetrievalOutcome;
  /** audience|setting|purpose — distinct keys prove transfer, not repetition */
  contextKey?: string;
  lessonId?: string;
  /** fired from the spaced scheduler rather than right after discovery */
  delayed?: boolean;
  /** the player produced it unprompted in free conversation */
  spontaneous?: boolean;
}

export interface ChunkMastery {
  chunkId: string;
  /** 0..100, derived deterministically from the counters below */
  score: number;

  promptedSuccess: number;
  supportedSuccess: number;
  independentSuccess: number;

  variationSuccess: number;
  delayedSuccess: number;
  spontaneousUsage: number;

  failedRetrievals: number;

  /** distinct retrieval-context keys this chunk has been produced in */
  contextsUsed: string[];

  lastSeenAt?: string;
  lastRetrievedAt?: string;
  nextReviewAt?: string;

  currentStage: MasteryStage;
  /** capped tail of evidence, newest last */
  evidence: RetrievalEvidence[];
}

export function emptyMastery(chunkId: string, now: string): ChunkMastery {
  return {
    chunkId,
    score: 0,
    promptedSuccess: 0,
    supportedSuccess: 0,
    independentSuccess: 0,
    variationSuccess: 0,
    delayedSuccess: 0,
    spontaneousUsage: 0,
    failedRetrievals: 0,
    contextsUsed: [],
    lastSeenAt: now,
    currentStage: 'familiar',
    evidence: [],
  };
}

/* -------------------------------------------------------------------------- */
/*  Weakness map (§19) — never presented as school grades.                     */
/* -------------------------------------------------------------------------- */

export interface WeaknessProfile {
  skillId: SkillId;
  /** 0..1, higher = stronger */
  score: number;
  attempts: number;
  successes: number;
  recentFailures: number;
}

/** Coarse learner-level signals, updated alongside mastery. */
export interface LearnerSignals {
  /** how often the player's phrasing reads as translated rather than native */
  directTranslationTendency: number; // 0..1, higher = more translation-like
  /** average retrieval strength across chunks, 0..1 */
  chunkRetrievalStrength: number;
  /** total unprompted uses of tracked chunks */
  spontaneousUsage: number;
  /** rolling mean seconds to answer a retrieval, null until measured */
  responseSpeedSeconds: number | null;
}

export const EMPTY_SIGNALS: LearnerSignals = {
  directTranslationTendency: 0,
  chunkRetrievalStrength: 0,
  spontaneousUsage: 0,
  responseSpeedSeconds: null,
};
