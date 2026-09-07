import phrasePatternsJson from '../data/curriculum/phrasePatterns.json';
import type {
  EvaluateContext,
  LanguageGapObservation,
  LearningFeedback,
  ResponseEvaluation,
  TurnLanguageAnalysis,
} from '../types';

/* ==========================================================================
 * Shared turn scoring.
 *
 * Both MockAIConversationService and OpenAIConversationService produce a
 * `TurnLanguageAnalysis` (rules vs. the model). Everything DOWNSTREAM of that —
 * evaluation ratings, the subtle learning line, objective progress, lesson
 * completion, and XP — is computed HERE so the two engines are contract-
 * identical and completion / XP stay server-authoritative (spec §21–23).
 * ======================================================================== */

const PATTERN_IDS = new Set(
  (phrasePatternsJson as unknown as { patterns: { id: string }[] }).patterns.map(
    (p) => p.id,
  ),
);

export function conceptKey(concept: string): string {
  return concept
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface ScoredTurn {
  gap: LanguageGapObservation | null;
  patternsUsedNaturally: string[];
  evaluation: ResponseEvaluation;
  learning: LearningFeedback;
  objectiveProgress: Record<string, boolean>;
  completedObjectiveCount: number;
  lessonComplete: boolean;
  xpEarned: number;
}

interface ScoreOptions {
  /** objective ids the evaluator says the player demonstrated this turn */
  demonstratedObjectiveIds?: string[];
  /**
   * When `demonstratedObjectiveIds` is omitted (the mock), advance the first
   * still-open objective if the meaning got through.
   */
  advanceOpenObjectiveOnMeaning?: boolean;
  /**
   * The turn could not be evaluated (OpenAI failure / invalid output). Preserve
   * state: no gap, no objective progress, no completion, no XP.
   */
  degraded?: boolean;
}

/** Drop a gap the player shouldn't be taught right now. */
function suppressGap(
  gap: LanguageGapObservation | null,
  comfortableConcepts: string[],
): LanguageGapObservation | null {
  if (!gap) return null;
  if (gap.priority === 'ignore') return null;
  const key = conceptKey(gap.concept);
  if (
    comfortableConcepts.includes(key) ||
    comfortableConcepts.includes(gap.concept)
  ) {
    return null;
  }
  return gap;
}

function deriveEvaluation(
  analysis: TurnLanguageAnalysis,
  gap: LanguageGapObservation | null,
): ResponseEvaluation {
  const meaningCorrect = analysis.meaningCommunicated;

  const grammar: ResponseEvaluation['grammar'] = !analysis.grammarOk
    ? 'poor'
    : gap
      ? 'ok'
      : 'good';

  const naturalness: ResponseEvaluation['naturalness'] = !meaningCorrect
    ? 'unnatural'
    : analysis.natural
      ? 'natural'
      : 'ok';

  let overall: ResponseEvaluation['overall'];
  if (!meaningCorrect) overall = 'poor';
  else if (gap && (gap.priority === 'important' || gap.priority === 'critical'))
    overall = 'ok';
  else if (gap) overall = 'good';
  else if (analysis.natural) overall = 'excellent';
  else overall = 'good';

  return { overall, meaningCorrect, grammar, naturalness };
}

function deriveLearning(
  gap: LanguageGapObservation | null,
  patternsUsedNaturally: string[],
): LearningFeedback {
  if (gap) {
    return {
      kind: 'correction',
      shouldShow: true,
      betterExpression: gap.betterExpression,
      explanation: gap.explanation,
    };
  }
  return {
    kind: patternsUsedNaturally.length > 0 ? 'pattern-used' : 'none',
    shouldShow: false,
    betterExpression: null,
    explanation: null,
  };
}

export function scoreTurn(
  context: EvaluateContext,
  analysis: TurnLanguageAnalysis,
  opts: ScoreOptions = {},
): ScoredTurn {
  const { lesson, completedObjectiveIds, playerTurnNumber, comfortableConcepts } =
    context;

  if (opts.degraded) {
    const objectiveProgress: Record<string, boolean> = {};
    for (const o of lesson.learningObjectives) {
      objectiveProgress[o.id] = completedObjectiveIds.includes(o.id);
    }
    return {
      gap: null,
      patternsUsedNaturally: [],
      evaluation: {
        overall: 'ok',
        meaningCorrect: true,
        grammar: 'good',
        naturalness: 'ok',
      },
      learning: { kind: 'none', shouldShow: false, betterExpression: null, explanation: null },
      objectiveProgress,
      completedObjectiveCount: Object.values(objectiveProgress).filter(Boolean).length,
      lessonComplete: false,
      xpEarned: 0,
    };
  }

  const gap = suppressGap(analysis.gap, comfortableConcepts);

  const patternsUsedNaturally = gap
    ? []
    : [...new Set(analysis.patternsUsedNaturally)].filter((id) =>
        PATTERN_IDS.has(id),
      );

  // ---- objective progress (server-authoritative) ----
  const allIds = lesson.learningObjectives.map((o) => o.id);
  const objectiveProgress: Record<string, boolean> = {};
  for (const id of allIds) objectiveProgress[id] = completedObjectiveIds.includes(id);

  if (opts.demonstratedObjectiveIds) {
    for (const id of opts.demonstratedObjectiveIds) {
      if (allIds.includes(id)) objectiveProgress[id] = true;
    }
  } else if (opts.advanceOpenObjectiveOnMeaning && analysis.meaningCommunicated) {
    const open = allIds.find((id) => !objectiveProgress[id]);
    if (open) objectiveProgress[open] = true;
  }

  const completedObjectiveCount = allIds.filter((id) => objectiveProgress[id]).length;

  const requiredDone = lesson.completionCriteria.requiredObjectives.every(
    (id) => objectiveProgress[id],
  );
  const lessonComplete =
    requiredDone && playerTurnNumber >= lesson.completionCriteria.minimumTurns;

  // ---- evaluation + learning ----
  const evaluation = deriveEvaluation(analysis, gap);
  const learning = deriveLearning(gap, patternsUsedNaturally);

  // ---- XP (existing formula — no new system) ----
  let xpEarned = { excellent: 15, good: 10, ok: 5, poor: 0 }[evaluation.overall];
  if (patternsUsedNaturally.length > 0) xpEarned += 10;
  if (lessonComplete) xpEarned += lesson.xp;

  return {
    gap,
    patternsUsedNaturally,
    evaluation,
    learning,
    objectiveProgress,
    completedObjectiveCount,
    lessonComplete,
    xpEarned,
  };
}
