import { getLesson } from '../../data/curriculum';
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
const nextId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${counter++}`;

/**
 * Fully client-side conversation service — what GitHub Pages runs.
 *
 * Fakes latency and a rule-based "AI" (see {@link runMockBrain}). Its response
 * shape is identical to what the backend / future OpenAI service returns, so
 * the UI cannot tell them apart.
 */
export class MockConversationService implements ConversationService {
  private readonly store = new Map<string, InternalConvo>();

  constructor(private readonly latencyMs = 550) {}

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
      identifiedGaps: [],
      patternsUsedNaturally: [],
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
    convo.turns.push({ id: nextId('turn'), speaker: 'player', text: message });

    const result = runMockBrain({
      lesson,
      playerMessage: message,
      completedObjectiveIds: convo.completedObjectiveIds,
      playerTurnNumber: convo.playerTurns,
      comfortableConcepts: request.comfortableConcepts ?? [],
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

    if (result.lessonComplete) this.store.delete(request.conversationId);

    return { conversationId: request.conversationId, turn: characterTurn, result };
  }

  private delay(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.latencyMs));
  }
}
