import manifestJson from '../data/assets.json';
import type {
  AssetManifest,
  BackgroundAsset,
  CharacterAsset,
  CharacterExpression,
} from '../types/assets';
import { CHARACTER_EXPRESSIONS } from '../types/assets';

const manifest = manifestJson as unknown as AssetManifest;

/** Vite serves the app under `import.meta.env.BASE_URL` (`/english-training/`). */
function resolveUrl(src: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base.replace(/\/$/, '')}/${src.replace(/^\//, '')}`;
}

/** Stable pastel colour from a string — used for placeholder art. */
function seededColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}deg 45% 55%)`;
}

export interface ResolvedBackground {
  id: string;
  /** null when the id is unknown (component falls back to a gradient). */
  url: string | null;
  focalPoint: string;
  placeholderColor: string;
  music?: string;
}

export interface ResolvedCharacter {
  id: string;
  name: string;
  role: string;
  expression: CharacterExpression;
  /** null when nothing is registered (component draws a silhouette). */
  url: string | null;
  placeholderColor: string;
  voice?: string;
}

const preloaded = new Set<string>();

export const AssetManager = {
  manifestVersion: manifest.version,

  /* ---------------- backgrounds ---------------- */

  hasBackground(sceneId: string): boolean {
    return Boolean(manifest.backgrounds[sceneId]);
  },

  getBackground(sceneId: string, focalPointOverride?: string): ResolvedBackground {
    const asset: BackgroundAsset | undefined = manifest.backgrounds[sceneId];
    return {
      id: sceneId,
      url: asset ? resolveUrl(asset.src) : null,
      focalPoint: focalPointOverride ?? asset?.focalPoint ?? 'center center',
      placeholderColor: seededColor(`bg:${sceneId}`),
      music: asset?.music,
    };
  },

  /* ---------------- characters ---------------- */

  getCharacterMeta(characterId: string): CharacterAsset | undefined {
    return manifest.characters[characterId];
  },

  hasCharacter(characterId: string, expression: CharacterExpression): boolean {
    return Boolean(manifest.characters[characterId]?.expressions[expression]);
  },

  /** Falls back: requested -> neutral -> first available -> 'neutral'. */
  resolveExpression(
    characterId: string,
    expression: CharacterExpression,
  ): CharacterExpression {
    const character = manifest.characters[characterId];
    if (!character) return expression;
    if (character.expressions[expression]) return expression;
    if (character.expressions.neutral) return 'neutral';
    const available = CHARACTER_EXPRESSIONS.find(
      (key) => character.expressions[key],
    );
    return available ?? 'neutral';
  },

  getCharacter(
    characterId: string,
    expression: CharacterExpression,
  ): ResolvedCharacter {
    const character = manifest.characters[characterId];
    const resolvedExpression = this.resolveExpression(characterId, expression);
    const src = character?.expressions[resolvedExpression];

    return {
      id: characterId,
      name: character?.name ?? characterId,
      role: character?.role ?? '',
      expression: resolvedExpression,
      url: src ? resolveUrl(src) : null,
      placeholderColor: seededColor(`char:${characterId}`),
      voice: character?.voice,
    };
  },

  /* ---------------- preloading ---------------- */

  /**
   * Warm the browser cache for the current + next scene. Deliberately simple —
   * just `new Image()`; failures (missing artwork) are silently ignored.
   */
  preload(urls: (string | null | undefined)[]): void {
    if (typeof window === 'undefined') return;
    for (const url of urls) {
      if (!url || preloaded.has(url)) continue;
      preloaded.add(url);
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
    }
  },

  /** All background + character URLs a lesson might show, for preloading. */
  lessonAssetUrls(
    sceneId: string,
    characterIds: string[],
  ): string[] {
    const urls: string[] = [];
    const bg = this.getBackground(sceneId).url;
    if (bg) urls.push(bg);
    for (const id of characterIds) {
      const character = manifest.characters[id];
      if (!character) continue;
      for (const key of CHARACTER_EXPRESSIONS) {
        const src = character.expressions[key];
        if (src) urls.push(resolveUrl(src));
      }
    }
    return urls;
  },
};
