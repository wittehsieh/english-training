/**
 * Tunable knobs for the learning system. Kept in one place so learning
 * intensity can be adjusted without hunting through the engines.
 */
export interface LearningConfig {
  /** minimum player turns between two retrieval events in a conversation */
  retrievalCooldownTurns: number;
  /** max retrieval events per lesson, so an episode never feels like a quiz */
  maxRetrievalsPerLesson: number;
  /** how many hint steps before the answer is revealed */
  maxHintsBeforeReveal: number;
  /** spaced-retrieval ladder, in minutes, indexed by consecutive successes */
  reviewIntervalsMinutes: number[];
  /** on failure, drop back this many steps on the ladder */
  reviewFailureStepBack: number;
  /** keep only the newest N evidence records per chunk */
  maxEvidencePerChunk: number;
  /** a chunk needs this many distinct context keys to count as "flexible" */
  contextsForFlexible: number;
  /** minutes after which a retrieval counts as "delayed" rather than immediate */
  delayedAfterMinutes: number;
}

export const learningConfig: LearningConfig = {
  retrievalCooldownTurns: 3,
  maxRetrievalsPerLesson: 3,
  maxHintsBeforeReveal: 4,
  // ~5 min → 1 day → 3 days → 7 days → 14 days → 30 days
  reviewIntervalsMinutes: [5, 1440, 4320, 10080, 20160, 43200],
  reviewFailureStepBack: 2,
  maxEvidencePerChunk: 40,
  contextsForFlexible: 2,
  delayedAfterMinutes: 60,
};
