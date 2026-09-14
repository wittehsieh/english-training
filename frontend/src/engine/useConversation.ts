import { useCallback, useEffect, useRef, useState } from 'react';
import { conversationService, ConversationError } from '../services/conversation';
import type {
  AiTurnResult,
  ChunkMastery,
  EnglishChunk,
  LanguageGapObservation,
  ConversationState,
  Lesson,
  ResponseEvaluation,
  RetrievalEvidence,
} from '../types';
import { ConversationEngine, type LessonProgress } from './ConversationEngine';
import { decideNextAction } from './learning/learningEngine';
import { buildRetrievalContext } from './retrieval/context';
import {
  elapsedSeconds,
  registerAttempt,
  resolveRetrieval,
  startRetrieval,
  useHint as escalateHint,
  type RetrievalSession,
} from './retrieval/retrievalEngine';
import { buildHint, type Hint } from './retrieval/hints';

export interface LessonSummary {
  lessonId: string;
  score: number;
  xpEarned: number;
  turns: number;
  ratings: ResponseEvaluation['overall'][];
  /** gaps surfaced this lesson (subset shown on the result screen) */
  identifiedGaps: LanguageGapObservation[];
  /** phrase-pattern ids the player used naturally */
  patternsUsedNaturally: string[];
}

type Phase = 'loading' | 'ready' | 'sending' | 'complete' | 'error';

/** A discovered expression waiting for the player to acknowledge it. */
export interface PendingDiscovery {
  chunk: EnglishChunk;
  situation: string;
  stage: RetrievalSession['stage'];
}

interface UseConversation {
  phase: Phase;
  error: string | null;
  state: ConversationState | null;
  progress: LessonProgress | null;
  lastResult: AiTurnResult | null;
  summary: LessonSummary | null;
  send: (message: string) => Promise<void>;
  retry: () => void;
  /** the discovery card currently on screen, if any */
  pendingDiscovery: PendingDiscovery | null;
  /** player tapped "got it" — the NPC then poses the retrieval situation */
  acknowledgeDiscovery: () => void;
  /** the live retrieval, if the player is mid-production */
  retrieval: RetrievalSession | null;
  /** the hint currently revealed (level 'none' means nothing shown) */
  hint: Hint | null;
  requestHint: () => void;
}

export interface ConversationHooks {
  masteryFor: (chunkId: string) => ChunkMastery | undefined;
  chunkFor: (phrase: string) => EnglishChunk | undefined;
  onRetrievalResolved: (
    chunkId: string,
    evidence: RetrievalEvidence,
    chunk: EnglishChunk,
    seconds: number,
  ) => void;
  onChunkEncountered: (chunk: EnglishChunk) => void;
}

const RATING_SCORE: Record<ResponseEvaluation['overall'], number> = {
  excellent: 1,
  good: 0.8,
  ok: 0.55,
  poor: 0.2,
};

function buildSummary(
  lesson: Lesson,
  engine: ConversationEngine,
  ratings: ResponseEvaluation['overall'][],
): LessonSummary {
  const score =
    ratings.length === 0
      ? 0
      : Math.round(
          (ratings.reduce((sum, r) => sum + RATING_SCORE[r], 0) / ratings.length) *
            100,
        );

  return {
    lessonId: lesson.id,
    score,
    xpEarned: engine.state.xp,
    turns: engine.getProgress().playerTurns,
    ratings,
    identifiedGaps: engine.state.identifiedGaps,
    patternsUsedNaturally: engine.state.patternsUsedNaturally,
  };
}

