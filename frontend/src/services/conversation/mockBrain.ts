import type {
  AiTurnResult,
  CharacterEmotion,
  GapType,
  GapPriority,
  Lesson,
  LearningFeedback,
  LanguageGapObservation,
  ResponseEvaluation,
  TurnLanguageAnalysis,
} from '../../types';
import { PHRASE_PATTERNS } from '../../data/curriculum';

/* ==========================================================================
 * mockBrain — a rule-based stand-in for the future OpenAI evaluator.
 *
 * It follows the learningModel.json contract:
 *   1. infer intent first
 *   2. judge whether the meaning was communicated
 *   3. only surface a gap when the English genuinely fell short
 *   4. never require the lesson's target expressions verbatim
 *   5. don't re-teach concepts the player is already comfortable with
 *
 * Everything here is throw-away once OpenAIConversationService lands.
 * ======================================================================== */

export interface BrainInput {
  lesson: Lesson;
  playerMessage: string;
  completedObjectiveIds: string[];
  playerTurnNumber: number;
  /** gap concepts the player has reached "familiar"/"mastered" on */
  comfortableConcepts: string[];
}

interface GapRule {
  id: string;
  concept: string;
  patternId?: string;
  gapType: GapType;
  priority: GapPriority;
  test: RegExp;
  /** guard: don't fire if this also matches (already correct) */
  unless?: RegExp;
  better: (message: string) => string;
  explanation: string;
}

const GAP_RULES: GapRule[] = [
  {
    id: 'wait-for',
    concept: 'wait for + thing/person',
    patternId: 'wait-for',
    gapType: 'sentence_pattern',
    priority: 'important',
    test: /\bwait(ing)?\s+(the|a|my|your|his|her|their|it|feedback|him|them|response|reply|review)\b/i,
    unless: /\bwait(ing)?\s+for\b/i,
    better: (m) =>
      m.replace(/\bwait(ing)?\s+/i, (s) => s.replace(/\s+$/, '') + ' for '),
    explanation: 'In English you "wait for" something — the preposition is required.',
  },
  {
    id: 'by-deadline',
    concept: 'by + deadline (not "until")',
    patternId: 'by-deadline',
    gapType: 'word_choice',
    priority: 'important',
    test: /\b(finish|done|ready|complete|have it done)\b[^.]*\buntil\b/i,
    better: (m) => m.replace(/\buntil\b/i, 'by'),
    explanation: 'For a completion deadline use "by Friday", not "until Friday".',
  },
  {
    id: 'almost-done',
    concept: 'be + almost done/finished',
    gapType: 'grammar',
    priority: 'useful',
    test: /\bi\s+almost\s+(finish|finished|done|complete)\b/i,
    better: () => "I'm almost done with it.",
    explanation: 'Use "I\'m almost done/finished with it" for something nearly complete.',
  },
  {
    id: 'blocked-on',
    concept: 'be blocked on/by + thing',
    gapType: 'grammar',
    priority: 'useful',
    test: /\bi\s+(am\s+)?block(ed)?\s+(in|at|on the|by the)?\b/i,
    unless: /\bi'?m\s+blocked\s+(on|by)\b/i,
    better: () => "I'm blocked on the staging environment.",
    explanation: 'Say "I\'m blocked on X" (or "blocked by X") to name what is stopping you.',
  },
  {
    id: 'discuss-no-about',
    concept: 'discuss + thing (no "about")',
    gapType: 'word_choice',
    priority: 'optional',
    test: /\bdiscuss\s+about\b/i,
    better: (m) => m.replace(/\bdiscuss\s+about\b/i, 'discuss'),
    explanation: '"Discuss" already means "talk about" — drop "about".',
  },
  {
    id: 'responsible-for',
    concept: "be responsible for + thing",
    gapType: 'grammar',
    priority: 'useful',
    test: /\bi\s+responsible\s+for\b/i,
    better: (m) => m.replace(/\bi\s+responsible\b/i, "I'm responsible"),
    explanation: 'Needs the verb "be": "I\'m responsible for ...".',
  },
  {
    id: 'explain-to',
    concept: 'explain + thing + to + person',
    patternId: 'explain-to',
    gapType: 'sentence_pattern',
    priority: 'useful',
    test: /\bexplain\s+me\b/i,
    better: (m) => m.replace(/\bexplain\s+me\b/i, 'explain it to me'),
    explanation: 'It\'s "explain something to someone" — "explain it to me".',
  },
];

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** Rough intent inference: keyword buckets, else the current open objective. */
function inferIntent(message: string, openObjectiveDesc: string): string {
  const m = message.toLowerCase();
  if (/\bweekend|saturday|sunday\b/.test(m)) return 'talk about your weekend';
  if (/\bwait|block|stuck|depend/.test(m)) return 'explain what is blocking your progress';
  if (/\bfriday|monday|tomorrow|by |eta|deadline|week\b/.test(m))
    return 'give a timeline for finishing the work';
  if (/\bworking on|work on|building|implement/.test(m))
    return 'say what you are currently working on';
  if (/\bhelp|take a look|could you|would you\b/.test(m)) return 'ask a coworker for help';
  if (/\bsorry|behind|late|slip|longer than\b/.test(m))
    return 'let them know the work is running late';
  if (/\bi think we|we could|one option|maybe we should\b/.test(m))
    return 'propose a solution or option';
  return openObjectiveDesc.toLowerCase();
}

