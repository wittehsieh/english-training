import type {
  ConversationState,
  ConversationTurnResponse,
  SendMessageRequest,
  StartConversationRequest,
} from '../../types';

/**
 * The UI talks to this interface and nothing else.
 *
 * Today it is fulfilled by {@link MockConversationService} (pure front-end) or
 * {@link HttpConversationService} (our backend). Tomorrow the backend swaps its
 * internals for the OpenAI API — this interface does not change.
 */
export interface ConversationService {
  startConversation(request: StartConversationRequest): Promise<ConversationState>;
  sendMessage(request: SendMessageRequest): Promise<ConversationTurnResponse>;
}

export class ConversationError extends Error {
  constructor(
    message: string,
    readonly kind: 'network' | 'unavailable' | 'timeout' | 'invalid' | 'input',
  ) {
    super(message);
    this.name = 'ConversationError';
  }
}