export function useConversation(
  lesson: Lesson,
  comfortableConcepts: string[],
  hooks: ConversationHooks,
): UseConversation {
  const engineRef = useRef<ConversationEngine | null>(null);
  const ratingsRef = useRef<ResponseEvaluation['overall'][]>([]);
  // captured once per boot so changing profile mid-lesson doesn't churn
  const conceptsRef = useRef<string[]>(comfortableConcepts);
  conceptsRef.current = comfortableConcepts;
  const hooksRef = useRef(hooks);
  hooksRef.current = hooks;

  const retrievalsRef = useRef(0);
  const lastRetrievalTurnRef = useRef<number | null>(null);
  const [pendingDiscovery, setPendingDiscovery] = useState<PendingDiscovery | null>(null);
  const [retrieval, setRetrieval] = useState<RetrievalSession | null>(null);

  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [, forceRender] = useState(0);
  const [lastResult, setLastResult] = useState<AiTurnResult | null>(null);
  const [summary, setSummary] = useState<LessonSummary | null>(null);

  const bump = useCallback(() => forceRender((n) => n + 1), []);

  const boot = useCallback(async () => {
    setPhase('loading');
    setError(null);
    ratingsRef.current = [];
    retrievalsRef.current = 0;
    lastRetrievalTurnRef.current = null;
    setPendingDiscovery(null);
    setRetrieval(null);
    setLastResult(null);
    setSummary(null);
    try {
      engineRef.current = await ConversationEngine.start(
        conversationService,
        lesson,
        conceptsRef.current,
      );
      setPhase('ready');
      bump();
    } catch (err) {
      setError(messageFor(err));
      setPhase('error');
    }
  }, [lesson, bump]);

  useEffect(() => {
    void boot();
  }, [boot]);

  const send = useCallback(
    async (message: string) => {
      const engine = engineRef.current;
      if (!engine || phase === 'sending' || phase === 'complete') return;

      const active = retrieval;

      setPhase('sending');
      setError(null);
      setLastResult(null);
      if (active) setRetrieval(registerAttempt(active));
      bump();

      try {
        const result = await engine.send(
          message,
          active
            ? {
                retrieval: {
                  targetChunkId: active.chunkId,
                  targetPhrase: active.chunk.phrase,
                  ...(active.chunk.pattern ? { targetPattern: active.chunk.pattern } : {}),
                  stage: active.stage,
                  hintLevel: active.hintLevel,
                  situation: active.situation,
                  context: active.context,
                },
              }
            : {},
        );
        ratingsRef.current.push(result.evaluation.overall);
        setLastResult(result);

        if (active) {
          // The player just tried to produce the chunk. The client — not the
          // model — turns that into mastery evidence.
          const evaluation =
            result.retrievalEvaluation ?? {
              produced: true,
              usedTargetPattern: false,
              note: '',
            };
          const evidence = resolveRetrieval(active, evaluation);
          hooksRef.current.onRetrievalResolved(
            active.chunkId,
            evidence,
            active.chunk,
            elapsedSeconds(active),
          );
          retrievalsRef.current += 1;
          lastRetrievalTurnRef.current = engine.getProgress().playerTurns;
          setRetrieval(null);
        } else {
          // Free conversation: the Learning Engine decides whether the AI's
          // proposal actually becomes a learning moment.
          const action = decideNextAction({
            discovery: result.discovery,
            playerTurns: engine.getProgress().playerTurns,
            lastRetrievalTurn: lastRetrievalTurnRef.current,
            retrievalsThisLesson: retrievalsRef.current,
            masteryFor: hooksRef.current.masteryFor,
            existingChunk: hooksRef.current.chunkFor,
          });
          if (action.kind === 'discover') {
            setPendingDiscovery({
              chunk: action.chunk,
              situation: action.situation,
              stage: action.stage,
            });
          }
        }

        if (engine.isComplete) {
          setSummary(buildSummary(lesson, engine, ratingsRef.current));
          setPhase('complete');
        } else {
          setPhase('ready');
        }
        bump();
      } catch (err) {
        setError(messageFor(err));
        setPhase('ready');
        bump();
      }
    },
    [phase, lesson, bump, retrieval],
  );

  /**
   * The player has read the discovery card. The NPC now poses a NEW situation
   * and the expression disappears — this is the retrieval, not a repeat-after-me.
   */
  const acknowledgeDiscovery = useCallback(() => {
    const engine = engineRef.current;
    const pending = pendingDiscovery;
    if (!engine || !pending) return;

    hooksRef.current.onChunkEncountered(pending.chunk);

    const speaker = engine.lesson.conversation.opening.characterId;
    engine.pushCharacterTurn(pending.situation, speaker, 'talking');

    setRetrieval(
      startRetrieval({
        chunk: pending.chunk,
        stage: pending.stage,
        situation: pending.situation,
        context: buildRetrievalContext(
          engine.lesson,
          engine.lesson.characters[0],
          pending.chunk.skill,
        ),
        lessonId: engine.lesson.id,
      }),
    );
    setPendingDiscovery(null);
    setLastResult(null);
    bump();
  }, [pendingDiscovery, bump]);

  const requestHint = useCallback(() => {
    setRetrieval((current) => (current ? escalateHint(current) : current));
  }, []);

  const hint: Hint | null = retrieval
    ? buildHint(retrieval.chunk, retrieval.hintLevel)
    : null;

  return {
    phase,
    error,
    state: engineRef.current?.state ?? null,
    progress: engineRef.current?.getProgress() ?? null,
    lastResult,
    summary,
    send,
    retry: () => void boot(),
    pendingDiscovery,
    acknowledgeDiscovery,
    retrieval,
    hint,
    requestHint,
  };
}

function messageFor(err: unknown): string {
  if (err instanceof ConversationError) {
    switch (err.kind) {
      case 'input':
        return 'Type something before sending.';
      case 'timeout':
        return 'That took too long. Let’s try again.';
      case 'network':
        return 'Connection problem. Check your network and retry.';
      case 'unavailable':
        return 'The coaching service is unavailable right now. Try again shortly.';
      default:
        return 'Something went wrong. Let’s try that again.';
    }
  }
  return 'Something went wrong. Let’s try that again.';
}
