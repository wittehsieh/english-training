import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { AiTurnResult, EvaluateContext } from '../types';
import type { AIConversationService } from './AIConversationService';
import { buildSystemPrompt, buildTurnUserMessage } from '../prompts/systemPrompt';
import { scoreTurn } from '../lib/turnScoring';
import {
  ModelTurnSchema,
  fallbackModelTurn,
  normalizeModelTurn,
  parseModelTurn,
  type ModelTurn,
} from '../lib/openaiSchema';

/* ==========================================================================
 * OpenAIConversationService — the real AI coworker.
 *
 * Flow: build prompt -> call OpenAI with a strict response schema ->
 * validate -> normalise into a TurnLanguageAnalysis -> `scoreTurn` derives
 * evaluation / objective progress / completion / XP -> AiTurnResult.
 *
 * On ANY failure (timeout, rate limit, network, invalid output) it logs
 * server-side and returns a safe fallback turn so the conversation never
 * crashes. The Mock service is untouched.
 * ======================================================================== */

export interface OpenAIConfig {
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
}

export function readOpenAIConfig(env: NodeJS.ProcessEnv): OpenAIConfig | null {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    model: env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
    timeoutMs: Number(env.OPENAI_TIMEOUT_MS) || 20_000,
    maxRetries: Number(env.OPENAI_MAX_RETRIES ?? 1),
  };
}

function classifyError(err: unknown): string {
  if (err instanceof OpenAI.APIError) {
    if (err.status === 429) return 'rate_limit';
    if (err.status === 401) return 'auth';
    if (err.status && err.status >= 500) return 'openai_5xx';
    return `openai_${err.status ?? 'error'}`;
  }
  if (err instanceof Error && /timeout|aborted/i.test(err.message)) return 'timeout';
  if (err instanceof Error && /network|fetch failed|ECONN/i.test(err.message))
    return 'network';
  return 'unknown';
}

export class OpenAIConversationService implements AIConversationService {
  readonly name = 'openai';

  private readonly client: OpenAI;

  constructor(private readonly config: OpenAIConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      timeout: config.timeoutMs,
      maxRetries: config.maxRetries,
    });
  }

  async evaluateTurn(context: EvaluateContext): Promise<AiTurnResult> {
    const { model, degraded } = await this.callModel(context);
    return this.assemble(context, model, degraded);
  }

  /** Call OpenAI with structured output. Never throws — returns a fallback. */
  private async callModel(
    context: EvaluateContext,
  ): Promise<{ model: ModelTurn; degraded: boolean }> {
    try {
      const completion = await this.client.beta.chat.completions.parse({
        model: this.config.model,
        temperature: 0.5,
        max_tokens: 900,
        messages: [
          { role: 'system', content: buildSystemPrompt(context.lesson) },
          { role: 'user', content: buildTurnUserMessage(context) },
        ],
        response_format: zodResponseFormat(ModelTurnSchema, 'turn_result'),
      });

      const choice = completion.choices[0];
      if (choice?.message.refusal) {
        console.warn('[openai] model refusal:', choice.message.refusal);
        return { model: fallbackModelTurn(context), degraded: true };
      }

      const parsed = choice?.message.parsed;
      if (parsed) return { model: parsed, degraded: false };

      // Structured parse gave us nothing — try validating raw content ourselves.
      const raw = choice?.message.content;
      const check = parseModelTurn(raw ? safeJson(raw) : null);
      if (check.ok && check.data) return { model: check.data, degraded: false };

      console.error('[openai] structured output failed validation:', check.error);
      return { model: fallbackModelTurn(context), degraded: true };
    } catch (err) {
      console.error(
        `[openai] evaluateTurn failed (${classifyError(err)}):`,
        err instanceof Error ? err.message : err,
      );
      return { model: fallbackModelTurn(context), degraded: true };
    }
  }

  private assemble(
    context: EvaluateContext,
    model: ModelTurn,
    degraded: boolean,
  ): AiTurnResult {
    const { analysis, characterResponse, demonstratedObjectiveIds } =
      normalizeModelTurn(model);

    const scored = scoreTurn(context, analysis, {
      demonstratedObjectiveIds,
      degraded,
    });

    return {
      characterResponse: {
        text: characterResponse.text,
        emotion: scored.lessonComplete ? 'happy' : characterResponse.emotion,
      },
      evaluation: scored.evaluation,
      analysis: { ...analysis, gap: scored.gap },
      learning: scored.learning,
      objectiveProgress: scored.objectiveProgress,
      lessonComplete: scored.lessonComplete,
      xpEarned: scored.xpEarned,
    };
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
