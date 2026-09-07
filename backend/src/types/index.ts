/**
 * Wire types shared with the frontend. Keep in sync with
 * `frontend/src/types/{conversation,learning}.ts` — a future shared package
 * should own this contract.
 */

export type CharacterEmotion =
  | 'neutral'
  | 'happy'
  | 'surprised'
  | 'concerned'
  | 'thinking'
  | 'talking';

export interface LearningObjective {
  id: string;
  description: string;
}

/** Adapted from a bare curriculum string; may link a reusable pattern. */
export interface TargetExpression {
  id: string;
  text: string;
  patternId?: string;
  note?: string;
}

export interface LessonBrief {
  id: string;
  chapterId: string;
  title: string;
  mission: string;
  learningObjectives: LearningObjective[];
  targetExpressions: TargetExpression[];
  conversation: {
    opening: { characterId: string; text: string; emotion?: CharacterEmotion };
  };
  completionCriteria: { requiredObjectives: string[]; minimumTurns: number };
  characters: { id: string; name: string; role: string; personality: string[] }[];
  xp: number;
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

/* ---- Personal Language Gap model (learningModel.json) ---- */

export type GapType =
  | 'meaning'
  | 'grammar'
  | 'word_choice'
  | 'sentence_pattern'
  | 'naturalness'
  | 'context'
  | 'register';

export type GapPriority = 'ignore' | 'optional' | 'useful' | 'important' | 'critical';

export interface LanguageGapObservation {
  concept: string;
  gapType: GapType;
  priority: GapPriority;
  userIntent: string;
  userAttempt: string;
  betterExpression: string;
  patternId?: string;
  explanation: string;
  /** 0..1 — evaluator confidence this is a real, worth-teaching gap */
  confidence?: number;
}

export interface TurnLanguageAnalysis {
  understoodIntent: string;
  meaningCommunicated: boolean;
  grammarOk: boolean;
  natural: boolean;
  contextAppropriate: boolean;
  gap: LanguageGapObservation | null;
  patternsUsedNaturally: string[];
}

export interface ConversationState {
  conversationId: string;
  lessonId: string;
  turns: ConversationTurn[];
  objectives: Record<string, { completed: boolean }>;
  identifiedGaps: LanguageGapObservation[];
  patternsUsedNaturally: string[];
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
  | 'pattern-used';

export interface LearningFeedback {
  kind: LearningFeedbackKind;
  shouldShow: boolean;
  betterExpression: string | null;
  explanation: string | null;
}

export interface AiTurnResult {
  characterResponse: { text: string; emotion: CharacterEmotion };
  evaluation: ResponseEvaluation;
  analysis: TurnLanguageAnalysis;
  learning: LearningFeedback;
  objectiveProgress: Record<string, boolean>;
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
  comfortableConcepts?: string[];
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
  comfortableConcepts: string[];
}
