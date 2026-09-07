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

let counter = 0;
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${counter++}`;

/* --------------------------------------------------------------------------
 * Optional in-memory store — used ONLY when the client does not send its own
 * `history` (e.g. curl, older clients). The web client is stateless: it sends
 * the transcript + completed objectives on every turn, so this works on
 * serverless (Vercel) where instances share nothing.
 * ------------------------------------------------------------------------ */
interface StoredConversation {
  lessonId: string;
  turns: ConversationTurn[];
  completedObjectiveIds: string[];
  createdAt: number;
}
const store = new Map<string, StoredConversation>();
const ONE_HOUR = 60 * 60 * 1000;
function sweep(): void {
  const cutoff = Date.now() - ONE_HOUR;
  for (const [key, c] of store) if (c.createdAt < cutoff) store.delete(key);
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

    // Store is best-effort; the stateless client path does not depend on it.
    store.set(conversationId, {
      lessonId: lesson.id,
      turns: [openingTurn],
      completedObjectiveIds: [],
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
    const body = req.body ?? ({} as SendMessageRequest);
    const trimmed = (body.message ?? '').trim();
    if (!trimmed) {
      res.status(400).json({ error: 'Empty message.' });
      return;
    }

    const clientHistory = Array.isArray(body.history) ? body.history : null;
    const stored = body.conversationId ? store.get(body.conversationId) : undefined;

    const lessonId = body.lessonId || stored?.lessonId;
    const lesson = lessonId ? getLessonBrief(lessonId) : undefined;
    if (!lesson) {
      res.status(404).json({ error: 'Unknown lesson.' });
      return;
    }

    // Build the transcript + prior state from whichever source we have.
    let history: ConversationTurn[];
    let completedObjectiveIds: string[];

    if (clientHistory) {
      // Stateless path — client is the source of truth.
      const playerTurn: ConversationTurn = {
        id: id('turn'),
        speaker: 'player',
        text: trimmed,
      };
      const endsWithThisMessage =
        clientHistory[clientHistory.length - 1]?.speaker === 'player' &&
        clientHistory[clientHistory.length - 1]?.text === trimmed;
      history = endsWithThisMessage ? clientHistory : [...clientHistory, playerTurn];
      completedObjectiveIds = Array.isArray(body.completedObjectiveIds)
        ? body.completedObjectiveIds
        : [];
    } else if (stored) {
      stored.turns.push({ id: id('turn'), speaker: 'player', text: trimmed });
      history = stored.turns;
      completedObjectiveIds = stored.completedObjectiveIds;
    } else {
      res.status(404).json({ error: 'Conversation not found. Send `history` with the request.' });
      return;
    }

    const playerTurnNumber = history.filter((t) => t.speaker === 'player').length;

    try {
      const result = await ai.evaluateTurn({
        lesson,
        history,
        playerMessage: trimmed,
        completedObjectiveIds,
        playerTurnNumber,
        comfortableConcepts: Array.isArray(body.comfortableConcepts)
          ? body.comfortableConcepts
          : [],
      });

      const characterTurn: ConversationTurn = {
        id: id('turn'),
        speaker: 'character',
        characterId: lesson.conversation.opening.characterId,
        text: result.characterResponse.text,
        emotion: result.characterResponse.emotion,
      };

      if (stored && !clientHistory) {
        stored.completedObjectiveIds = Object.entries(result.objectiveProgress)
          .filter(([, done]) => done)
          .map(([oid]) => oid);
        stored.turns.push(characterTurn);
        if (result.lessonComplete) store.delete(body.conversationId!);
      }

      res.json({
        conversationId: body.conversationId ?? id('conv'),
        turn: characterTurn,
        result,
      });
    } catch (err) {
      console.error('[conversation] evaluateTurn failed:', err);
      res.status(502).json({ error: 'The coaching service failed. Try again.' });
    }
  },
);

conversationRouter.get('/health', (_req, res) => {
  res.json({ ok: true, engine: ai.name });
});