function detectNaturalPatterns(message: string, excludePatternId: string | undefined): string[] {
  const lower = message.toLowerCase();
  const used: string[] = [];
  for (const p of PHRASE_PATTERNS) {
    if (p.id === excludePatternId) continue;
    const head = p.pattern.split('+')[0]!.trim().toLowerCase();
    if (head.length < 2) continue;
    const re = new RegExp(`\\b${head.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(lower)) used.push(p.id);
  }
  return [...new Set(used)];
}

const ACK: Record<ResponseEvaluation['overall'], string[]> = {
  excellent: ['Nice — that’s really clear.', 'Got it, that makes total sense.'],
  good: ['Okay, got it.', 'Makes sense.'],
  ok: ['Right.', 'Mm-hm, okay.'],
  poor: ['Sorry — could you say a bit more about that?', 'Hmm, tell me a little more.'],
};

const FOLLOW_UPS = [
  'What’s the next step from your side?',
  'Anything you need from me?',
  'How are you feeling about the timeline?',
  'Is anything slowing you down?',
  'What are you focusing on today?',
  'And how did that go?',
];

function emotionFor(overall: ResponseEvaluation['overall'], done: boolean): CharacterEmotion {
  if (done) return 'happy';
  if (overall === 'excellent') return 'happy';
  if (overall === 'poor') return 'concerned';
  return 'talking';
}

export function runMockBrain(input: BrainInput): AiTurnResult {
  const { lesson, playerMessage, completedObjectiveIds, playerTurnNumber, comfortableConcepts } =
    input;

  const allObjectiveIds = lesson.learningObjectives.map((o) => o.id);
  const openObjective =
    lesson.learningObjectives.find((o) => !completedObjectiveIds.includes(o.id)) ??
    lesson.learningObjectives[lesson.learningObjectives.length - 1]!;

  const words = wordCount(playerMessage);
  const meaningCommunicated = words >= 3;

  const rule = GAP_RULES.find(
    (r) => r.test.test(playerMessage) && !(r.unless && r.unless.test(playerMessage)),
  );
  const suppressed = rule ? comfortableConcepts.includes(gapConceptKey(rule.concept)) : false;

  const intent = inferIntent(playerMessage, openObjective.description);

  // ---- gap observation -------------------------------------------------
  let gap: LanguageGapObservation | null = null;
  if (rule && meaningCommunicated && !suppressed) {
    gap = {
      concept: rule.concept,
      gapType: rule.gapType,
      priority: rule.priority,
      userIntent: intent,
      userAttempt: playerMessage,
      betterExpression: rule.better(playerMessage),
      patternId: rule.patternId,
      explanation: rule.explanation,
    };
  }

  const patternsUsedNaturally = gap
    ? []
    : detectNaturalPatterns(playerMessage, rule?.patternId);

  // ---- evaluation ----------------------------------------------------
  const grammar: ResponseEvaluation['grammar'] = rule
    ? rule.gapType === 'grammar'
      ? 'poor'
      : 'ok'
    : 'good';
  const hasContraction = /\b\w+'\w+\b/.test(playerMessage);
  const natural =
    !rule && (hasContraction || patternsUsedNaturally.length > 0) && words >= 4;
  const naturalness: ResponseEvaluation['naturalness'] = natural ? 'natural' : 'ok';
  const contextAppropriate = meaningCommunicated && !/\b(hey man|dude|whatever)\b/i.test(playerMessage);

  let overall: ResponseEvaluation['overall'] = 'ok';
  if (!meaningCommunicated) overall = 'poor';
  else if (!rule && natural) overall = 'excellent';
  else if (!rule) overall = 'good';
  else if (rule.priority === 'optional' || rule.priority === 'useful') overall = 'good';

  const evaluation: ResponseEvaluation = {
    overall,
    meaningCorrect: meaningCommunicated,
    grammar,
    naturalness,
  };

  const analysis: TurnLanguageAnalysis = {
    understoodIntent: intent,
    meaningCommunicated,
    grammarOk: grammar !== 'poor',
    natural,
    contextAppropriate,
    gap,
    patternsUsedNaturally,
  };

  // ---- objective progress -----------------------------------------------
  const objectiveProgress: Record<string, boolean> = {};
  for (const id of allObjectiveIds) {
    objectiveProgress[id] = completedObjectiveIds.includes(id);
  }
  if (meaningCommunicated && !objectiveProgress[openObjective.id]) {
    objectiveProgress[openObjective.id] = true;
  }

  const requiredDone = lesson.completionCriteria.requiredObjectives.every(
    (id) => objectiveProgress[id],
  );
  const lessonComplete =
    requiredDone && playerTurnNumber >= lesson.completionCriteria.minimumTurns;

  // ---- xp -------------------------------------------------------------
  let xpEarned = { excellent: 15, good: 10, ok: 5, poor: 0 }[overall];
  if (patternsUsedNaturally.length > 0) xpEarned += 10;
  if (lessonComplete) xpEarned += lesson.xp;

  // ---- learning feedback (subtle) -------------------------------------
  const learning: LearningFeedback = gap
    ? {
        kind: 'correction',
        shouldShow: true,
        betterExpression: gap.betterExpression,
        explanation: gap.explanation,
      }
    : patternsUsedNaturally.length > 0 && overall === 'excellent'
      ? {
          kind: 'pattern-used',
          shouldShow: false,
          betterExpression: null,
          explanation: null,
        }
      : { kind: 'none', shouldShow: false, betterExpression: null, explanation: null };

  // ---- character line ------------------------------------------------
  const ackPool = ACK[overall];
  const ack = ackPool[playerTurnNumber % ackPool.length] ?? ackPool[0]!;
  const completedCount = allObjectiveIds.filter((id) => objectiveProgress[id]).length;
  let text: string;
  if (lessonComplete) {
    text = `${ack} That’s everything I needed — thanks!`;
  } else if (completedCount >= lesson.completionCriteria.requiredObjectives.length) {
    text = `${ack} Anything else before we wrap up?`;
  } else {
    const follow = FOLLOW_UPS[(playerTurnNumber + completedCount) % FOLLOW_UPS.length]!;
    text = `${ack} ${follow}`;
  }

  return {
    characterResponse: { text, emotion: emotionFor(overall, lessonComplete) },
    evaluation,
    analysis,
    learning,
    objectiveProgress,
    lessonComplete,
    xpEarned,
  };
}

function gapConceptKey(concept: string): string {
  return concept
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
