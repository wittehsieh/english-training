import { SKILL_IDS, type SkillId } from '../../types/chunk';
import type {
  ChunkMastery,
  LearnerSignals,
  RetrievalEvidence,
  WeaknessProfile,
} from '../../types/mastery';
import { retrievalStrength } from './chunkMastery';

/* ==========================================================================
 * Personal weakness map (§19).
 *
 * This is NOT a report card. It exists so the retrieval engine can bias
 * practice toward the communication skills the player actually struggles with.
 * ======================================================================== */

const RECENT_FAILURE_DECAY = 0.5;

export function emptyWeakness(skillId: SkillId): WeaknessProfile {
  return { skillId, score: 0, attempts: 0, successes: 0, recentFailures: 0 };
}

export function ensureAllSkills(profiles: WeaknessProfile[]): WeaknessProfile[] {
  const bySkill = new Map(profiles.map((p) => [p.skillId, p]));
  return SKILL_IDS.map((id) => bySkill.get(id) ?? emptyWeakness(id));
}

/**
 * Fold one retrieval attempt into the skill this chunk trains.
 * `score` is a smoothed success rate weighted by how little help was needed.
 */
export function recordSkillAttempt(
  profiles: WeaknessProfile[],
  skillId: SkillId,
  ev: RetrievalEvidence,
): WeaknessProfile[] {
  const all = ensureAllSkills(profiles);
  const strength = retrievalStrength(ev);
  const succeeded = ev.outcome !== 'failed';

  return all.map((p) => {
    if (p.skillId !== skillId) return p;

    const attempts = p.attempts + 1;
    const successes = p.successes + (succeeded ? 1 : 0);
    const recentFailures = succeeded
      ? p.recentFailures * RECENT_FAILURE_DECAY
      : p.recentFailures + 1;

    // Exponential moving average so recent performance dominates.
    const alpha = 1 / Math.min(attempts, 8);
    const score = p.score + alpha * (strength - p.score);

    return {
      skillId: p.skillId,
      attempts,
      successes,
      recentFailures: Math.round(recentFailures * 100) / 100,
      score: Math.max(0, Math.min(1, Math.round(score * 1000) / 1000)),
    };
  });
}

/** Weakest skills first — only counting skills the player has actually met. */
export function weakestSkills(
  profiles: WeaknessProfile[],
  limit = 3,
): WeaknessProfile[] {
  return ensureAllSkills(profiles)
    .filter((p) => p.attempts > 0)
    .sort((a, b) => a.score - b.score || b.recentFailures - a.recentFailures)
    .slice(0, limit);
}

/** Learner-level signals recomputed from the whole mastery store. */
export function computeSignals(
  masteries: ChunkMastery[],
  previous: LearnerSignals,
  opts: { translationLikeTurn?: boolean; responseSeconds?: number } = {},
): LearnerSignals {
  const retrieved = masteries.filter((m) => m.lastRetrievedAt);
  const chunkRetrievalStrength =
    retrieved.length === 0
      ? 0
      : Math.round(
          (retrieved.reduce((sum, m) => sum + m.score, 0) / retrieved.length / 100) *
            1000,
        ) / 1000;

  const spontaneousUsage = masteries.reduce((sum, m) => sum + m.spontaneousUsage, 0);

  let directTranslationTendency = previous.directTranslationTendency;
  if (opts.translationLikeTurn !== undefined) {
    const target = opts.translationLikeTurn ? 1 : 0;
    directTranslationTendency =
      Math.round((previous.directTranslationTendency + 0.15 * (target - previous.directTranslationTendency)) * 1000) /
      1000;
  }

  let responseSpeedSeconds = previous.responseSpeedSeconds;
  if (opts.responseSeconds !== undefined && Number.isFinite(opts.responseSeconds)) {
    responseSpeedSeconds =
      previous.responseSpeedSeconds === null
        ? Math.round(opts.responseSeconds * 10) / 10
        : Math.round((previous.responseSpeedSeconds * 0.7 + opts.responseSeconds * 0.3) * 10) / 10;
  }

  return {
    directTranslationTendency,
    chunkRetrievalStrength,
    spontaneousUsage,
    responseSpeedSeconds,
  };
}
