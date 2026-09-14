import { findLibraryChunkByPhrase, getLibraryChunk } from '../../data/chunks';
import type { ChunkCategory, EnglishChunk, SkillId } from '../../types/chunk';
import {
  emptyMastery,
  type ChunkMastery,
  type MasteryStage,
  type RetrievalEvidence,
} from '../../types/mastery';
import { computeScore, deriveStage } from './chunkMastery';

/* ==========================================================================
 * One-way migration: the old Personal Language Gap store -> chunks + mastery.
 *
 * A LanguageGap's `betterExpression` IS the chunk the player needed, so each
 * gap becomes (or merges onto) a chunk, and its evidence trail is replayed
 * into the new counters so nobody loses their history.
 * ======================================================================== */

/** The old record shape — kept local so nothing else has to import it. */
export interface LegacyLanguageGap {
  id: string;
  concept: string;
  userIntent?: string;
  userAttempt?: string;
  betterExpression: string;
  gapType?: string;
  priority?: string;
  status?: 'needs_practice' | 'developing' | 'familiar' | 'mastered';
  confidence?: number;
  patternId?: string;
  sourceLessons?: string[];
  timesObserved?: number;
  timesPracticed?: number;
  timesUsedCorrectly?: number;
  masteryEvidence?: {
    timestamp: string;
    context: string;
    result: 'incorrect' | 'correct_after_hint' | 'natural_spontaneous';
    expression: string;
  }[];
  firstSeenAt?: string;
  updatedAt?: string;
}

export interface MigrationResult {
  chunks: EnglishChunk[];
  mastery: ChunkMastery[];
  migratedCount: number;
}

/** Old 4-stage status -> the minimum new stage we must not fall below. */
const STATUS_FLOOR: Record<string, MasteryStage> = {
  needs_practice: 'familiar',
  developing: 'prompted',
  familiar: 'supported',
  mastered: 'independent',
};

const GAP_TYPE_CATEGORY: Record<string, ChunkCategory> = {
  sentence_pattern: 'other',
  word_choice: 'other',
  grammar: 'other',
  naturalness: 'other',
  meaning: 'other',
  context: 'other',
  register: 'other',
};

const KEYWORD_ROUTES: { test: RegExp; category: ChunkCategory; skill: SkillId }[] = [
  { test: /\b(wait|block|stuck|issue|problem|trouble|broken|fail)/i, category: 'problem', skill: 'explaining_blockers' },
  { test: /\b(not sure|unsure|maybe|might|uncertain)/i, category: 'uncertainty', skill: 'expressing_uncertainty' },
  { test: /\b(clarif|explain|mean|make sure|understand)/i, category: 'clarification', skill: 'asking_clarification' },
  { test: /\b(deadline|by |friday|timeline|eta|schedule|due)/i, category: 'timeline', skill: 'giving_timeline' },
  { test: /\b(suggest|option|propose|what if|could we)/i, category: 'suggestion', skill: 'making_suggestions' },
  { test: /\b(disagree|concern|approach|your point)/i, category: 'disagreement', skill: 'softening_disagreement' },
  { test: /\b(done|progress|working on|almost|finish)/i, category: 'progress', skill: 'explaining_progress' },
  { test: /\b(follow up|chance to|get back|look into)/i, category: 'other', skill: 'following_up' },
];

function classify(gap: LegacyLanguageGap): { category: ChunkCategory; skill: SkillId } {
  const haystack = `${gap.concept} ${gap.betterExpression} ${gap.userIntent ?? ''}`;
  for (const route of KEYWORD_ROUTES) {
    if (route.test.test(haystack)) {
      return { category: route.category, skill: route.skill };
    }
  }
  return {
    category: GAP_TYPE_CATEGORY[gap.gapType ?? ''] ?? 'other',
    skill: 'handling_misunderstanding',
  };
}

function personalChunkId(gap: LegacyLanguageGap): string {
  const slug = (gap.concept || gap.betterExpression)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `personal:${slug || gap.id}`;
}

/** Find the library chunk this gap is really about, if there is one. */
function resolveTargetChunk(gap: LegacyLanguageGap): EnglishChunk | undefined {
  if (gap.patternId) {
    const byId = getLibraryChunk(gap.patternId);
    if (byId) return byId;
  }
  return (
    findLibraryChunkByPhrase(gap.betterExpression) ??
    findLibraryChunkByPhrase(gap.concept)
  );
}

