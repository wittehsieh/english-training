import type { CharacterEmotion } from './lesson';
import type { LanguageGapObservation, TurnLanguageAnalysis } from './learning';

export type Speaker = 'character' | 'player';

export interface ConversationTurn {
  id: string;
  speaker: Speaker;
  /** Present when `speaker === 'character'`. */
  characterId?: string;
  text: string;
  emotion?: CharacterEmotion;
}

export type ObjectiveState = Record<string, { completed: boolean }>;

export type ConversationStatus = 'active' | 'complete' | 'error';

export interface ConversationState {
  conversationId: string;
  lessonId: string;
  turns: ConversationTurn[];
  objectives: ObjectiveState;
  /** gap observations collected this conversation (deduped by concept) */
  identifiedGaps: LanguageGapObservation[];
  /** phrase-pattern ids the player used naturally this conversation */
  patternsUsedNaturally: string[];
  xp: number;
  status: ConversationStatus;
}

/* -------------------------------------------------------------------------- */
/*  AI response contract                                                       */
/*  The mock and (future) OpenAI backend both return this exact shape.         */
/* -------------------------------------------------------------------------- */

export type EvaluationRating = 'poor' | 'ok' | 'good' | 'excellent';

export interface ResponseEvaluation {
  overall: EvaluationRating;
  meaningCorrect: boolean;
  grammar: 'poor' | 'ok' | 'good';
  naturalness: 'unnatural' | 'ok' | 'natural';
}

export type LearningFeedbackKind =
  | 'none'
  | 'subtle'
  | 'correction'
  | 'explanation'
  | 'pattern-used';

/** The tiny, optional coaching line shown under the dialogue. */
export interface LearningFeedback {
  kind: LearningFeedbackKind;
  shouldShow: boolean;
  betterExpression: string | null;
  explanation: string | null;
}

export interface CharacterResponse {
  text: string;
  emotion: CharacterEmotion;
}

export interface AiTurnResult {
  characterResponse: CharacterResponse;
  evaluation: ResponseEvaluation;
  /** rich analysis matching learningModel.json — the future OpenAI output */
  analysis: TurnLanguageAnalysis;
  /** derived from `analysis`, for the subtle in-conversation UI */
  learning: LearningFeedback;
  objectiveProgress: Record<string, boolean>;
  lessonComplete: boolean;
  xpEarned: number;
}

/* -------------------------------------------------------------------------- */
/*  Service request / response types                                           */
/* -------------------------------------------------------------------------- */

export interface StartConversationRequest {
  lessonId: string;
}

export interface SendMessageRequest {
  conversationId: string;
  lessonId: string;
  message: string;
  /**
   * Gap concepts the learner has already reached familiar/mastered on, so the
   * evaluator can avoid re-teaching them. Client-owned for now; a real backend
   * would eventually track this itself.
   */
  comfortableConcepts?: string[];
}

export interface ConversationTurnResponse {
  conversationId: string;
  turn: ConversationTurn;
  result: AiTurnResult;
}
