import { getLesson } from '../../data/lessons';
import type {
  ConversationState,
  ConversationTurn,
  ConversationTurnResponse,
  SendMessageRequest,
  StartConversationRequest,
} from '../../types';
import { ConversationError, type ConversationService } from './ConversationService';
import { runMockBrain } from './mockBrain';

interface InternalConvo {
  lessonId: string;
  turns: ConversationTurn[];
  completedObjectiveIds: string[];
  playerTurns: number;
}

let counter = 0;
const nextId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${counter++}`;

/**
 * Fully client-side conversation service. This is what GitHub Pages runs.
 *
 * It fakes latency and a rule-based "AI" (see {@link runMockBrain}). Replace it
 * with {@link HttpConversationService} by setting `VITE_API_BASE_URL`, and later
 * the backend replaces its rules with the OpenAI API.
 */
export class MockConversationService implements ConversationService {
  private readonly store = new Map<string, InternalConvo>();

  private readonly latencyMs: number;

  constructor(latencyMs = 550) {
    this.latencyMs = latencyMs;
  }

  async startConversation(
    request: StartConversationRequest,
  ): Promise<ConversationState> {
    const lesson = getLesson(request.lessonId);
    if (!lesson) {
      throw new ConversationError(`Unknown lesson: ${request.lessonId}`, 'invalid');
    }

    await this.delay();

    const conversationId = nextId('conv');
    const opening = lesson.conversation.opening;
    const openingTurn: ConversationTurn = {
      id: nextId('turn'),
      speaker: 'character',
      characterId: opening.characterId,
      text: opening.text,
      emotion: opening.emotion ?? 'talking',
    };

    this.store.set(conversationId, {
      lessonId: lesson.id,
      turns: [openingTurn],
      completedObjectiveIds: [],
      playerTurns: 0,
    });

    return {
      conversationId,
      lessonId: lesson.id,
      turns: [openingTurn],
      objectives: Object.fromEntries(
        lesson.learningObjectives.map((o) => [o.id, { completed: false }]),
      ),
      learnedPhrases: [],
      xp: 0,
      status: 'active',
    };
  }

  async sendMessage(
    request: SendMessageRequest,
  ): Promise<ConversationTurnResponse> {
    const message = request.message.trim();
    if (!message) {
      throw new ConversationError('Type something before sending.', 'input');
    }

    const convo = this.store.get(request.conversationId);
    if (!convo) {
      throw new ConversationError('This conversation has expired.', 'invalid');
    }

    const lesson = getLesson(convo.lessonId);
    if (!lesson) {
      throw new ConversationError('Lesson content is missing.', 'invalid');
    }

    await this.delay();

    convo.playerTurns += 1;
    convo.turns.push({
      id: nextId('turn'),
      speaker: 'player',
      text: message,
    });

    const result = runMockBrain({
      lesson,
      playerMessage: message,
      completedObjectiveIds: convo.completedObjectiveIds,
      playerTurnNumber: convo.playerTurns,
    });

    convo.completedObjectiveIds = Object.entries(result.objectiveProgress)
      .filter(([, done]) => done)
      .map(([id]) => id);

    const characterTurn: ConversationTurn = {
      id: nextId('turn'),
      speaker: 'character',
      characterId: lesson.conversation.opening.characterId,
      text: result.characterResponse.text,
      emotion: result.characterResponse.emotion,
    };
    convo.turns.push(characterTurn);

    if (result.lessonComplete) {
      this.store.delete(request.conversationId);
    }

    return {
      conversationId: request.conversationId,
      turn: characterTurn,
      result,
    };
  }

  private delay(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.latencyMs));
  }
}
