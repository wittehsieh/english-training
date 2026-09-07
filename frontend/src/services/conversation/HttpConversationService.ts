import type {
  ConversationState,
  ConversationTurnResponse,
  SendMessageRequest,
  StartConversationRequest,
} from '../../types';
import { ConversationError, type ConversationService } from './ConversationService';

// Longer than the backend's own OpenAI timeout so its graceful fallback wins.
const TIMEOUT_MS = 35_000;

/**
 * Talks to our own backend (`backend/`). The backend — not this class — is the
 * only place that knows about OpenAI. The response shapes are identical to
 * {@link MockConversationService} so the UI cannot tell them apart.
 */
export class HttpConversationService implements ConversationService {
  constructor(private readonly baseUrl: string) {}

  startConversation(request: StartConversationRequest): Promise<ConversationState> {
    return this.post<ConversationState>('/api/conversation/start', request);
  }

  sendMessage(request: SendMessageRequest): Promise<ConversationTurnResponse> {
    if (!request.message.trim()) {
      return Promise.reject(new ConversationError('Type something before sending.', 'input'));
    }
    return this.post<ConversationTurnResponse>('/api/conversation/message', request);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new ConversationError(
          `Backend responded ${response.status}`,
          response.status >= 500 ? 'unavailable' : 'invalid',
        );
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ConversationError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ConversationError('The request timed out.', 'timeout');
      }
      throw new ConversationError('Could not reach the server.', 'network');
    } finally {
      clearTimeout(timer);
    }
  }
}
