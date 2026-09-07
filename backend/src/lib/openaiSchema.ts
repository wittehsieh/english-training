import { z } from 'zod';
import type { EvaluateContext, TurnLanguageAnalysis } from '../types';

/* ==========================================================================
 * The structured-output contract for the OpenAI evaluator.
 *
 * This is the RAW shape the model returns. It is deliberately a bit different
 * from `AiTurnResult`:
 *   - `objectiveProgress` is a string[] (`demonstratedObjectiveIds`), not a map
 *     — open-ended maps don't play well with strict JSON schema.
 *   - no `evaluation` / `learning` / `xpEarned` / `lessonComplete` — those are
 *     derived server-side by `scoreTurn` so completion and XP stay
 *     authoritative.
 * `normalizeModelTurn()` maps this into a `TurnLanguageAnalysis`.
 * ======================================================================== */

const emotion = z.enum([
  'neutral',
  'happy',
  'surprised',
  'concerned',
  'thinking',
  'talking',
]);

const gapType = z.enum([
  'meaning',
  'grammar',
  'word_choice',
  'sentence_pattern',
  'naturalness',
  'context',
  'register',
]);

const priority = z.enum(['ignore', 'optional', 'useful', 'important', 'critical']);

const gapSchema = z.object({
  type: gapType,
  concept: z.string().min(1),
  userIntent: z.string(),
  userAttempt: z.string(),
  betterExpression: z.string().min(1),
  explanation: z.string(),
  priority,
  confidence: z.number(),
  /** phrasePatterns.json id, or "" when none applies */
  patternId: z.string(),
});

export const ModelTurnSchema = z.object({
  characterResponse: z.object({
    text: z.string().min(1),
    emotion,
  }),
  analysis: z.object({
    understoodIntent: z.string(),
    meaningCommunicated: z.boolean(),
    grammarOk: z.boolean(),
    natural: z.boolean(),
    contextAppropriate: z.boolean(),
    gap: gapSchema.nullable(),
    patternsUsedNaturally: z.array(z.string()),
  }),
  demonstratedObjectiveIds: z.array(z.string()),
});

export type ModelTurn = z.infer<typeof ModelTurnSchema>;

export interface ParseResult {
  ok: boolean;
  data?: ModelTurn;
  error?: string;
}

/** Validate an arbitrary value (e.g. JSON.parse output) against the contract. */
export function parseModelTurn(raw: unknown): ParseResult {
  const result = ModelTurnSchema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, error: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
}

export interface NormalizedTurn {
  analysis: TurnLanguageAnalysis;
  characterResponse: ModelTurn['characterResponse'];
  demonstratedObjectiveIds: string[];
}

/** Map validated model output into the shared `TurnLanguageAnalysis`. */
export function normalizeModelTurn(model: ModelTurn): NormalizedTurn {
  const g = model.analysis.gap;
  return {
    characterResponse: model.characterResponse,
    demonstratedObjectiveIds: model.demonstratedObjectiveIds,
    analysis: {
      understoodIntent: model.analysis.understoodIntent,
      meaningCommunicated: model.analysis.meaningCommunicated,
      grammarOk: model.analysis.grammarOk,
      natural: model.analysis.natural,
      contextAppropriate: model.analysis.contextAppropriate,
      patternsUsedNaturally: model.analysis.patternsUsedNaturally,
      gap: g
        ? {
            concept: g.concept,
            gapType: g.type,
            priority: g.priority,
            userIntent: g.userIntent || model.analysis.understoodIntent,
            userAttempt: g.userAttempt,
            betterExpression: g.betterExpression,
            explanation: g.explanation,
            patternId: g.patternId ? g.patternId : undefined,
            confidence: Number.isFinite(g.confidence)
              ? Math.max(0, Math.min(1, g.confidence))
              : 0.6,
          }
        : null,
    },
  };
}

/** A valid, harmless turn used when OpenAI fails or returns junk. */
export function fallbackModelTurn(_context: EvaluateContext): ModelTurn {
  return {
    characterResponse: {
      text: "Sorry — I lost my train of thought there. Could you say that again?",
      emotion: 'neutral',
    },
    analysis: {
      understoodIntent: 'continue the conversation',
      meaningCommunicated: true,
      grammarOk: true,
      natural: true,
      contextAppropriate: true,
      gap: null,
      patternsUsedNaturally: [],
    },
    demonstratedObjectiveIds: [],
  };
}
