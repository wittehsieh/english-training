/**
 * Asset types. The real artwork is produced by a separate AI image-generation
 * workflow and dropped into `public/assets/`. Nothing in `src/` hard-codes a
 * file path — everything goes through `src/data/assets.json` +
 * {@link AssetManager}.
 */

export type CharacterExpression =
  | 'neutral'
  | 'happy'
  | 'surprised'
  | 'concerned'
  | 'thinking'
  | 'talking';

export const CHARACTER_EXPRESSIONS: CharacterExpression[] = [
  'neutral',
  'happy',
  'surprised',
  'concerned',
  'thinking',
  'talking',
];

/** Where a character stands on the stage. */
export type CharacterPosition = 'left' | 'center' | 'right';

export interface CharacterAsset {
  id: string;
  name: string;
  role: string;
  /** expression id -> public URL (may 404 until artwork exists) */
  expressions: Partial<Record<CharacterExpression, string>>;
  /** Optional future audio — not used yet. */
  voice?: string;
}

export interface BackgroundAsset {
  id: string;
  src: string;
  /** CSS `background-position` / `object-position`, e.g. "50% 40%". */
  focalPoint?: string;
  /** Optional future background music — not used yet. */
  music?: string;
}

export interface AssetManifest {
  version: string;
  backgrounds: Record<string, BackgroundAsset>;
  characters: Record<string, CharacterAsset>;
}
