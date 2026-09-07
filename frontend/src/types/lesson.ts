import type { CharacterExpression, CharacterPosition } from './assets';
import type { CurriculumDifficulty, TargetExpression } from './curriculum';

/**
 * The RUNTIME lesson shape the game plays.
 *
 * It is built by `src/data/curriculum.ts` from the raw curriculum JSON plus a
 * deterministic presentation layer (scene + character + opening line). Lesson
 * content is never hard-coded in components.
 *
 * `targetExpressions` are AI guidance, NOT answer keys — the player replies in
 * free-form English and any response that communicates the intent is accepted.
 */

export type Difficulty = CurriculumDifficulty;

/** Expressions ARE the emotion set (see assets.ts). */
export type CharacterEmotion = CharacterExpression;

export interface LessonScene {
  id: string;
  /** Background asset id — resolved to a URL by AssetManager. */
  background: string;
  backgroundPosition?: string;
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
}

export interface LessonCharacter {
  /** Character asset id — resolved by AssetManager. */
  id: string;
  name: string;
  role: string;
  personality: string[];
  expression?: CharacterExpression;
  position?: CharacterPosition;
}

export interface LearningObjective {
  id: string;
  description: string;
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
  chapterId: string;
  chapterTitle: string;
  title: string;
  /** player-facing goal, from the curriculum */
  mission: string;
  description: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  xp: number;
  scene: LessonScene;
  characters: LessonCharacter[];
  learningObjectives: LearningObjective[];
  targetExpressions: TargetExpression[];
  conversation: {
    opening: ConversationOpening;
  };
  completionCriteria: CompletionCriteria;
}

export interface LessonChapter {
  id: string;
  title: string;
  icon: string;
  lessons: Lesson[];
}
