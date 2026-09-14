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

/**
 * What the player actually produced this turn. Typing in their first language
 * is not a failure — it is the clearest possible signal of a language gap, so
 * the engine treats it as "I wanted to say this but couldn't in English".
 */
export type LanguageUsed = 'english' | 'mixed' | 'l1';

export interface TurnLanguageAnalysis {
  understoodIntent: string;
  meaningCommunicated: boolean;
  grammarOk: boolean;
  natural: boolean;
  contextAppropriate: boolean;
  /** english | mixed | l1 — l1/mixed means they reached past their English */
  languageUsed: LanguageUsed;
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

/* ---- chunk discovery + retrieval (M2) ---- */

export type ChunkCategory =
  | 'progress'
  | 'uncertainty'
  | 'clarification'
  | 'suggestion'
  | 'disagreement'
  | 'problem'
  | 'timeline'
  | 'opinion'
  | 'small_talk'
  | 'other';

export type SkillId =
  | 'expressing_uncertainty'
  | 'asking_clarification'
  | 'making_suggestions'
  | 'softening_disagreement'
  | 'explaining_progress'
  | 'explaining_blockers'
  | 'giving_opinions'
  | 'giving_timeline'
  | 'small_talk'
  | 'handling_misunderstanding'
  | 'following_up'
  | 'asking_for_help';

export type RetrievalStage = 'prompted' | 'supported' | 'independent';

export type HintLevel =
  | 'none'
  | 'context'
  | 'semantic'
  | 'partial'
  | 'first_word'
  | 'full_answer';

/** A reusable expression the evaluator proposes training. */
export interface ChunkDiscovery {
  phrase: string;
  pattern: string;
  meaning: string;
  usage: string;
  category: ChunkCategory;
  skill: SkillId;
  /** a NEW situation requiring the expression — never "repeat after me" */
  situationPrompt: string;
}

/** The evaluator's read on a retrieval attempt; the client owns the mastery. */
export interface RetrievalEvaluation {
  produced: boolean;
  usedTargetPattern: boolean;
  note: string;
}

/** What the client sends when the player is mid-retrieval. */
export interface RetrievalRequestContext {
  targetChunkId: string;
  targetPhrase: string;
  targetPattern?: string;
  stage: RetrievalStage;
  hintLevel: HintLevel;
  situation: string;
  context?: Record<string, string>;
}

export interface AiTurnResult {
  characterResponse: { text: string; emotion: CharacterEmotion };
  evaluation: ResponseEvaluation;
  analysis: TurnLanguageAnalysis;
  learning: LearningFeedback;
  objectiveProgress: Record<string, boolean>;
  lessonComplete: boolean;
  xpEarned: number;
  discovery: ChunkDiscovery | null;
  retrievalEvaluation: RetrievalEvaluation | null;
}

export interface StartConversationRequest {
  lessonId: string;
}

export interface SendMessageRequest {
  conversationId: string;
  lessonId: string;
  message: string;
  comfortableConcepts?: string[];
  /**
   * Stateless path (serverless): the client sends the transcript so far and
   * which objectives it already counts as done. When present, the server does
   * not need any stored conversation.
   */
  history?: ConversationTurn[];
  completedObjectiveIds?: string[];
  retrieval?: RetrievalRequestContext;
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
  /** set only when this message answers a retrieval prompt */
  retrieval?: RetrievalRequestContext;
}
