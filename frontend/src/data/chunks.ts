import libraryJson from './chunks/chunkLibrary.json';
import type { ChunkCategory, EnglishChunk, SkillId } from '../types/chunk';

/**
 * The curated chunk library. Personal chunks discovered from the player's own
 * output live in the player profile, not here — use `resolveChunk()` /
 * `allChunks()` from the mastery engine when you need both.
 */

const raw = libraryJson as unknown as {
  version: string;
  chunks: Omit<EnglishChunk, 'source'>[];
};

export const CHUNK_LIBRARY_VERSION = raw.version;

export const CHUNK_LIBRARY: EnglishChunk[] = raw.chunks.map((c) => ({
  ...c,
  source: 'library' as const,
}));

const BY_ID = new Map(CHUNK_LIBRARY.map((c) => [c.id, c]));

export function getLibraryChunk(id: string): EnglishChunk | undefined {
  return BY_ID.get(id);
}

export function isLibraryChunkId(id: string): boolean {
  return BY_ID.has(id);
}

export function chunksByCategory(category: ChunkCategory): EnglishChunk[] {
  return CHUNK_LIBRARY.filter((c) => c.category === category);
}

export function chunksBySkill(skill: SkillId): EnglishChunk[] {
  return CHUNK_LIBRARY.filter((c) => c.skill === skill);
}

/** Normalised key for matching a phrase against the library. */
export function phraseKey(phrase: string): string {
  return phrase
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\.\.\.|…/g, '')
    .replace(/[^a-z' ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const BY_PHRASE_KEY = new Map(CHUNK_LIBRARY.map((c) => [phraseKey(c.phrase), c]));

/**
 * Best-effort lookup of a library chunk from a free-text phrase — used when
 * migrating old records and when the AI proposes a chunk that already exists.
 * Exact normalised match first, then containment either way.
 */
export function findLibraryChunkByPhrase(phrase: string): EnglishChunk | undefined {
  const key = phraseKey(phrase);
  if (!key) return undefined;

  const exact = BY_PHRASE_KEY.get(key);
  if (exact) return exact;

  for (const chunk of CHUNK_LIBRARY) {
    const ck = phraseKey(chunk.phrase);
    if (!ck) continue;
    if (key.includes(ck) || ck.includes(key)) return chunk;
  }
  return undefined;
}
