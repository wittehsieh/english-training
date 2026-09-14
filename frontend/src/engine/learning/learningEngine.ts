import { learningConfig, type LearningConfig } from '../../config/learningConfig';
import { findLibraryChunkByPhrase } from '../../data/chunks';
import type { ChunkDiscovery } from '../../types/conversation';
import type { ChunkMastery, RetrievalStage } from '../../types/mastery';
import type { EnglishChunk } from '../../types/chunk';
import { isComfortable } from '../mastery/chunkMastery';

/* ==========================================================================
 * Learning Engine — decides WHAT HAPPENS NEXT (§18).
 *
 * The AI proposes ("here's a useful expression"); this decides whether the
 * game acts on it. Keeping the gate here is what stops an episode turning
 * into eight English exercises.
 * ======================================================================== */

export type NextAction =
  | { kind: 'continue' }
  | {
      kind: 'discover';
      chunk: EnglishChunk;
      situation: string;
      stage: RetrievalStage;
    };

export interface DecisionInput {
  discovery: ChunkDiscovery | null;
  /** player turns taken in this conversation so far */
  playerTurns: number;
  /** player-turn index of the last retrieval, or null if none yet */
  lastRetrievalTurn: number | null;
  retrievalsThisLesson: number;
  /** looked up by the caller: current mastery for the proposed chunk */
  masteryFor: (chunkId: string) => ChunkMastery | undefined;
  existingChunk: (phrase: string) => EnglishChunk | undefined;
  config?: LearningConfig;
}

const slug = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Turn an AI proposal into a real chunk — reusing a library chunk if it is one. */
export function chunkFromDiscovery(
  discovery: ChunkDiscovery,
  now: Date = new Date(),
): EnglishChunk {
  const library =
    findLibraryChunkByPhrase(discovery.phrase) ??
    findLibraryChunkByPhrase(discovery.pattern);
  if (library) return library;

  const id = `personal:${slug(discovery.pattern) || slug(discovery.phrase)}`;
  return {
    id,
    phrase: discovery.phrase,
    ...(discovery.pattern ? { pattern: discovery.pattern } : {}),
    meaning: discovery.meaning,
    ...(discovery.usage ? { usage: discovery.usage } : {}),
    category: discovery.category,
    skill: discovery.skill,
    source: 'personal',
    createdAt: now.toISOString(),
  };
}

/**
 * Which stage to ask for, given what the player has already shown.
 * A freshly discovered chunk starts at `supported`: they just saw it, so
 * producing it now can never be unaided "independent" evidence.
 */
export function chooseStage(mastery: ChunkMastery | undefined): RetrievalStage {
  if (!mastery) return 'supported';
  switch (mastery.currentStage) {
    case 'familiar':
      return 'supported';
    case 'prompted':
      return 'supported';
    case 'supported':
      return 'independent';
    default:
      return 'independent';
  }
}

/**
 * The gate. Returns `continue` unless every condition for a retrieval is met,
 * so the default behaviour is always "just keep talking".
 */
export function decideNextAction(input: DecisionInput): NextAction {
  const config = input.config ?? learningConfig;
  const { discovery } = input;

  if (!discovery) return { kind: 'continue' };
  if (!discovery.phrase.trim() || !discovery.situationPrompt.trim()) {
    return { kind: 'continue' };
  }

  // Never let an episode become a drill.
  if (input.retrievalsThisLesson >= config.maxRetrievalsPerLesson) {
    return { kind: 'continue' };
  }

  // Give the conversation room to breathe between retrievals.
  if (
    input.lastRetrievalTurn !== null &&
    input.playerTurns - input.lastRetrievalTurn < config.retrievalCooldownTurns
  ) {
    return { kind: 'continue' };
  }

  const chunk =
    input.existingChunk(discovery.phrase) ?? chunkFromDiscovery(discovery);
  const mastery = input.masteryFor(chunk.id);

  // Don't train something they already produce reliably.
  if (mastery && isComfortable(mastery)) return { kind: 'continue' };

  return {
    kind: 'discover',
    chunk,
    situation: discovery.situationPrompt,
    stage: chooseStage(mastery),
  };
}
