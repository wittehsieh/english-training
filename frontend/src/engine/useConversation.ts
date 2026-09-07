import { useCallback, useEffect, useRef, useState } from 'react';
import { conversationService, ConversationError } from '../services/conversation';
import type {
  AiTurnResult,
  ConversationState,
  LanguageGapObservation,
  Lesson,
  ResponseEvaluation,
} from '../types';
import { ConversationEngine, type LessonProgress } from './ConversationEngine';

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

interface UseConversation {
  phase: Phase;
  error: string | null;
  state: ConversationState | null;
  progress: LessonProgress | null;
  lastResult: AiTurnResult | null;
  summary: LessonSummary | null;
  send: (message: string) => Promise<void>;
  retry: () => void;
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
): UseConversation {
  const engineRef = useRef<ConversationEngine | null>(null);
  const ratingsRef = useRef<ResponseEvaluation['overall'][]>([]);
  // captured once per boot so changing profile mid-lesson doesn't churn
  const conceptsRef = useRef<string[]>(comfortableConcepts);
  conceptsRef.current = comfortableConcepts;

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

      setPhase('sending');
      setError(null);
      setLastResult(null);
      bump();

      try {
        const result = await engine.send(message);
        ratingsRef.current.push(result.evaluation.overall);
        setLastResult(result);

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
    [phase, lesson, bump],
  );

  return {
    phase,
    error,
    state: engineRef.current?.state ?? null,
    progress: engineRef.current?.getProgress() ?? null,
    lastResult,
    summary,
    send,
    retry: () => void boot(),
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
