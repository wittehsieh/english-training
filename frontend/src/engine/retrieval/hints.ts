import type { EnglishChunk } from '../../types/chunk';
import { HINT_LEVELS, type HintLevel } from '../../types/mastery';

/* ==========================================================================
 * Progressive hints (§10).
 *
 * Generated locally from the chunk itself — instant, free, and deterministic.
 * The ladder only ever goes one step at a time, and the full answer is the
 * last resort, never the first thing shown.
 *
 *   none -> context -> semantic -> partial -> first_word -> full_answer
 * ======================================================================== */

export interface Hint {
  level: HintLevel;
  /** what the player sees — one short line, never a lecture */
  text: string;
  /** true once there is nothing further to reveal */
  isFinal: boolean;
}

/** The leading slice of a phrase, cut at a word boundary. */
function leadingSlice(phrase: string, ratio: number): string {
  const words = phrase.trim().split(/\s+/);
  const take = Math.max(1, Math.min(words.length - 1, Math.round(words.length * ratio)));
  return `${words.slice(0, take).join(' ')}...`;
}

export function buildHint(chunk: EnglishChunk, level: HintLevel): Hint {
  const isFinal = level === 'full_answer';

  switch (level) {
    case 'none':
      return { level, text: '', isFinal: false };

    case 'context':
      return {
        level,
        text: chunk.usage ?? `Think about how you'd say this to a coworker.`,
        isFinal: false,
      };

    case 'semantic':
      return {
        level,
        text: `You want to get across: ${chunk.meaning}`,
        isFinal: false,
      };

    case 'partial':
      return {
        level,
        text: chunk.pattern ?? leadingSlice(chunk.phrase, 0.6),
        isFinal: false,
      };

    case 'first_word':
      return { level, text: leadingSlice(chunk.phrase, 0.25), isFinal: false };

    case 'full_answer':
      return { level, text: chunk.phrase, isFinal };
  }
}

export function escalate(level: HintLevel): HintLevel {
  const i = HINT_LEVELS.indexOf(level);
  return HINT_LEVELS[Math.min(i + 1, HINT_LEVELS.length - 1)]!;
}

export function isMaxHint(level: HintLevel): boolean {
  return level === 'full_answer';
}

/**
 * Hints are learning support, not failure (§10) — so the label stays neutral
 * and never counts down.
 */
export function hintButtonLabel(level: HintLevel): string {
  return level === 'none' ? 'Need a hint?' : 'Still stuck?';
}
