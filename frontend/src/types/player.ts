import type { EnglishChunk } from './chunk';
import type { ChunkMastery, LearnerSignals, WeaknessProfile } from './mastery';
import { EMPTY_SIGNALS } from './mastery';

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

  /** chunks discovered from the player's own output (library chunks live in data/) */
  personalChunks: EnglishChunk[];
  /** retrieval mastery per chunk id — the core learning record */
  chunkMastery: ChunkMastery[];
  /** per-skill strength, used to bias future retrieval */
  weakness: WeaknessProfile[];
  /** coarse learner-level signals */
  signals: LearnerSignals;

  /** chapter id -> number of completed lessons in that chapter */
  chapterProgress: Record<string, number>;
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
  personalChunks: [],
  chunkMastery: [],
  weakness: [],
  signals: EMPTY_SIGNALS,
  chapterProgress: {},
  settings: DEFAULT_SETTINGS,
};

/** 250 XP per level. */
export function levelForXp(xp: number): number {
  return Math.floor(xp / 250) + 1;
}

export function xpWithinLevel(xp: number): { current: number; needed: number } {
  return { current: xp % 250, needed: 250 };
}
