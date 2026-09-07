import type {
  AiTurnResult,
  ConversationState,
  ConversationTurn,
  Lesson,
} from '../types';
import {
  ConversationError,
  type ConversationService,
} from '../services/conversation';

export interface LessonProgress {
  objectivesCompleted: number;
  objectivesTotal: number;
  requiredCompleted: number;
  requiredTotal: number;
  playerTurns: number;
  minimumTurns: number;
  canComplete: boolean;
}

let localTurnCounter = 0;
const localTurnId = (): string => `local-turn-${localTurnCounter++}`;

/**
 * Owns one lesson's conversation. The UI drives it with `send()` and reads
 * `state`; it never talks to a ConversationService (or OpenAI) directly.
 */
export class ConversationEngine {
  private constructor(
    private readonly service: ConversationService,
    readonly lesson: Lesson,
    private conversationState: ConversationState,
    /** gap concepts the learner is already comfortable with (don't re-teach) */
    private readonly comfortableConcepts: string[],
  ) {}

  static async start(
    service: ConversationService,
    lesson: Lesson,
    comfortableConcepts: string[] = [],
  ): Promise<ConversationEngine> {
    const state = await service.startConversation({ lessonId: lesson.id });
    return new ConversationEngine(service, lesson, state, comfortableConcepts);
  }

  get state(): ConversationState {
    return this.conversationState;
  }

  get isComplete(): boolean {
    return this.conversationState.status === 'complete';
  }

  getProgress(): LessonProgress {
    const { objectives } = this.conversationState;
    const required = this.lesson.completionCriteria.requiredObjectives;
    const playerTurns = this.conversationState.turns.filter(
      (t) => t.speaker === 'player',
    ).length;
    const requiredCompleted = required.filter(
      (id) => objectives[id]?.completed,
    ).length;
    const objectivesCompleted = Object.values(objectives).filter(
      (o) => o.completed,
    ).length;

    return {
      objectivesCompleted,
      objectivesTotal: this.lesson.learningObjectives.length,
      requiredCompleted,
      requiredTotal: required.length,
      playerTurns,
      minimumTurns: this.lesson.completionCriteria.minimumTurns,
      canComplete:
        requiredCompleted === required.length &&
        playerTurns >= this.lesson.completionCriteria.minimumTurns,
    };
  }

  /**
   * Optimistically appends the player's turn, then sends it for evaluation and
   * appends the character's reply. Throws {@link ConversationError} on failure
   * (the player turn is rolled back so they can retry).
   */
  async send(rawMessage: string): Promise<AiTurnResult> {
    const message = rawMessage.trim();
    if (!message) {
      throw new ConversationError('Type something before sending.', 'input');
    }
    if (this.isComplete) {
      throw new ConversationError('This lesson is already finished.', 'invalid');
    }

    const playerTurn: ConversationTurn = {
      id: localTurnId(),
      speaker: 'player',
      text: message,
    };
    this.conversationState = {
      ...this.conversationState,
      turns: [...this.conversationState.turns, playerTurn],
    };

    try {
      const response = await this.service.sendMessage({
        conversationId: this.conversationState.conversationId,
        lessonId: this.lesson.id,
        message,
        comfortableConcepts: this.comfortableConcepts,
      });
      this.applyResult(response.turn, response.result);
      return response.result;
    } catch (error) {
      // roll back the optimistic player turn
      this.conversationState = {
        ...this.conversationState,
        turns: this.conversationState.turns.filter((t) => t.id !== playerTurn.id),
      };
      throw error;
    }
  }

  private applyResult(characterTurn: ConversationTurn, result: AiTurnResult): void {
    const objectives = { ...this.conversationState.objectives };
    for (const [id, done] of Object.entries(result.objectiveProgress)) {
      objectives[id] = { completed: done || (objectives[id]?.completed ?? false) };
    }

    const identifiedGaps = [...this.conversationState.identifiedGaps];
    if (result.analysis.gap) {
      const key = result.analysis.gap.concept.toLowerCase();
      if (!identifiedGaps.some((g) => g.concept.toLowerCase() === key)) {
        identifiedGaps.push(result.analysis.gap);
      }
    }

    const patternsUsedNaturally = [
      ...new Set([
        ...this.conversationState.patternsUsedNaturally,
        ...result.analysis.patternsUsedNaturally,
      ]),
    ];

    this.conversationState = {
      ...this.conversationState,
      turns: [
        ...this.conversationState.turns,
        { ...characterTurn, id: characterTurn.id || localTurnId() },
      ],
      objectives,
      identifiedGaps,
      patternsUsedNaturally,
      xp: this.conversationState.xp + result.xpEarned,
      status: result.lessonComplete ? 'complete' : 'active',
    };
  }
}
