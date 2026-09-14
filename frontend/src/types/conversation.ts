import type { CharacterEmotion } from './lesson';
import type { LanguageGapObservation, TurnLanguageAnalysis } from './learning';
import type { ChunkCategory, RetrievalContext, SkillId } from './chunk';
import type { HintLevel, RetrievalStage } from './mastery';

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

/**
 * A reusable expression the evaluator spotted in (or just out of reach of) the
 * player's own output. The client Learning Engine decides whether to act on it.
 */
export interface ChunkDiscovery {
  phrase: string;
  pattern: string;
  meaning: string;
  usage: string;
  category: ChunkCategory;
  skill: SkillId;
  /**
   * A NEW situation from the same NPC that would naturally require this
   * expression — never a request to repeat it back.
   */
  situationPrompt: string;
}

/** The evaluator's read on a retrieval attempt (client decides the mastery). */
export interface RetrievalEvaluation {
  /** did the player communicate the intended meaning at all */
  produced: boolean;
  /** did they actually reach for the target pattern */
  usedTargetPattern: boolean;
  note: string;
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
  /** set when the evaluator proposes a chunk worth training */
  discovery: ChunkDiscovery | null;
  /** set only when this turn was answering a retrieval prompt */
  retrievalEvaluation: RetrievalEvaluation | null;
}

/** What the client tells the backend when the player is mid-retrieval. */
export interface RetrievalRequestContext {
  targetChunkId: string;
  targetPhrase: string;
  targetPattern?: string;
  stage: RetrievalStage;
  hintLevel: HintLevel;
  /** the situation the NPC posed */
  situation: string;
  /** variation metadata — stored now, varied in M3 */
  context: RetrievalContext;
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
  /**
   * The transcript so far (ending with this player message) and which
   * objectives the client counts as done. Lets the backend stay stateless —
   * required for serverless hosting where instances share no memory.
   */
  history?: ConversationTurn[];
  completedObjectiveIds?: string[];
  /**
   * Present only when this message is the player's answer to a retrieval
   * prompt. The client owns the retrieval state machine; the backend just
   * needs to know what to evaluate against.
   */
  retrieval?: RetrievalRequestContext;
}

export interface ConversationTurnResponse {
  conversationId: string;
  turn: ConversationTurn;
  result: AiTurnResult;
}
