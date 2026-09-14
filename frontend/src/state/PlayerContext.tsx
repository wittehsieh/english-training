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
import { CHUNK_LIBRARY, findLibraryChunkByPhrase, getLibraryChunk } from '../data/chunks';
import {
  isComfortable,
  recordEncounter,
  recordRetrieval,
  recordSpontaneousUse,
} from '../engine/mastery/chunkMastery';
import { computeSignals, recordSkillAttempt } from '../engine/mastery/weakness';
import {
  EMPTY_PROFILE,
  levelForXp,
  type ChunkMastery,
  type CompletedLessonRecord,
  type EnglishChunk,
  type PlayerProfile,
  type PlayerSettings,
  type RetrievalEvidence,
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
  /** every chunk the player could be working on: library + personal */
  allChunks: EnglishChunk[];
  getChunk: (chunkId: string) => EnglishChunk | undefined;
  getMastery: (chunkId: string) => ChunkMastery | undefined;
  /** chunk concepts the player already produces reliably (don't re-teach) */
  comfortableConcepts: string[];
  isLessonCompleted: (lessonId: string) => boolean;
  /** fold one evaluated conversation turn into the learning record */
  observeTurn: (analysis: TurnLanguageAnalysis, lessonId: string) => void;
  /** fold one retrieval attempt into mastery + weakness (M2 uses this) */
  recordRetrievalAttempt: (
    chunkId: string,
    evidence: RetrievalEvidence,
    chunk?: EnglishChunk,
  ) => void;
  completeLesson: (input: CompleteLessonInput) => void;
  updateSettings: (patch: Partial<PlayerSettings>) => void;
  resetProgress: () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

const slug = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<PlayerProfile>(() =>
    storageService.loadProfile(),
  );

  useEffect(() => {
    storageService.saveProfile(profile);
  }, [profile]);

  const allChunks = useMemo(
    () => [...CHUNK_LIBRARY, ...profile.personalChunks],
    [profile.personalChunks],
  );

  const chunkIndex = useMemo(
    () => new Map(allChunks.map((c) => [c.id, c])),
    [allChunks],
  );

  const masteryIndex = useMemo(
    () => new Map(profile.chunkMastery.map((m) => [m.chunkId, m])),
    [profile.chunkMastery],
  );

  const getChunk = useCallback(
    (chunkId: string) => chunkIndex.get(chunkId),
    [chunkIndex],
  );
  const getMastery = useCallback(
    (chunkId: string) => masteryIndex.get(chunkId),
    [masteryIndex],
  );

  const isLessonCompleted = useCallback(
    (lessonId: string) =>
      profile.completedLessons.some((l) => l.lessonId === lessonId),
    [profile.completedLessons],
  );

  /** Apply a mastery + weakness update for one chunk, adding it if personal. */
  const applyChunkUpdate = useCallback(
    (
      prev: PlayerProfile,
      chunkId: string,
      chunk: EnglishChunk | undefined,
      nextMastery: ChunkMastery,
      evidence: RetrievalEvidence | null,
    ): PlayerProfile => {
      const personalChunks =
        chunk && chunk.source === 'personal' &&
        !prev.personalChunks.some((c) => c.id === chunk.id)
          ? [...prev.personalChunks, chunk]
          : prev.personalChunks;

      const chunkMastery = prev.chunkMastery.some((m) => m.chunkId === chunkId)
        ? prev.chunkMastery.map((m) => (m.chunkId === chunkId ? nextMastery : m))
        : [...prev.chunkMastery, nextMastery];

      const resolved = chunk ?? chunkIndex.get(chunkId);
      const weakness =
        evidence && resolved
          ? recordSkillAttempt(prev.weakness, resolved.skill, evidence)
          : prev.weakness;

      return {
        ...prev,
        personalChunks,
        chunkMastery,
        weakness,
        signals: computeSignals(chunkMastery, prev.signals),
      };
    },
    [chunkIndex],
  );

  const observeTurn = useCallback(
    (analysis: TurnLanguageAnalysis, lessonId: string) => {
      setProfile((prev) => {
        let next = prev;
        const now = new Date();
        const masteryOf = (id: string) =>
          next.chunkMastery.find((m) => m.chunkId === id);

        // 1. A gap means the player reached for something they don't have yet.
        //    The better expression becomes a chunk they have now MET (not
        //    mastered), plus evidence they couldn't produce it unaided.
        if (analysis.gap) {
          const gap = analysis.gap;
          const library =
            (gap.patternId ? getLibraryChunk(gap.patternId) : undefined) ??
            findLibraryChunkByPhrase(gap.betterExpression);

          const chunkId = library ? library.id : `personal:${slug(gap.concept) || slug(gap.betterExpression)}`;
          const chunk: EnglishChunk =
            library ??
            chunkIndex.get(chunkId) ?? {
              id: chunkId,
              phrase: gap.betterExpression,
              pattern: gap.concept,
              meaning: gap.explanation || gap.userIntent || gap.concept,
              usage: gap.userIntent,
              category: 'other',
              skill: 'handling_misunderstanding',
              source: 'personal',
              originalAttempt: gap.userAttempt,
              seenInLessons: [lessonId],
              createdAt: now.toISOString(),
            };

          const failure: RetrievalEvidence = {
            at: now.toISOString(),
            stage: 'supported',
            hintLevel: 'none',
            outcome: 'failed',
            lessonId,
            contextKey: `lesson:${lessonId}`,
          };

          const withFailure = recordRetrieval(
            masteryOf(chunkId),
            chunkId,
            failure,
            now,
          );
          const met = recordEncounter(withFailure, chunkId, now);
          next = applyChunkUpdate(next, chunkId, chunk, met, failure);
        }

        // 2. Patterns produced naturally = spontaneous production, the
        //    strongest evidence. Library chunk ids match phrasePattern ids.
        for (const patternId of analysis.patternsUsedNaturally) {
          const chunk = chunkIndex.get(patternId) ?? getLibraryChunk(patternId);
          if (!chunk) continue;
          const updated = recordSpontaneousUse(masteryOf(chunk.id), chunk.id, {
            lessonId,
            contextKey: `lesson:${lessonId}`,
            now,
          });
          const evidence = updated.evidence[updated.evidence.length - 1] ?? null;
          next = applyChunkUpdate(next, chunk.id, chunk, updated, evidence);
        }

        if (next === prev) return prev;
        return {
          ...next,
          signals: computeSignals(next.chunkMastery, prev.signals, {
            translationLikeTurn: !analysis.natural,
          }),
        };
      });
    },
    [applyChunkUpdate, chunkIndex],
  );

  const recordRetrievalAttempt = useCallback(
    (chunkId: string, evidence: RetrievalEvidence, chunk?: EnglishChunk) => {
      setProfile((prev) => {
        const current = prev.chunkMastery.find((m) => m.chunkId === chunkId);
        const updated = recordRetrieval(
          current,
          chunkId,
          evidence,
          new Date(evidence.at),
        );
        return applyChunkUpdate(prev, chunkId, chunk, updated, evidence);
      });
    },
    [applyChunkUpdate],
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

  const comfortableConcepts = useMemo(() => {
    const out = new Set<string>();
    for (const mastery of profile.chunkMastery) {
      if (!isComfortable(mastery)) continue;
      const chunk = chunkIndex.get(mastery.chunkId);
      if (!chunk) continue;
      for (const form of [chunk.id, chunk.phrase, chunk.pattern]) {
        if (!form) continue;
        out.add(form);
        out.add(slug(form));
      }
    }
    return [...out];
  }, [profile.chunkMastery, chunkIndex]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      profile,
      level: levelForXp(profile.xp),
      allChunks,
      getChunk,
      getMastery,
      comfortableConcepts,
      isLessonCompleted,
      observeTurn,
      recordRetrievalAttempt,
      completeLesson,
      updateSettings,
      resetProgress,
    }),
    [
      profile,
      allChunks,
      getChunk,
      getMastery,
      comfortableConcepts,
      isLessonCompleted,
      observeTurn,
      recordRetrievalAttempt,
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
