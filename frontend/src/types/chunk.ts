/**
 * The unit of learning: an English CHUNK — a reusable, generative expression
 * pattern, not an isolated sentence and not a vocabulary word.
 *
 *   GOOD: "I'm not sure how to + VERB"
 *   BAD:  "I'm not sure how to fix the payment bug."
 *
 * Chunks come from two places:
 *   - `library`  — the curated starter set in `data/chunks/chunkLibrary.json`
 *   - `personal` — discovered by the AI from the player's own output
 */

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

export type ChunkDifficulty = 'beginner' | 'intermediate' | 'advanced';

export type ChunkSource = 'library' | 'personal';

/**
 * Communication skills for the weakness map (§19). Kept separate from
 * `category` so the weakness view isn't forced through the category union.
 */
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

export const SKILL_IDS: SkillId[] = [
  'expressing_uncertainty',
  'asking_clarification',
  'making_suggestions',
  'softening_disagreement',
  'explaining_progress',
  'explaining_blockers',
  'giving_opinions',
  'giving_timeline',
  'small_talk',
  'handling_misunderstanding',
  'following_up',
  'asking_for_help',
];

export const SKILL_LABELS: Record<SkillId, string> = {
  expressing_uncertainty: 'Expressing uncertainty',
  asking_clarification: 'Asking for clarification',
  making_suggestions: 'Making suggestions',
  softening_disagreement: 'Softening disagreement',
  explaining_progress: 'Explaining progress',
  explaining_blockers: 'Explaining blockers',
  giving_opinions: 'Giving opinions',
  giving_timeline: 'Giving a timeline',
  small_talk: 'Small talk',
  handling_misunderstanding: 'Handling misunderstandings',
  following_up: 'Following up',
  asking_for_help: 'Asking for help',
};

export const CATEGORY_LABELS: Record<ChunkCategory, string> = {
  progress: 'Talking about Progress',
  uncertainty: 'Expressing Uncertainty',
  clarification: 'Clarifying',
  suggestion: 'Making Suggestions',
  disagreement: 'Disagreeing Politely',
  problem: 'Describing Problems',
  timeline: 'Timelines & Deadlines',
  opinion: 'Giving Opinions',
  small_talk: 'Small Talk',
  other: 'Everyday Workplace',
};

export interface EnglishChunk {
  id: string;
  /** the canonical surface form, e.g. "I'm not sure how to..." */
  phrase: string;
  /** the generative pattern, e.g. "I'm not sure how to + VERB" */
  pattern?: string;
  meaning: string;
  /** when to reach for it */
  usage?: string;
  category: ChunkCategory;
  skill: SkillId;
  /** concrete realisations — used for hints and variation, never as answer keys */
  examples?: string[];
  difficulty?: ChunkDifficulty;
  source: ChunkSource;
  /** for personal chunks: what the player originally said */
  originalAttempt?: string;
  /** lesson ids where this chunk has come up */
  seenInLessons?: string[];
  createdAt?: string;
}

/* -------------------------------------------------------------------------- */
/*  Retrieval context — variation metadata (§12).                              */
/*  Stored on every retrieval so M3 can generate genuinely different           */
/*  situations rather than repeating the same sentence.                        */
/* -------------------------------------------------------------------------- */

export type RetrievalAudience = 'coworker' | 'manager' | 'pm' | 'client' | 'friend';
export type RetrievalSetting = 'office' | 'meeting' | 'slack' | 'email' | 'phone' | 'casual';
export type RetrievalPurpose =
  | 'explain'
  | 'clarify'
  | 'suggest'
  | 'disagree'
  | 'respond'
  | 'solve_problem';
export type RetrievalUrgency = 'low' | 'normal' | 'high';
export type RetrievalFormality = 'casual' | 'professional' | 'formal';

export interface RetrievalContext {
  audience: RetrievalAudience;
  setting: RetrievalSetting;
  purpose: RetrievalPurpose;
  urgency: RetrievalUrgency;
  formality: RetrievalFormality;
}

/** Stable key used to tell "a different situation" from "the same situation". */
export function retrievalContextKey(ctx: RetrievalContext): string {
  return `${ctx.audience}|${ctx.setting}|${ctx.purpose}`;
}
