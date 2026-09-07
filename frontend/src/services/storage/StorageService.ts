import {
  DEFAULT_SETTINGS,
  EMPTY_PROFILE,
  type PlayerProfile,
} from '../../types';

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

const PROFILE_KEY = 'wea:player-profile:v1';

function safeParse(json: string | null): unknown {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Merge stored data over defaults so new fields don't break old saves. */
function hydrate(stored: unknown): PlayerProfile {
  if (!stored || typeof stored !== 'object') return { ...EMPTY_PROFILE };
  const partial = stored as Partial<PlayerProfile>;
  return {
    ...EMPTY_PROFILE,
    ...partial,
    settings: { ...DEFAULT_SETTINGS, ...(partial.settings ?? {}) },
    completedLessons: partial.completedLessons ?? [],
    languageGaps: partial.languageGaps ?? [],
    chapterProgress: partial.chapterProgress ?? {},
  };
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
