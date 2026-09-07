import curriculumJson from './curriculum/curriculum.json';
import phrasePatternsJson from './curriculum/phrasePatterns.json';
import learningModelJson from './curriculum/learningModel.json';
import presentationJson from './curriculum/presentationOverrides.json';
import { CHARACTERS, DEFAULT_CHARACTER_ID } from './characters';
import type {
  Chapter,
  CharacterEmotion,
  Curriculum,
  CurriculumLesson,
  LearningModelFile,
  LearningObjective,
  Lesson,
  LessonChapter,
  LessonCharacter,
  PhrasePattern,
  PhrasePatternFile,
  TargetExpression,
} from '../types';

/* ==========================================================================
 * Curriculum loader + adapter.
 *
 * Raw curriculum JSON  ──►  runtime `Lesson[]`
 *
 * The curriculum describes WHAT to teach (mission, objectives, target
 * expressions). This file adds the visual-novel presentation (scene, coworker,
 * opening line) from `presentationOverrides.json`, falling back to deterministic
 * defaults. Nothing here is hard-coded in a component.
 * ======================================================================== */

const curriculum = curriculumJson as unknown as Curriculum;
const phrasePatternFile = phrasePatternsJson as unknown as PhrasePatternFile;

export const LEARNING_MODEL = learningModelJson as unknown as LearningModelFile;
export const PHRASE_PATTERNS: PhrasePattern[] = phrasePatternFile.patterns;
export const CURRICULUM_VERSION = curriculum.version;
export const DESIGN_PRINCIPLE = curriculum.designPrinciple;

interface PresentationOverride {
  characterId?: string;
  background?: string;
  position?: 'left' | 'center' | 'right';
  openingText?: string;
  openingEmotion?: CharacterEmotion;
}

const overrides = (presentationJson as { lessons: Record<string, PresentationOverride> })
  .lessons;

/* ---------- objective id -> human description ---------- */

const OBJECTIVE_LIBRARY: Record<string, string> = {
  greet_coworker: 'Greet a coworker naturally',
  small_talk: 'Make brief small talk',
  start_small_talk: 'Start small talk',
  describe_current_work: 'Say what you are working on',
  describe_today_plan: 'Say what you plan to do today',
  describe_plan: 'Describe your plan',
  ask_follow_up: 'Ask a follow-up question',
  show_interest: 'Show interest in what they said',
  keep_conversation_going: 'Keep the conversation going',
  end_conversation_naturally: 'End the conversation naturally',
  close_conversation: 'Close the conversation politely',
  talk_about_past_events: 'Talk about something you did',
  introduce_self: 'Introduce yourself',
  describe_role: 'Describe your role',
  ask_about_role: "Ask about the other person's role",
  ask_availability: 'Ask if they have time',
  suggest_time: 'Suggest a time to talk',
  decline_temporarily: 'Politely say "not right now"',
  describe_progress: 'Describe your current progress',
  summarize_status: 'Summarise where things stand',
  explain_blocker: 'Explain what is blocking you',
  identify_blocker: 'Identify the blocker',
  ask_for_help: 'Ask for help',
  make_specific_request: 'Make a specific request',
  give_eta: 'Give an estimated completion time',
  give_timeline: 'Give a timeline',
  report_delay: 'Report that something is late',
  revise_timeline: 'Revise the timeline',
  negotiate_timeline: 'Negotiate a new date',
  describe_problem: 'Describe the problem',
  describe_cause: 'Describe the cause',
  explain_cause: 'Explain the cause',
  propose_solution: 'Propose a solution',
  describe_next_step: 'Describe the next step',
  describe_impact: 'Describe the impact',
  explain_impact: 'Explain the impact',
  stay_polite: 'Stay polite and professional',
  follow_up: 'Follow up on a pending item',
  ask_status: 'Ask for a status update',
  explain_dependency: 'Explain what you depend on',
};

function humanizeObjective(id: string): string {
  return (
    OBJECTIVE_LIBRARY[id] ??
    id.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
  );
}

/* ---------- target expression -> phrase pattern link ---------- */

/** head text of a pattern, e.g. "wait for + thing" -> "wait for" */
function patternHead(pattern: string): string {
  return pattern.split('+')[0]!.trim().toLowerCase();
}

export function findPattern(expression: string): PhrasePattern | undefined {
  const lower = expression.toLowerCase();
  return PHRASE_PATTERNS.find((p) => {
    const head = patternHead(p.pattern);
    return head.length > 2 && lower.includes(head);
  });
}

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'expr'
  );
}

