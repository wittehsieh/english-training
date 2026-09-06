import type {
  AiTurnResult,
  EvaluateContext,
  ResponseEvaluation,
  TargetPhrase,
} from '../types';
import type { AIConversationService } from './AIConversationService';

/* ==========================================================================
 * MockAIConversationService
 *
 * A rule-based stand-in for the OpenAI-powered evaluator. It exists ONLY so
 * the API contract and the whole game loop can be exercised without a key or
 * a network call. Every heuristic here is throw-away once
 * `OpenAIConversationService` is wired in.
 * ======================================================================== */

const ESL_PATTERNS: { test: RegExp; better: string; note: string }[] = [
  {
    test: /\bi\s+wait(ing)?\s+(for\s+)?/i,
    better: "I'm still waiting for the latest UX feedback.",
    note: 'Use "I\'m waiting for ..." — you need "am" and the preposition "for".',
  },
  {
    test: /\bi\s+almost\s+finish\b/i,
    better: "I'm almost finished with it.",
    note: 'For something nearly complete: "I\'m almost finished/done with it."',
  },
  {
    test: /\bfinish\s+until\b/i,
    better: 'I should have it done by Friday.',
    note: 'For a deadline use "by Friday", not "until Friday".',
  },
  {
    test: /\bno\s+blocker\b/i,
    better: 'Nothing major at the moment.',
    note: '"Nothing major at the moment" sounds more natural.',
  },
];

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

function matchTargetPhrase(
  message: string,
  phrases: TargetPhrase[],
): TargetPhrase | null {
  const lower = message.toLowerCase();
  for (const phrase of phrases) {
    const keywords = phrase.phrase
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3);
    if (!keywords.length) continue;
    const hits = keywords.filter((w) => lower.includes(w)).length;
    if (hits / keywords.length >= 0.6) return phrase;
  }
  return null;
}

const ACK: Record<ResponseEvaluation['overall'], string[]> = {
  excellent: ['Nice, that’s exactly it.', 'Great — really clear.'],
  good: ['Got it.', 'Okay, makes sense.'],
  ok: ['Right, okay.', 'Mm-hm.'],
  poor: ['Sorry, could you say a bit more?', 'Hmm, tell me a little more.'],
};

const FOLLOW_UPS = [
  'What’s the next step from your side?',
  'Anything you need from me?',
  'How are you feeling about the timeline?',
  'Is anything slowing you down right now?',
  'What are you focusing on today?',
];

export class MockAIConversationService implements AIConversationService {
  readonly name = 'mock';

  async evaluateTurn(context: EvaluateContext): Promise<AiTurnResult> {
    // Simulate model latency.
    await new Promise((r) => setTimeout(r, 350));

    const { lesson, playerMessage, completedObjectiveIds, playerTurnNumber } =
      context;
    const words = wordCount(playerMessage);

    const matchedError = ESL_PATTERNS.find((p) => p.test.test(playerMessage));
    const usedPhrase = matchTargetPhrase(playerMessage, lesson.targetPhrases);

    const meaningCorrect = words >= 3;
    const grammar: ResponseEvaluation['grammar'] = matchedError ? 'ok' : 'good';
    const hasContraction = /\b\w+'\w+\b/.test(playerMessage);
    const naturalness: ResponseEvaluation['naturalness'] = usedPhrase
      ? 'natural'
      : matchedError
        ? 'ok'
        : hasContraction && words >= 4
          ? 'natural'
          : 'ok';

    let overall: ResponseEvaluation['overall'] = 'ok';
    if (words < 2) overall = 'poor';
    else if (usedPhrase) overall = 'excellent';
    else if (grammar === 'good' && naturalness === 'natural') overall = 'excellent';
    else if (grammar === 'good') overall = 'good';

    const evaluation: ResponseEvaluation = {
      overall,
      meaningCorrect,
      grammar,
      naturalness,
    };

    // Advance the next open objective when the answer is "real enough".
    const allIds = lesson.learningObjectives.map((o) => o.id);
    const objectiveProgress: Record<string, boolean> = {};
    for (const id of allIds) {
      objectiveProgress[id] = completedObjectiveIds.includes(id);
    }
    const nextOpen = allIds.find((id) => !objectiveProgress[id]);
    if (nextOpen && meaningCorrect) objectiveProgress[nextOpen] = true;

    const requiredDone = lesson.completionCriteria.requiredObjectives.every(
      (id) => objectiveProgress[id],
    );
    const lessonComplete =
      requiredDone &&
      playerTurnNumber >= lesson.completionCriteria.minimumTurns;

    let xpEarned = { excellent: 15, good: 10, ok: 5, poor: 0 }[overall];
    if (usedPhrase) xpEarned += 20;
    if (lessonComplete) xpEarned += 100;

    const learning: AiTurnResult['learning'] = usedPhrase
      ? {
          kind: 'phrase-learned',
          shouldCorrect: false,
          correction: null,
          betterExpression: usedPhrase.phrase,
          explanation: usedPhrase.usage,
        }
      : matchedError
        ? {
            kind: 'correction',
            shouldCorrect: true,
            correction: null,
            betterExpression: matchedError.better,
            explanation: matchedError.note,
          }
        : {
            kind: 'none',
            shouldCorrect: false,
            correction: null,
            betterExpression: null,
            explanation: null,
          };

    const ackPool = ACK[overall];
    const ack = ackPool[playerTurnNumber % ackPool.length] ?? ackPool[0]!;
    const completedCount = allIds.filter((id) => objectiveProgress[id]).length;
    let text: string;
    if (lessonComplete) {
      text = `${ack} That’s everything I needed — thanks!`;
    } else if (completedCount >= lesson.completionCriteria.requiredObjectives.length) {
      text = `${ack} Anything else before we wrap up?`;
    } else {
      const follow =
        FOLLOW_UPS[(playerTurnNumber + completedCount) % FOLLOW_UPS.length]!;
      text = `${ack} ${follow}`;
    }

    const emotion = lessonComplete
      ? 'happy'
      : overall === 'excellent'
        ? 'happy'
        : overall === 'poor'
          ? 'concerned'
          : 'talking';

    return {
      characterResponse: { text, emotion },
      evaluation,
      learning,
      objectiveProgress,
      newPhrases: usedPhrase ? [usedPhrase] : [],
      lessonComplete,
      xpEarned,
    };
  }
}
