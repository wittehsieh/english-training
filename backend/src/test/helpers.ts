import { getLessonBrief } from '../data/lessons';
import type { ConversationTurn, EvaluateContext } from '../types';

/** Build an EvaluateContext for a lesson, as the route would. */
export function makeContext(
  lessonId: string,
  playerMessage: string,
  overrides: Partial<EvaluateContext> = {},
): EvaluateContext {
  const lesson = getLessonBrief(lessonId);
  if (!lesson) throw new Error(`test lesson not found: ${lessonId}`);

  const history: ConversationTurn[] = overrides.history ?? [
    {
      id: 't0',
      speaker: 'character',
      characterId: lesson.conversation.opening.characterId,
      text: lesson.conversation.opening.text,
    },
    { id: 't1', speaker: 'player', text: playerMessage },
  ];

  return {
    lesson,
    history,
    playerMessage,
    completedObjectiveIds: [],
    playerTurnNumber: 1,
    comfortableConcepts: [],
    ...overrides,
  };
}
