/**
 * The Personal Language Gap model — the core learning mechanism.
 *
 * We do NOT record everything the player encounters. We record the specific
 * places where the player's English fell short of their intent, and we track
 * whether they later close that gap through repeated natural use.
 *
 * Shapes mirror `src/data/curriculum/learningModel.json`.
 */

export type GapType =
  | 'meaning'
  | 'grammar'
  | 'word_choice'
  | 'sentence_pattern'
  | 'naturalness'
  | 'context'
  | 'register';

export type GapPriority = 'ignore' | 'optional' | 'useful' | 'important' | 'critical';

export type MasteryStatus =
  | 'needs_practice'
  | 'developing'
  | 'familiar'
  | 'mastered';

export const GAP_PRIORITIES: GapPriority[] = [
  'ignore',
  'optional',
  'useful',
  'important',
  'critical',
];

export const MASTERY_STATUSES: MasteryStatus[] = [
  'needs_practice',
  'developing',
  'familiar',
  'mastered',
];

export type MasteryResult =
  | 'incorrect'
  | 'correct_after_hint'
  | 'natural_spontaneous';

export interface MasteryEvidence {
  timestamp: string;
  /** where the evidence came from */
  context: string;
  result: MasteryResult;
  expression: string;
}

/**
 * What the AI reports about ONE player turn. This is guidance produced fresh
 * each turn; only `gap !== null` turns become (or reinforce) a stored record.
 */
export interface TurnLanguageAnalysis {
  /** the AI's best guess at what the player was trying to say */
  understoodIntent: string;
  meaningCommunicated: boolean;
  grammarOk: boolean;
  natural: boolean;
  contextAppropriate: boolean;
  /** null => the player's English was fine; nothing to teach */
  gap: LanguageGapObservation | null;
  /**
   * Pattern ids (from phrasePatterns.json) the player used correctly and
   * spontaneously this turn — mastery evidence, not something to teach.
   */
  patternsUsedNaturally: string[];
}

/** A single observed gap, before it is merged into the player's record. */
export interface LanguageGapObservation {
  /** stable concept key, e.g. "wait for + noun" */
  concept: string;
  gapType: GapType;
  priority: GapPriority;
  userIntent: string;
  userAttempt: string;
  betterExpression: string;
  /** link to phrasePatterns.json when applicable */
  patternId?: string;
  /** short, contextual explanation — one line */
  explanation: string;
  /** 0..1 — the evaluator's confidence this is a real, worth-teaching gap */
  confidence?: number;
}

/** The persisted record (see learningModel.recordSchema). */
export interface LanguageGap {
  id: string;
  concept: string;
  userIntent: string;
  userAttempt: string;
  betterExpression: string;
  gapType: GapType;
  priority: GapPriority;
  status: MasteryStatus;
  /** 0..1 — how confident we are this is a real, still-open gap */
  confidence: number;
  patternId?: string;
  sourceLessons: string[];
  timesObserved: number;
  timesPracticed: number;
  timesUsedCorrectly: number;
  masteryEvidence: MasteryEvidence[];
  firstSeenAt: string;
  updatedAt: string;
}
