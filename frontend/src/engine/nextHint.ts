import type { LearningObjective, Lesson, ObjectiveState, TargetExpression } from '../types';

/* ==========================================================================
 * The dialogue hint should track what the player still hasn't done, not just
 * cycle by turn count. Lessons often have far more objectives than the player
 * expects to hit in one line, so telling them exactly which one is next —
 * in lesson order — makes the mission feel achievable instead of vague.
 * ======================================================================== */

const STOP = new Set([
  'the', 'a', 'an', 'to', 'of', 'and', 'or', 'is', 'are', 'be', 'your', 'you',
  'it', 'this', 'that', 'with', 'for', 'on', 'in', 'at', 'what', 'how', 'do',
  'did', 'does', 'not', 'if', 'so', 'up', 'about',
]);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/\.\.\.|…/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/** The first objective the player has not demonstrated yet, in lesson order. */
export function nextUnmetObjective(
  lesson: Lesson,
  objectives: ObjectiveState | undefined,
): LearningObjective | null {
  if (!objectives) return lesson.learningObjectives[0] ?? null;
  return lesson.learningObjectives.find((o) => !objectives[o.id]?.completed) ?? null;
}

/**
 * A best-effort example for the current objective, picked by keyword overlap
 * with its description. Curriculum data doesn't map expressions to objectives
 * 1:1, so this only returns something when it actually shares a real word
 * with the objective — an irrelevant guess is worse than no example at all,
 * and the "🎯 Try to" goal line already carries the hint on its own.
 */
export function pickExampleExpression(
  lesson: Lesson,
  objective: LearningObjective | null,
): TargetExpression | null {
  const pool = lesson.targetExpressions;
  if (pool.length === 0) return null;
  // No objective context at all (not even a "first objective") — a generic
  // opener is reasonable here since there's nothing to score against.
  if (!objective) return pool[0] ?? null;

  const target = new Set(words(objective.description));
  if (target.size === 0) return null;

  let best: TargetExpression | null = null;
  let bestScore = 0;
  for (const expr of pool) {
    const score = words(expr.text).filter((w) => target.has(w)).length;
    if (score > bestScore) {
      bestScore = score;
      best = expr;
    }
  }
  return best;
}
