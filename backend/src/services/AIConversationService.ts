import type { AiTurnResult, EvaluateContext } from '../types';
import { MockAIConversationService } from './MockAIConversationService';

/**
 * The one seam between "our app" and "the AI".
 *
 * Route handlers depend on this interface only. Today it is the rule-based
 * {@link MockAIConversationService}; dropping in an OpenAI-backed
 * implementation (see `OpenAIConversationService.ts`) requires no route changes.
 */
export interface AIConversationService {
  readonly name: string;
  /** Evaluate one player message and produce the character's reply. */
  evaluateTurn(context: EvaluateContext): Promise<AiTurnResult>;
}

export function createAIConversationService(): AIConversationService {
  const hasKey = Boolean(process.env.OPENAI_API_KEY);

  if (hasKey) {
    // Phase 2: return new OpenAIConversationService({ apiKey: process.env.OPENAI_API_KEY!, model: process.env.OPENAI_MODEL });
    console.warn(
      '[ai] OPENAI_API_KEY is set but OpenAIConversationService is not wired yet — using the mock.',
    );
  }

  return new MockAIConversationService();
}