function toTargetExpression(text: string): TargetExpression {
  const pattern = findPattern(text);
  return {
    id: slug(text),
    text,
    patternId: pattern?.id,
    note: pattern?.pattern,
  };
}

/* ---------- presentation defaults ---------- */

const CHAPTER_META: Record<string, { icon: string; scenes: string[]; cast: string[] }> = {
  'everyday-office': {
    icon: '☕',
    scenes: ['kitchen', 'coffee-area', 'office-morning', 'lobby'],
    cast: ['daniel', 'priya', 'emily', 'alex'],
  },
  'project-communication': {
    icon: '📊',
    scenes: ['office-morning', 'meeting-room', 'office-afternoon'],
    cast: ['emily', 'priya', 'nina', 'mike'],
  },
};

const MINUTES_BY_DIFFICULTY = { easy: 6, medium: 9, hard: 12 } as const;

function characterFor(id: string, emotion: CharacterEmotion): LessonCharacter {
  const base = CHARACTERS[id] ?? CHARACTERS[DEFAULT_CHARACTER_ID]!;
  return { ...base, expression: emotion, position: 'center' };
}

function fallbackOpening(lesson: CurriculumLesson): string {
  const first = lesson.targetExpressions[0];
  return first && first.endsWith('?')
    ? first
    : `Hey, got a second? ${lesson.mission.replace(/\.$/, '')}?`;
}

function toRuntimeLesson(
  raw: CurriculumLesson,
  chapter: Chapter,
  indexInChapter: number,
): Lesson {
  const meta = CHAPTER_META[chapter.id] ?? {
    icon: '💬',
    scenes: ['office-morning'],
    cast: [DEFAULT_CHARACTER_ID],
  };
  const override = overrides[raw.id] ?? {};

  const background =
    override.background ?? meta.scenes[indexInChapter % meta.scenes.length]!;
  const characterId = override.characterId ?? meta.cast[indexInChapter % meta.cast.length]!;
  const openingEmotion: CharacterEmotion = override.openingEmotion ?? 'talking';
  const openingText = override.openingText ?? fallbackOpening(raw);

  const objectives: LearningObjective[] = raw.learningObjectives.map((id) => ({
    id,
    description: humanizeObjective(id),
  }));

  // Complete when the player has genuinely engaged every objective and had a
  // real back-and-forth. Free-form answers advance objectives; exact phrases
  // are never required.
  const requiredObjectives = objectives.map((o) => o.id);
  const minimumTurns = Math.max(3, Math.min(requiredObjectives.length, 5));

  return {
    id: raw.id,
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    title: raw.title,
    mission: raw.mission,
    description: raw.mission,
    difficulty: raw.difficulty,
    estimatedMinutes: MINUTES_BY_DIFFICULTY[raw.difficulty],
    xp: raw.xp,
    scene: { id: `${background}-${raw.id}`, background, timeOfDay: 'morning' },
    characters: [characterFor(characterId, openingEmotion)],
    learningObjectives: objectives,
    targetExpressions: raw.targetExpressions.map(toTargetExpression),
    conversation: {
      opening: { characterId, text: openingText, emotion: openingEmotion },
    },
    completionCriteria: { requiredObjectives, minimumTurns },
  };
}

/* ---------- public API (kept stable for the rest of the app) ---------- */

export const CHAPTERS: LessonChapter[] = curriculum.chapters.map((chapter) => ({
  id: chapter.id,
  title: chapter.title,
  icon: CHAPTER_META[chapter.id]?.icon ?? '💬',
  lessons: chapter.lessons.map((raw, i) => toRuntimeLesson(raw, chapter, i)),
}));

export const LESSONS: Lesson[] = CHAPTERS.flatMap((c) => c.lessons);

export function getLesson(lessonId: string): Lesson | undefined {
  return LESSONS.find((lesson) => lesson.id === lessonId);
}

export function getChapter(chapterId: string): LessonChapter | undefined {
  return CHAPTERS.find((chapter) => chapter.id === chapterId);
}

export function getCharacter(
  lesson: Lesson,
  characterId: string,
): LessonCharacter | undefined {
  return lesson.characters.find((character) => character.id === characterId);
}

export function getPhrasePattern(patternId: string): PhrasePattern | undefined {
  return PHRASE_PATTERNS.find((p) => p.id === patternId);
}
