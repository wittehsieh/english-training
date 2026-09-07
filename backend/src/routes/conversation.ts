import { Router, type Request, type Response } from 'express';
import { getLessonBrief } from '../data/lessons';
import { createAIConversationService } from '../services/AIConversationService';
import type {
  ConversationState,
  ConversationTurn,
  SendMessageRequest,
  StartConversationRequest,
} from '../types';

const ai = createAIConversationService();

interface StoredConversation {
  lessonId: string;
  turns: ConversationTurn[];
  completedObjectiveIds: string[];
  playerTurns: number;
  createdAt: number;
}

/** In-memory only. Fine for a prototype; swap for Redis/DB later. */
const store = new Map<string, StoredConversation>();
const ONE_HOUR = 60 * 60 * 1000;

let counter = 0;
const id = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${counter++}`;

function sweep(): void {
  const cutoff = Date.now() - ONE_HOUR;
  for (const [key, convo] of store) {
    if (convo.createdAt < cutoff) store.delete(key);
  }
}

export const conversationRouter = Router();

conversationRouter.post(
  '/start',
  (req: Request<unknown, unknown, StartConversationRequest>, res: Response) => {
    sweep();
    const { lessonId } = req.body ?? {};
    const lesson = lessonId ? getLessonBrief(lessonId) : undefined;
    if (!lesson) {
      res.status(404).json({ error: `Unknown lesson: ${lessonId ?? '(none)'}` });
      return;
    }

    const conversationId = id('conv');
    const opening = lesson.conversation.opening;
    const openingTurn: ConversationTurn = {
      id: id('turn'),
      speaker: 'character',
      characterId: opening.characterId,
      text: opening.text,
      emotion: opening.emotion ?? 'talking',
    };

    store.set(conversationId, {
      lessonId: lesson.id,
      turns: [openingTurn],
      completedObjectiveIds: [],
      playerTurns: 0,
      createdAt: Date.now(),
    });

    const state: ConversationState = {
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
    res.json(state);
  },
);

conversationRouter.post(
  '/message',
  async (
    req: Request<unknown, unknown, SendMessageRequest>,
    res: Response,
  ): Promise<void> => {
    const { conversationId, message, comfortableConcepts } = req.body ?? {};
    const trimmed = (message ?? '').trim();
    if (!trimmed) {
      res.status(400).json({ error: 'Empty message.' });
      return;
    }

    const convo = conversationId ? store.get(conversationId) : undefined;
    if (!convo) {
      res.status(404).json({ error: 'Conversation not found or expired.' });
      return;
    }

    const lesson = getLessonBrief(convo.lessonId);
    if (!lesson) {
      res.status(500).json({ error: 'Lesson content missing.' });
      return;
    }

    convo.playerTurns += 1;
    convo.turns.push({ id: id('turn'), speaker: 'player', text: trimmed });

    try {
      const result = await ai.evaluateTurn({
        lesson,
        history: convo.turns,
        playerMessage: trimmed,
        completedObjectiveIds: convo.completedObjectiveIds,
        playerTurnNumber: convo.playerTurns,
        comfortableConcepts: Array.isArray(comfortableConcepts) ? comfortableConcepts : [],
      });

      convo.completedObjectiveIds = Object.entries(result.objectiveProgress)
        .filter(([, done]) => done)
        .map(([objectiveId]) => objectiveId);

      const characterTurn: ConversationTurn = {
        id: id('turn'),
        speaker: 'character',
        characterId: lesson.conversation.opening.characterId,
        text: result.characterResponse.text,
        emotion: result.characterResponse.emotion,
      };
      convo.turns.push(characterTurn);

      if (result.lessonComplete) store.delete(conversationId!);

      res.json({ conversationId, turn: characterTurn, result });
    } catch (err) {
      console.error('[conversation] evaluateTurn failed:', err);
      res.status(502).json({ error: 'The coaching service failed. Try again.' });
    }
  },
);

conversationRouter.get('/health', (_req, res) => {
  res.json({ ok: true, engine: ai.name, activeConversations: store.size });
});
