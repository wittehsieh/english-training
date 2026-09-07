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
  gapKey,
  isAlreadyComfortable,
  recordGapObservation,
  recordSuccessfulUse,
} from '../engine/languageGap';
import { getPhrasePattern } from '../data/curriculum';
import {
  EMPTY_PROFILE,
  levelForXp,
  type CompletedLessonRecord,
  type PlayerProfile,
  type PlayerSettings,
  type TurnLanguageAnalysis,
} from '../types';

export interface CompleteLessonInput {
  lessonId: string;
  chapterId: string;
  score: number;
  xpEarned: number;
}

interface PlayerContextValue {
  profile: PlayerProfile;
  level: number;
  /** gap concepts the learner no longer needs taught (familiar / mastered) */
  comfortableConcepts: string[];
  isLessonCompleted: (lessonId: string) => boolean;
  /** fold one evaluated turn into the Personal Language Gap store */
  observeTurn: (analysis: TurnLanguageAnalysis, lessonId: string) => void;
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

  const observeTurn = useCallback(
    (analysis: TurnLanguageAnalysis, lessonId: string) => {
      setProfile((prev) => {
        const now = new Date().toISOString();
        let gaps = prev.languageGaps;

        // 1. a real gap this turn -> create or reinforce a record
        if (analysis.gap) {
          gaps = recordGapObservation(gaps, analysis.gap, lessonId, now);
        }

        // 2. patterns used naturally -> mastery evidence *only* if we track a
        //    matching gap; otherwise ignored (don't record known language)
        for (const patternId of analysis.patternsUsedNaturally) {
          const pattern = getPhrasePattern(patternId);
          gaps = recordSuccessfulUse(
            gaps,
            { patternId, concept: pattern?.pattern },
            pattern?.pattern ?? patternId,
            lessonId,
            now,
          );
        }

        if (gaps === prev.languageGaps) return prev;
        return { ...prev, languageGaps: gaps };
      });
    },
    [],
  );

  const completeLesson = useCallback((input: CompleteLessonInput) => {
    setProfile((prev) => {
      const alreadyDone = prev.completedLessons.some(
        (l) => l.lessonId === input.lessonId,
      );
      const record: CompletedLessonRecord = {
        lessonId: input.lessonId,
        score: input.score,
        xpEarned: input.xpEarned,
        completedAt: new Date().toISOString(),
      };

      const chapterProgress = { ...prev.chapterProgress };
      if (!alreadyDone) {
        chapterProgress[input.chapterId] =
          (chapterProgress[input.chapterId] ?? 0) + 1;
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
        chapterProgress,
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

  const comfortableConcepts = useMemo(
    () =>
      profile.languageGaps
        .filter((g) => isAlreadyComfortable(g.status))
        .map((g) => g.concept)
        .concat(
          profile.languageGaps
            .filter((g) => isAlreadyComfortable(g.status))
            .map((g) => gapKey(g.concept)),
        ),
    [profile.languageGaps],
  );

  const value = useMemo<PlayerContextValue>(
    () => ({
      profile,
      level: levelForXp(profile.xp),
      comfortableConcepts,
      isLessonCompleted,
      observeTurn,
      completeLesson,
      updateSettings,
      resetProgress,
    }),
    [
      profile,
      comfortableConcepts,
      isLessonCompleted,
      observeTurn,
      completeLesson,
      updateSettings,
      resetProgress,
    ],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within <PlayerProvider>');
  return ctx;
}
