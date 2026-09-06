import type {
  AiTurnResult,
  CharacterEmotion,
  Lesson,
  LearningFeedback,
  ResponseEvaluation,
  TargetPhrase,
} from '../../types';

/* ==========================================================================
 * mockBrain — a deliberately simple, rule-based stand-in for the future
 * OpenAI-powered evaluator. It is NOT meant to be smart; it exists so the
 * whole game loop can be built and tested without a network or an API key.
 *
 * Everything in this file is throw-away once `OpenAIConversationService`
 * lands on the backend.
 * ======================================================================== */

export interface BrainInput {
  lesson: Lesson;
  playerMessage: string;
  /** objective ids already completed before this turn */
  completedObjectiveIds: string[];
  /** number of player turns taken so far (including this one) */
  playerTurnNumber: number;
}

const COMMON_ESL_PATTERNS: { test: RegExp; better: string; note: string }[] = [
  {
    test: /\bi\s+wait(ing)?\s+(for\s+)?/i,
    better: "I'm still waiting for the latest UX feedback.",
    note: 'Use "I\'m waiting for ..." — the verb needs "am" and the preposition "for".',
  },
  {
    test: /\bi\s+almost\s+finish\b/i,
    better: "I'm almost finished with it.",
    note: 'For something nearly complete, say "I\'m almost finished/done with it."',
  },
  {
    test: /\bcan\s+finish\s+until\b/i,
    better: 'I should have it done by Friday.',
    note: 'For a deadline use "by Friday", not "until Friday".',
  },
  {
    test: /\bno\s+blocker\b/i,
    better: 'Nothing major at the moment.',
    note: '"Nothing major at the moment" sounds more natural than "no blocker".',
  },
  {
    test: /\bi\s+am\s+block\b/i,
    better: "I'm blocked on the staging database.",
    note: 'Say "I\'m blocked on X" to name what is stopping you.',
  },
];

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function usesTargetPhrase(message: string, phrases: TargetPhrase[]): TargetPhrase | null {
  const normalized = message.toLowerCase();
  for (const phrase of phrases) {
    const keywords = phrase.phrase
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3);
    if (keywords.length === 0) continue;
    const hits = keywords.filter((w) => normalized.includes(w)).length;
    if (hits / keywords.length >= 0.6) return phrase;
  }
  return null;
}

function evaluate(
  message: string,
  matchedError: (typeof COMMON_ESL_PATTERNS)[number] | undefined,
  usedPhrase: TargetPhrase | null,
): ResponseEvaluation {
  const words = wordCount(message);
  const meaningCorrect = words >= 3;
  const grammar: ResponseEvaluation['grammar'] = matchedError
    ? 'ok'
    : words >= 3
      ? 'good'
      : 'ok';
  const hasContraction = /\b\w+'\w+\b/.test(message);
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

  return { overall, meaningCorrect, grammar, naturalness };
}

function buildFeedback(
  matchedError: (typeof COMMON_ESL_PATTERNS)[number] | undefined,
  usedPhrase: TargetPhrase | null,
): LearningFeedback {
  if (usedPhrase) {
    return {
      kind: 'phrase-learned',
      shouldCorrect: false,
      correction: null,
      betterExpression: usedPhrase.phrase,
      explanation: usedPhrase.usage,
    };
  }
  if (matchedError) {
    return {
      kind: 'correction',
      shouldCorrect: true,
      correction: null,
      betterExpression: matchedError.better,
      explanation: matchedError.note,
    };
  }
  return {
    kind: 'none',
    shouldCorrect: false,
    correction: null,
    betterExpression: null,
    explanation: null,
  };
}

const ACK_BY_RATING: Record<ResponseEvaluation['overall'], string[]> = {
  excellent: ['Nice, that’s exactly it.', 'Great — that’s really clear.'],
  good: ['Got it.', 'Okay, makes sense.'],
  ok: ['Right, okay.', 'Mm-hm.'],
  poor: ['Sorry, could you say a bit more?', 'Hmm, tell me a little more about that.'],
};

const FOLLOW_UPS = [
  'What’s the next step from your side?',
  'Anything you need from me?',
  'And how are you feeling about the timeline?',
  'Is anything slowing you down right now?',
  'Cool — what are you focusing on today?',
];

function emotionFor(rating: ResponseEvaluation['overall']): CharacterEmotion {
  if (rating === 'excellent') return 'happy';
  if (rating === 'poor') return 'concerned';
  return 'talking';
}

export function runMockBrain(input: BrainInput): AiTurnResult {
  const { lesson, playerMessage, completedObjectiveIds, playerTurnNumber } = input;
  const required = lesson.completionCriteria.requiredObjectives;
  const allObjectiveIds = lesson.learningObjectives.map((o) => o.id);

  const matchedError = COMMON_ESL_PATTERNS.find((p) => p.test.test(playerMessage));
  const usedPhrase = usesTargetPhrase(playerMessage, lesson.targetPhrases);
  const evaluation = evaluate(playerMessage, matchedError, usedPhrase);
  const learning = buildFeedback(matchedError, usedPhrase);

  // Objective progress: a "real enough" answer advances the next open objective.
  const objectiveProgress: Record<string, boolean> = {};
  for (const id of allObjectiveIds) {
    objectiveProgress[id] = completedObjectiveIds.includes(id);
  }
  const nextOpen = allObjectiveIds.find((id) => !objectiveProgress[id]);
  if (nextOpen && evaluation.meaningCorrect) {
    objectiveProgress[nextOpen] = true;
  }

  const completedCount = allObjectiveIds.filter((id) => objectiveProgress[id]).length;
  const requiredDone = required.every((id) => objectiveProgress[id]);
  const lessonComplete =
    requiredDone && playerTurnNumber >= lesson.completionCriteria.minimumTurns;

  // XP
  let xpEarned = { excellent: 15, good: 10, ok: 5, poor: 0 }[evaluation.overall];
  if (usedPhrase) xpEarned += 20;
  if (lessonComplete) xpEarned += 100;

  const newPhrases: TargetPhrase[] = usedPhrase ? [usedPhrase] : [];

  // Character line
  const ackPool = ACK_BY_RATING[evaluation.overall];
  const ack = ackPool[playerTurnNumber % ackPool.length] ?? ackPool[0]!;
  let text: string;
  if (lessonComplete) {
    text = `${ack} That’s everything I needed — thanks for the update!`;
  } else if (completedCount >= required.length && !lessonComplete) {
    text = `${ack} Anything else you want to flag before we wrap up?`;
  } else {
    const follow = FOLLOW_UPS[(playerTurnNumber + completedCount) % FOLLOW_UPS.length]!;
    text = `${ack} ${follow}`;
  }

  return {
    characterResponse: {
      text,
      emotion: lessonComplete ? 'happy' : emotionFor(evaluation.overall),
    },
    evaluation,
    learning,
    objectiveProgress,
    newPhrases,
    lessonComplete,
    xpEarned,
  };
}
