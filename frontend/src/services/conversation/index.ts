import { HttpConversationService } from './HttpConversationService';
import { MockConversationService } from './MockConversationService';
import type { ConversationService } from './ConversationService';

export * from './ConversationService';
export { MockConversationService } from './MockConversationService';
export { HttpConversationService } from './HttpConversationService';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

/**
 * Pick the implementation at runtime:
 *  - `VITE_API_BASE_URL` set  -> real backend (which later uses OpenAI)
 *  - otherwise                -> in-browser mock (GitHub Pages default)
 */
export const conversationService: ConversationService = apiBaseUrl
  ? new HttpConversationService(apiBaseUrl)
  : new MockConversationService();

export const isUsingMockConversation = !apiBaseUrl;