/** Raise the counters just enough to reach a stage the player already earned. */
function ensureAtLeastStage(m: ChunkMastery, floor: MasteryStage): ChunkMastery {
  const order: MasteryStage[] = [
    'familiar',
    'prompted',
    'supported',
    'independent',
    'flexible',
    'automatic',
  ];
  const next = { ...m };
  if (order.indexOf(deriveStage(next)) >= order.indexOf(floor)) return next;

  if (floor === 'prompted' && next.promptedSuccess < 1) next.promptedSuccess = 1;
  if (floor === 'supported' && next.supportedSuccess < 1) next.supportedSuccess = 1;
  if (floor === 'independent' && next.independentSuccess < 1) {
    next.independentSuccess = 1;
  }
  return next;
}

function masteryFromGap(
  gap: LegacyLanguageGap,
  chunkId: string,
  existing: ChunkMastery | undefined,
): ChunkMastery {
  const firstSeen = gap.firstSeenAt ?? gap.updatedAt ?? new Date().toISOString();
  let m: ChunkMastery = existing ?? emptyMastery(chunkId, firstSeen);
  const contexts = new Set(m.contextsUsed);
  const evidence: RetrievalEvidence[] = [...m.evidence];

  for (const e of gap.masteryEvidence ?? []) {
    const lessonId = e.context;
    switch (e.result) {
      case 'incorrect':
        m = { ...m, failedRetrievals: m.failedRetrievals + 1 };
        evidence.push({
          at: e.timestamp,
          stage: 'supported',
          hintLevel: 'none',
          outcome: 'failed',
          ...(lessonId ? { lessonId } : {}),
        });
        break;
      case 'correct_after_hint':
        m = { ...m, promptedSuccess: m.promptedSuccess + 1 };
        evidence.push({
          at: e.timestamp,
          stage: 'prompted',
          hintLevel: 'partial',
          outcome: 'success',
          ...(lessonId ? { lessonId } : {}),
        });
        break;
      case 'natural_spontaneous': {
        const key = lessonId ? `lesson:${lessonId}` : undefined;
        if (key && !contexts.has(key)) {
          if (contexts.size > 0) m = { ...m, variationSuccess: m.variationSuccess + 1 };
          contexts.add(key);
        }
        m = {
          ...m,
          independentSuccess: m.independentSuccess + 1,
          spontaneousUsage: m.spontaneousUsage + 1,
          lastRetrievedAt: e.timestamp,
        };
        evidence.push({
          at: e.timestamp,
          stage: 'independent',
          hintLevel: 'none',
          outcome: 'success',
          spontaneous: true,
          ...(key ? { contextKey: key } : {}),
          ...(lessonId ? { lessonId } : {}),
        });
        break;
      }
    }
  }

  m = {
    ...m,
    contextsUsed: [...contexts],
    evidence,
    lastSeenAt: gap.updatedAt ?? m.lastSeenAt ?? firstSeen,
  };

  // Don't let anyone come out of the migration worse off than they went in.
  const floor = STATUS_FLOOR[gap.status ?? 'needs_practice'] ?? 'familiar';
  m = ensureAtLeastStage(m, floor);

  return { ...m, score: computeScore(m), currentStage: deriveStage(m) };
}

function chunkFromGap(gap: LegacyLanguageGap, id: string): EnglishChunk {
  const { category, skill } = classify(gap);
  return {
    id,
    phrase: gap.betterExpression,
    ...(gap.concept ? { pattern: gap.concept } : {}),
    meaning: gap.userIntent || gap.concept || 'A useful workplace expression.',
    ...(gap.userAttempt ? { originalAttempt: gap.userAttempt } : {}),
    category,
    skill,
    source: 'personal',
    ...(gap.sourceLessons?.length ? { seenInLessons: gap.sourceLessons } : {}),
    ...(gap.firstSeenAt ? { createdAt: gap.firstSeenAt } : {}),
  };
}

/**
 * Convert a legacy gap store into personal chunks + mastery.
 * Gaps that map onto a library chunk contribute their history to that chunk
 * instead of creating a duplicate personal one.
 */
export function migrateLanguageGaps(
  gaps: LegacyLanguageGap[],
  existingChunks: EnglishChunk[] = [],
  existingMastery: ChunkMastery[] = [],
): MigrationResult {
  const chunks = new Map(existingChunks.map((c) => [c.id, c]));
  const mastery = new Map(existingMastery.map((m) => [m.chunkId, m]));
  let migratedCount = 0;

  for (const gap of gaps) {
    if (!gap?.betterExpression) continue;

    const libraryChunk = resolveTargetChunk(gap);
    const chunkId = libraryChunk ? libraryChunk.id : personalChunkId(gap);

    if (!libraryChunk && !chunks.has(chunkId)) {
      chunks.set(chunkId, chunkFromGap(gap, chunkId));
    }

    mastery.set(chunkId, masteryFromGap(gap, chunkId, mastery.get(chunkId)));
    migratedCount += 1;
  }

  return {
    chunks: [...chunks.values()],
    mastery: [...mastery.values()],
    migratedCount,
  };
}
