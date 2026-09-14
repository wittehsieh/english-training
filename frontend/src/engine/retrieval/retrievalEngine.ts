import {
  retrievalContextKey,
  type EnglishChunk,
  type RetrievalContext,
} from '../../types/chunk';
import type { RetrievalEvaluation } from '../../types/conversation';
import type {
  HintLevel,
  RetrievalEvidence,
  RetrievalOutcome,
  RetrievalStage,
} from '../../types/mastery';
import { escalate, isMaxHint } from './hints';

/* ==========================================================================
 * Retrieval Engine — the state machine for one "produce it yourself" moment.
 *
 * Deliberately NOT "repeat this sentence" (§13): the player is handed a new
 * situation and has to generate the expression. The engine only tracks how
 * much support was needed; the AI never touches these numbers.
 * ======================================================================== */

export interface RetrievalSession {
  chunkId: string;
  chunk: EnglishChunk;
  /** what we asked of the player */
  stage: RetrievalStage;
  /** how much support they have consumed so far */
  hintLevel: HintLevel;
  /** the NPC's situation, already spoken in the dialogue */
  situation: string;
  context: RetrievalContext;
  lessonId: string;
  startedAt: string;
  attempts: number;
  /** true when this came from the spaced scheduler rather than a discovery */
  delayed: boolean;
}

export interface StartRetrievalInput {
  chunk: EnglishChunk;
  stage: RetrievalStage;
  situation: string;
  context: RetrievalContext;
  lessonId: string;
  delayed?: boolean;
  now?: Date;
}

export function startRetrieval(input: StartRetrievalInput): RetrievalSession {
  return {
    chunkId: input.chunk.id,
    chunk: input.chunk,
    stage: input.stage,
    hintLevel: 'none',
    situation: input.situation,
    context: input.context,
    lessonId: input.lessonId,
    startedAt: (input.now ?? new Date()).toISOString(),
    attempts: 0,
    delayed: input.delayed ?? false,
  };
}

/** One step up the hint ladder. Hints are support, never a penalty screen. */
export function useHint(session: RetrievalSession): RetrievalSession {
  if (isMaxHint(session.hintLevel)) return session;
  return { ...session, hintLevel: escalate(session.hintLevel) };
}

export function registerAttempt(session: RetrievalSession): RetrievalSession {
  return { ...session, attempts: session.attempts + 1 };
}

/**
 * The stage we can honestly credit. Asking for any hint means the pattern was
 * effectively supplied, so it can never count as unaided production.
 */
export function creditedStage(session: RetrievalSession): RetrievalStage {
  if (session.hintLevel === 'none') return session.stage;
  return 'prompted';
}

export function retrievalOutcome(
  evaluation: RetrievalEvaluation,
  hintLevel: HintLevel,
): RetrievalOutcome {
  if (!evaluation.produced) return 'failed';
  // Communicating the meaning some other way is a real success in the
  // conversation, but it is not evidence for THIS chunk.
  if (!evaluation.usedTargetPattern) return 'partial';
  return hintLevel === 'full_answer' ? 'partial' : 'success';
}

/** Turn a finished retrieval into the single piece of evidence it earned. */
export function resolveRetrieval(
  session: RetrievalSession,
  evaluation: RetrievalEvaluation,
  now: Date = new Date(),
): RetrievalEvidence {
  return {
    at: now.toISOString(),
    stage: creditedStage(session),
    hintLevel: session.hintLevel,
    outcome: retrievalOutcome(evaluation, session.hintLevel),
    contextKey: retrievalContextKey(session.context),
    lessonId: session.lessonId,
    delayed: session.delayed,
    spontaneous: false,
  };
}

/** Seconds the player took — feeds the responseSpeed signal. */
export function elapsedSeconds(session: RetrievalSession, now: Date = new Date()): number {
  return Math.max(0, (now.getTime() - Date.parse(session.startedAt)) / 1000);
}
