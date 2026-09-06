import type { CharacterExpression, CharacterPosition } from './assets';

/**
 * Lesson content is 100% data-driven — see `src/data/lessons.json`.
 *
 * A lesson describes WHAT to teach (objectives + target phrases + an opening
 * line) and WHICH assets to show (by id — never by file path). It deliberately
 * does NOT script the player's replies; the conversation is generated
 * turn-by-turn by a ConversationService.
 */

export type LessonCategoryId =
  | 'small_talk'
  | 'project_update'
  | 'pm_tpm'
  | 'ux_discussion'
  | 'engineering'
  | 'meetings'
  | 'planning'
  | 'manager_1_1'
  | 'real_world';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

/** Alias kept for conversation code; expressions ARE the emotion set. */
export type CharacterEmotion = CharacterExpression;

export interface LessonScene {
  id: string;
  /** Background asset id — resolved to a URL by AssetManager. */
  background: string;
  /** Optional per-lesson focal point override, e.g. "50% 40%". */
  backgroundPosition?: string;
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
}

export interface LessonCharacter {
  /** Character asset id — resolved by AssetManager. */
  id: string;
  name: string;
  role: string;
  personality: string[];
  /** Expression to show at the start of the lesson. */
  expression?: CharacterExpression;
  position?: CharacterPosition;
}

export interface LearningObjective {
  id: string;
  description: string;
}

export interface TargetPhrase {
  id: string;
  phrase: string;
  /** Short meaning, may be in the learner's first language. */
  meaning: string;
  usage: string;
  example?: string;
}

export interface ConversationOpening {
  characterId: string;
  text: string;
  emotion?: CharacterExpression;
}

export interface CompletionCriteria {
  requiredObjectives: string[];
  minimumTurns: number;
}

export interface Lesson {
  id: string;
  category: LessonCategoryId;
  title: string;
  description: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  scene: LessonScene;
  characters: LessonCharacter[];
  learningObjectives: LearningObjective[];
  targetPhrases: TargetPhrase[];
  conversation: {
    opening: ConversationOpening;
  };
  completionCriteria: CompletionCriteria;
}

export interface LessonCategory {
  id: LessonCategoryId;
  name: string;
  icon: string;
}

export interface LessonData {
  version: string;
  categories: LessonCategory[];
  lessons: Lesson[];
}
