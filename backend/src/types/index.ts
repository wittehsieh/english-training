/**
 * Wire types shared with the frontend. Keep these in sync with
 * `frontend/src/types/conversation.ts` — a future shared package should own
 * this contract.
 */

export type CharacterEmotion =
  | 'neutral'
  | 'happy'
  | 'surprised'
  | 'concerned'
  | 'thinking'
  | 'talking';

export interface TargetPhrase {
  id: string;
  phrase: string;
  meaning: string;
  usage: string;
  example?: string;
}

export interface LearningObjective {
  id: string;
  description: string;
}

export interface LessonBrief {
  id: string;
  title: string;
  learningObjectives: LearningObjective[];
  targetPhrases: TargetPhrase[];
  conversation: { opening: { characterId: string; text: string; emotion?: CharacterEmotion } };
  completionCriteria: { requiredObjectives: string[]; minimumTurns: number };
  characters: { id: string; name: string; role: string; personality: string[] }[];
}

export type Speaker = 'character' | 'player';

export interface ConversationTurn {
  id: string;
  speaker: Speaker;
  characterId?: string;
  text: string;
  emotion?: CharacterEmotion;
}

export type ConversationStatus = 'active' | 'complete' | 'error';

export interface ConversationState {
  conversationId: string;
  lessonId: string;
  turns: ConversationTurn[];
  objectives: Record<string, { completed: boolean }>;
  learnedPhrases: TargetPhrase[];
  xp: number;
  status: ConversationStatus;
}

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

export interface AiTurnResult {
  characterResponse: { text: string; emotion: CharacterEmotion };
  evaluation: ResponseEvaluation;
  learning: LearningFeedback;
  objectiveProgress: Record<string, boolean>;
  newPhrases: TargetPhrase[];
  lessonComplete: boolean;
  xpEarned: number;
}

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

/** Context the AI service needs to evaluate one player message. */
export interface EvaluateContext {
  lesson: LessonBrief;
  history: ConversationTurn[];
  playerMessage: string;
  completedObjectiveIds: string[];
  playerTurnNumber: number;
}
