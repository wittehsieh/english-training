import type {
  LanguageGap,
  LanguageGapObservation,
  MasteryEvidence,
  MasteryResult,
  MasteryStatus,
} from '../types';

/* ==========================================================================
 * Personal Language Gap engine (pure functions).
 *
 * Rules (from learningModel.json):
 *  - One correct use is evidence of ability, not proof of mastery.
 *  - Repeated successful use across DIFFERENT contexts increases mastery.
 *  - Don't keep teaching something the player already demonstrates.
 * ======================================================================== */

export function gapKey(concept: string): string {
  return concept
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Recompute status purely from the evidence trail. */
export function deriveStatus(gap: LanguageGap): MasteryStatus {
  const natural = gap.masteryEvidence.filter(
    (e) => e.result === 'natural_spontaneous',
  );
  const distinctNaturalContexts = new Set(natural.map((e) => e.context)).size;
  const hintedSuccess = gap.masteryEvidence.some(
    (e) => e.result === 'correct_after_hint',
  );

  if (distinctNaturalContexts >= 2) return 'mastered';
  if (natural.length >= 1) return 'familiar';
  if (hintedSuccess) return 'developing';
  return 'needs_practice';
}

export function isAlreadyComfortable(status: MasteryStatus): boolean {
  return status === 'familiar' || status === 'mastered';
}

function evidence(
  result: MasteryResult,
  context: string,
  expression: string,
  now: string,
): MasteryEvidence {
  return { timestamp: now, context, result, expression };
}

/**
 * Merge a freshly observed gap into the store. If the concept is new, create a
 * record. If it already exists, this is another observation of the same gap
 * (the player made the same kind of slip again).
 */
export function recordGapObservation(
  gaps: LanguageGap[],
  obs: LanguageGapObservation,
  lessonId: string,
  now: string,
): LanguageGap[] {
  const key = gapKey(obs.concept);
  const existing = gaps.find((g) => g.id === key);

  if (!existing) {
    const fresh: LanguageGap = {
      id: key,
      concept: obs.concept,
      userIntent: obs.userIntent,
      userAttempt: obs.userAttempt,
      betterExpression: obs.betterExpression,
      gapType: obs.gapType,
      priority: obs.priority,
      status: 'needs_practice',
      confidence: 0.6,
      patternId: obs.patternId,
      sourceLessons: [lessonId],
      timesObserved: 1,
      timesPracticed: 0,
      timesUsedCorrectly: 0,
      masteryEvidence: [evidence('incorrect', lessonId, obs.userAttempt, now)],
      firstSeenAt: now,
      updatedAt: now,
    };
    return [fresh, ...gaps];
  }

  const updated: LanguageGap = {
    ...existing,
    userAttempt: obs.userAttempt,
    betterExpression: obs.betterExpression || existing.betterExpression,
    timesObserved: existing.timesObserved + 1,
    confidence: Math.min(0.95, existing.confidence + 0.1),
    sourceLessons: existing.sourceLessons.includes(lessonId)
      ? existing.sourceLessons
      : [...existing.sourceLessons, lessonId],
    masteryEvidence: [
      ...existing.masteryEvidence,
      evidence('incorrect', lessonId, obs.userAttempt, now),
    ],
    updatedAt: now,
  };
  updated.status = deriveStatus(updated);
  return gaps.map((g) => (g.id === key ? updated : g));
}

/**
 * The player used a pattern / expression correctly and naturally. If we are
 * tracking a gap for it, this is mastery evidence. If we are not, we do
 * nothing — we do not record things the player already knows.
 */
export function recordSuccessfulUse(
  gaps: LanguageGap[],
  match: { concept?: string; patternId?: string },
  expression: string,
  lessonId: string,
  now: string,
  hinted = false,
): LanguageGap[] {
  const target = gaps.find(
    (g) =>
      (match.concept && g.id === gapKey(match.concept)) ||
      (match.patternId && g.patternId === match.patternId),
  );
  if (!target) return gaps;

  const result: MasteryResult = hinted ? 'correct_after_hint' : 'natural_spontaneous';
  const updated: LanguageGap = {
    ...target,
    timesPracticed: target.timesPracticed + (hinted ? 1 : 0),
    timesUsedCorrectly: target.timesUsedCorrectly + (hinted ? 0 : 1),
    confidence: Math.max(0.1, target.confidence - 0.2),
    sourceLessons: target.sourceLessons.includes(lessonId)
      ? target.sourceLessons
      : [...target.sourceLessons, lessonId],
    masteryEvidence: [
      ...target.masteryEvidence,
      evidence(result, lessonId, expression, now),
    ],
    updatedAt: now,
  };
  updated.status = deriveStatus(updated);
  return gaps.map((g) => (g.id === target.id ? updated : g));
}

export function openGaps(gaps: LanguageGap[]): LanguageGap[] {
  return gaps.filter((g) => !isAlreadyComfortable(g.status));
}
