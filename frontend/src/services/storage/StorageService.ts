import {
  DEFAULT_SETTINGS,
  EMPTY_PROFILE,
  EMPTY_SIGNALS,
  type PlayerProfile,
} from '../../types';
import { ensureAllSkills } from '../../engine/mastery/weakness';
import {
  migrateLanguageGaps,
  type LegacyLanguageGap,
} from '../../engine/mastery/migrateLanguageGaps';

/**
 * Single choke-point for persistence. Components never touch `localStorage`
 * directly — swap this implementation for a server-backed one later without
 * touching the UI.
 */
export interface StorageService {
  loadProfile(): PlayerProfile;
  saveProfile(profile: PlayerProfile): void;
  clear(): void;
}

/** v1 = LanguageGap era. v2 = chunk + mastery era. */
const PROFILE_KEY = 'wea:player-profile:v1';

function safeParse(json: string | null): unknown {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * The v1 shape we may still find in a returning player's browser — includes
 * fields the current PlayerProfile no longer has at all (xp/level were a
 * gamification layer that was removed outright, not just hidden).
 */
type StoredProfile = Partial<PlayerProfile> & {
  languageGaps?: LegacyLanguageGap[];
  xp?: number;
  level?: number;
};

/**
 * Merge stored data over defaults so new fields never break old saves, then
 * run the one-way LanguageGap -> chunk migration if this is a v1 profile.
 * Migration preserves the player's earned history (see migrateLanguageGaps).
 */
export function hydrate(stored: unknown): PlayerProfile {
  if (!stored || typeof stored !== 'object') return { ...EMPTY_PROFILE };

  // Pulled OUT of the spread on purpose, not just left untyped:
  //   - `languageGaps` re-migrating (and re-counting) on every load
  //   - `xp` / `level` are a removed gamification layer — a real object read
  //     back from localStorage still has them even though the type doesn't,
  //     so they must be discarded explicitly or they silently ride along.
  const { languageGaps: legacyGaps, xp: _xp, level: _level, ...partial } =
    stored as StoredProfile;

  let profile: PlayerProfile = {
    ...EMPTY_PROFILE,
    ...partial,
    settings: { ...DEFAULT_SETTINGS, ...(partial.settings ?? {}) },
    completedLessons: partial.completedLessons ?? [],
    personalChunks: partial.personalChunks ?? [],
    chunkMastery: partial.chunkMastery ?? [],
    weakness: ensureAllSkills(partial.weakness ?? []),
    signals: { ...EMPTY_SIGNALS, ...(partial.signals ?? {}) },
    chapterProgress: partial.chapterProgress ?? {},
  };

  if (Array.isArray(legacyGaps) && legacyGaps.length > 0) {
    const migrated = migrateLanguageGaps(
      legacyGaps,
      profile.personalChunks,
      profile.chunkMastery,
    );
    profile = {
      ...profile,
      personalChunks: migrated.chunks,
      chunkMastery: migrated.mastery,
    };
  }

  // `languageGaps` is intentionally dropped — the chunk store replaces it.
  return profile;
}

export class LocalStorageService implements StorageService {
  loadProfile(): PlayerProfile {
    if (typeof window === 'undefined') return { ...EMPTY_PROFILE };
    try {
      return hydrate(safeParse(window.localStorage.getItem(PROFILE_KEY)));
    } catch {
      return { ...EMPTY_PROFILE };
    }
  }

  saveProfile(profile: PlayerProfile): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch {
      /* storage full / disabled — ignore, game still works in-memory */
    }
  }

  clear(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(PROFILE_KEY);
    } catch {
      /* ignore */
    }
  }
}

export const storageService: StorageService = new LocalStorageService();
