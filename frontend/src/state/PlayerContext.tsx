import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { storageService } from '../services/storage/StorageService';
import {
  EMPTY_PROFILE,
  levelForXp,
  type CompletedLessonRecord,
  type LearnedPhraseRecord,
  type PlayerProfile,
  type PlayerSettings,
  type TargetPhrase,
} from '../types';

export interface CompleteLessonInput {
  lessonId: string;
  categoryId: string;
  score: number;
  xpEarned: number;
  phrases: { phrase: TargetPhrase; sourceLessonId: string }[];
}

interface PlayerContextValue {
  profile: PlayerProfile;
  level: number;
  isLessonCompleted: (lessonId: string) => boolean;
  completeLesson: (input: CompleteLessonInput) => void;
  updateSettings: (patch: Partial<PlayerSettings>) => void;
  resetProgress: () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<PlayerProfile>(() =>
    storageService.loadProfile(),
  );

  useEffect(() => {
    storageService.saveProfile(profile);
  }, [profile]);

  const isLessonCompleted = useCallback(
    (lessonId: string) =>
      profile.completedLessons.some((l) => l.lessonId === lessonId),
    [profile.completedLessons],
  );

  const completeLesson = useCallback((input: CompleteLessonInput) => {
    setProfile((prev) => {
      const alreadyDone = prev.completedLessons.some(
        (l) => l.lessonId === input.lessonId,
      );
      const now = new Date().toISOString();

      const record: CompletedLessonRecord = {
        lessonId: input.lessonId,
        score: input.score,
        xpEarned: input.xpEarned,
        completedAt: now,
      };

      const learnedPhrases: LearnedPhraseRecord[] = [...prev.learnedPhrases];
      for (const { phrase, sourceLessonId } of input.phrases) {
        if (!learnedPhrases.some((p) => p.id === phrase.id)) {
          learnedPhrases.push({ ...phrase, sourceLessonId, learnedAt: now });
        }
      }

      const categoryProgress = { ...prev.categoryProgress };
      if (!alreadyDone) {
        categoryProgress[input.categoryId] =
          (categoryProgress[input.categoryId] ?? 0) + 1;
      }

      const xp = prev.xp + input.xpEarned;

      return {
        ...prev,
        xp,
        level: levelForXp(xp),
        completedLessons: alreadyDone
          ? prev.completedLessons.map((l) =>
              l.lessonId === input.lessonId ? record : l,
            )
          : [...prev.completedLessons, record],
        learnedPhrases,
        categoryProgress,
      };
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<PlayerSettings>) => {
    setProfile((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...patch },
    }));
  }, []);

  const resetProgress = useCallback(() => {
    storageService.clear();
    setProfile({ ...EMPTY_PROFILE });
  }, []);

  const value = useMemo<PlayerContextValue>(
    () => ({
      profile,
      level: levelForXp(profile.xp),
      isLessonCompleted,
      completeLesson,
      updateSettings,
      resetProgress,
    }),
    [profile, isLessonCompleted, completeLesson, updateSettings, resetProgress],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within <PlayerProvider>');
  return ctx;
}
