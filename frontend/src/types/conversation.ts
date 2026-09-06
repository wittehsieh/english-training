import type { CharacterEmotion, TargetPhrase } from './lesson';

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
  learnedPhrases: TargetPhrase[];
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
  | 'phrase-learned';

export interface LearningFeedback {
  kind: LearningFeedbackKind;
  shouldCorrect: boolean;
  correction: string | null;
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
  learning: LearningFeedback;
  objectiveProgress: Record<string, boolean>;
  newPhrases: TargetPhrase[];
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
}

export interface ConversationTurnResponse {
  conversationId: string;
  turn: ConversationTurn;
  result: AiTurnResult;
}
