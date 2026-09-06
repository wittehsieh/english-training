import type { TargetPhrase } from './lesson';

export interface LearnedPhraseRecord extends TargetPhrase {
  sourceLessonId: string;
  learnedAt: string;
}

export interface CompletedLessonRecord {
  lessonId: string;
  score: number;
  xpEarned: number;
  completedAt: string;
}

export interface PlayerProfile {
  xp: number;
  level: number;
  completedLessons: CompletedLessonRecord[];
  learnedPhrases: LearnedPhraseRecord[];
  /** category id -> number of completed lessons in that category */
  categoryProgress: Record<string, number>;
  settings: PlayerSettings;
}

export interface PlayerSettings {
  showLearningHints: boolean;
  textSize: 'small' | 'medium' | 'large';
  reducedMotion: boolean;
}

export const DEFAULT_SETTINGS: PlayerSettings = {
  showLearningHints: true,
  textSize: 'medium',
  reducedMotion: false,
};

export const EMPTY_PROFILE: PlayerProfile = {
  xp: 0,
  level: 1,
  completedLessons: [],
  learnedPhrases: [],
  categoryProgress: {},
  settings: DEFAULT_SETTINGS,
};

/** 250 XP per level, capped only by content. */
export function levelForXp(xp: number): number {
  return Math.floor(xp / 250) + 1;
}

export function xpWithinLevel(xp: number): { current: number; needed: number } {
  return { current: xp % 250, needed: 250 };
}
