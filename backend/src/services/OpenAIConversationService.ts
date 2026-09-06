import type { AiTurnResult, EvaluateContext } from '../types';
import type { AIConversationService } from './AIConversationService';
import { buildSystemPrompt, formatTranscript } from '../prompts/systemPrompt';

/* ==========================================================================
 * PHASE 2 — not wired up yet.
 *
 * This is the real implementation's skeleton. When you're ready:
 *   1. `npm i openai` in `backend/`
 *   2. import OpenAI and implement `evaluateTurn` below
 *   3. in `AIConversationService.ts`, return `new OpenAIConversationService(...)`
 *      when `OPENAI_API_KEY` is present
 *
 * Nothing else in the app changes — routes and the frontend already speak the
 * `AiTurnResult` contract.
 * ======================================================================== */

interface OpenAIConfig {
  apiKey: string;
  model?: string;
}

export class OpenAIConversationService implements AIConversationService {
  readonly name = 'openai';

  constructor(private readonly config: OpenAIConfig) {}

  async evaluateTurn(context: EvaluateContext): Promise<AiTurnResult> {
    const systemPrompt = buildSystemPrompt(context.lesson);
    const transcript = formatTranscript(context.history);

    void systemPrompt;
    void transcript;
    void this.config;

    // const client = new OpenAI({ apiKey: this.config.apiKey });
    // const completion = await client.chat.completions.create({
    //   model: this.config.model ?? 'gpt-4o-mini',
    //   response_format: { type: 'json_object' },
    //   messages: [
    //     { role: 'system', content: systemPrompt },
    //     { role: 'user', content: `${transcript}\nLearner: ${context.playerMessage}` },
    //   ],
    // });
    // return parseAndValidate(completion.choices[0].message.content);

    throw new Error('OpenAIConversationService is not implemented yet (Phase 2).');
  }
}
