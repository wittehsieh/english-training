import type { LearningObjective, Lesson, ObjectiveState, TargetExpression } from '../types';

/* ==========================================================================
 * The dialogue hint should track what the player still hasn't done, not just
 * cycle by turn count. Lessons often have far more objectives than the player
 * expects to hit in one line, so telling them exactly which one is next —
 * in lesson order — makes the mission feel achievable instead of vague.
 * ======================================================================== */

/** The first objective the player has not demonstrated yet, in lesson order. */
export function nextUnmetObjective(
  lesson: Lesson,
  objectives: ObjectiveState | undefined,
): LearningObjective | null {
  if (!objectives) return lesson.learningObjectives[0] ?? null;
  return lesson.learningObjectives.find((o) => !objectives[o.id]?.completed) ?? null;
}

/**
 * A concrete example for the current objective. This used to be guessed by
 * scoring keyword overlap between the (generic, humanized) objective
 * description and each target expression — which routinely found no overlap
 * and silently fell back to the same first expression for every objective in
 * a lesson, making the hint look identical turn after turn.
 *
 * Curriculum data now names the expression explicitly per objective
 * (`objectiveExpressions` in curriculum.json, resolved onto
 * `objective.example` in the loader), so this is just a lookup with a
 * fallback for the rare id a lesson hasn't mapped yet.
 */
export function pickExampleExpression(
  lesson: Lesson,
  objective: LearningObjective | null,
): TargetExpression | null {
  const pool = lesson.targetExpressions;
  if (pool.length === 0) return null;
  return objective?.example ?? pool[0] ?? null;
}
