import type { Lesson, LessonCharacter } from '../../types/lesson';
import type {
  RetrievalAudience,
  RetrievalContext,
  RetrievalFormality,
  RetrievalPurpose,
  RetrievalSetting,
} from '../../types/chunk';

/* ==========================================================================
 * Retrieval context (§12/§14).
 *
 * M2 records it so every retrieval is tagged with the situation it happened
 * in — that's what lets mastery tell transfer apart from repetition. M3 will
 * deliberately vary these fields to generate new situations.
 * ======================================================================== */

const ROLE_AUDIENCE: { test: RegExp; audience: RetrievalAudience }[] = [
  { test: /manager|director|lead/i, audience: 'manager' },
  { test: /product manager|\bpm\b/i, audience: 'pm' },
  { test: /client|customer/i, audience: 'client' },
  { test: /tpm|program/i, audience: 'pm' },
];

export function audienceForCharacter(character?: LessonCharacter): RetrievalAudience {
  const role = character?.role ?? '';
  for (const entry of ROLE_AUDIENCE) {
    if (entry.test.test(role)) return entry.audience;
  }
  return 'coworker';
}

const BACKGROUND_SETTING: { test: RegExp; setting: RetrievalSetting }[] = [
  { test: /meeting/i, setting: 'meeting' },
  { test: /kitchen|coffee|lobby/i, setting: 'casual' },
];

export function settingForLesson(lesson: Lesson): RetrievalSetting {
  const bg = lesson.scene.background ?? '';
  for (const entry of BACKGROUND_SETTING) {
    if (entry.test.test(bg)) return entry.setting;
  }
  return 'office';
}

const SKILL_PURPOSE: Record<string, RetrievalPurpose> = {
  expressing_uncertainty: 'respond',
  asking_clarification: 'clarify',
  making_suggestions: 'suggest',
  softening_disagreement: 'disagree',
  explaining_progress: 'explain',
  explaining_blockers: 'solve_problem',
  giving_opinions: 'respond',
  giving_timeline: 'explain',
  small_talk: 'respond',
  handling_misunderstanding: 'clarify',
  following_up: 'respond',
  asking_for_help: 'solve_problem',
};

export function purposeForSkill(skill: string): RetrievalPurpose {
  return SKILL_PURPOSE[skill] ?? 'respond';
}

function formalityFor(audience: RetrievalAudience, setting: RetrievalSetting): RetrievalFormality {
  if (audience === 'client') return 'formal';
  if (setting === 'casual') return 'casual';
  if (audience === 'manager' || setting === 'meeting') return 'professional';
  return 'professional';
}

/** Build the context describing where a retrieval is taking place. */
export function buildRetrievalContext(
  lesson: Lesson,
  character: LessonCharacter | undefined,
  skill: string,
): RetrievalContext {
  const audience = audienceForCharacter(character);
  const setting = settingForLesson(lesson);
  return {
    audience,
    setting,
    purpose: purposeForSkill(skill),
    urgency: 'normal',
    formality: formalityFor(audience, setting),
  };
}
