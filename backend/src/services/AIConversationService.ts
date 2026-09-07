import type { AiTurnResult, EvaluateContext } from '../types';
import { MockAIConversationService } from './MockAIConversationService';
import {
  OpenAIConversationService,
  readOpenAIConfig,
} from './OpenAIConversationService';

/**
 * The one seam between "our app" and "the AI".
 *
 * Route handlers depend on this interface only.
 *   - `OPENAI_API_KEY` set  -> {@link OpenAIConversationService} (the real coworker)
 *   - otherwise             -> {@link MockAIConversationService} (rules, offline, free)
 * Both return the exact same `AiTurnResult`; the frontend can't tell them apart.
 */
export interface AIConversationService {
  readonly name: string;
  evaluateTurn(context: EvaluateContext): Promise<AiTurnResult>;
}

export function createAIConversationService(
  env: NodeJS.ProcessEnv = process.env,
): AIConversationService {
  const openAIConfig = readOpenAIConfig(env);

  if (openAIConfig) {
    console.log(
      `[ai] using OpenAIConversationService (model: ${openAIConfig.model})`,
    );
    return new OpenAIConversationService(openAIConfig);
  }

  console.log('[ai] using MockAIConversationService (no OPENAI_API_KEY)');
  return new MockAIConversationService();
}
