import phrasePatternsJson from '../data/curriculum/phrasePatterns.json';
import type {
  AiTurnResult,
  EvaluateContext,
  GapPriority,
  GapType,
  LanguageGapObservation,
  LearningFeedback,
  ResponseEvaluation,
  TurnLanguageAnalysis,
} from '../types';
import type { AIConversationService } from './AIConversationService';

/* ==========================================================================
 * MockAIConversationService
 *
 * Rule-based stand-in for the OpenAI evaluator, following learningModel.json:
 * infer intent -> judge meaning -> only surface a gap when the English really
 * fell short -> never require target expressions -> don't re-teach concepts
 * the learner is already comfortable with.
 *
 * Throw-away once OpenAIConversationService is implemented.
 * ======================================================================== */

const PATTERNS = (phrasePatternsJson as unknown as {
  patterns: { id: string; pattern: string }[];
}).patterns;

interface GapRule {
  concept: string;
  patternId?: string;
  gapType: GapType;
  priority: GapPriority;
  test: RegExp;
  unless?: RegExp;
  better: (m: string) => string;
  explanation: string;
}

const GAP_RULES: GapRule[] = [
  {
    concept: 'wait for + thing/person',
    patternId: 'wait-for',
    gapType: 'sentence_pattern',
    priority: 'important',
    test: /\bwait(ing)?\s+(the|a|my|your|his|her|their|it|feedback|him|them|response|reply|review)\b/i,
    unless: /\bwait(ing)?\s+for\b/i,
    better: (m) => m.replace(/\bwait(ing)?\s+/i, (s) => s.replace(/\s+$/, '') + ' for '),
    explanation: 'In English you "wait for" something — the preposition is required.',
  },
  {
    concept: 'by + deadline (not "until")',
    patternId: 'by-deadline',
    gapType: 'word_choice',
    priority: 'important',
    test: /\b(finish|done|ready|complete)\b[^.]*\buntil\b/i,
    better: (m) => m.replace(/\buntil\b/i, 'by'),
    explanation: 'For a completion deadline use "by Friday", not "until Friday".',
  },
  {
    concept: 'be + almost done/finished',
    gapType: 'grammar',
    priority: 'useful',
    test: /\bi\s+almost\s+(finish|finished|done|complete)\b/i,
    better: () => "I'm almost done with it.",
    explanation: 'Use "I\'m almost done/finished with it" for something nearly complete.',
  },
  {
    concept: 'be blocked on/by + thing',
    gapType: 'grammar',
    priority: 'useful',
    test: /\bi\s+(am\s+)?block(ed)?\s+(in|at|on the|by the)?\b/i,
    unless: /\bi'?m\s+blocked\s+(on|by)\b/i,
    better: () => "I'm blocked on the staging environment.",
    explanation: 'Say "I\'m blocked on X" to name what is stopping you.',
  },
  {
    concept: 'discuss + thing (no "about")',
    gapType: 'word_choice',
    priority: 'optional',
    test: /\bdiscuss\s+about\b/i,
    better: (m) => m.replace(/\bdiscuss\s+about\b/i, 'discuss'),
    explanation: '"Discuss" already means "talk about" — drop "about".',
  },
];

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

function conceptKey(concept: string): string {
  return concept.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function inferIntent(message: string, fallback: string): string {
  const m = message.toLowerCase();
  if (/\bweekend|saturday|sunday\b/.test(m)) return 'talk about your weekend';
  if (/\bwait|block|stuck|depend/.test(m)) return 'explain what is blocking your progress';
  if (/\bfriday|monday|tomorrow|by |eta|deadline|week\b/.test(m)) return 'give a timeline';
  if (/\bworking on|work on|building|implement/.test(m)) return 'say what you are working on';
  if (/\bhelp|take a look|could you|would you\b/.test(m)) return 'ask a coworker for help';
  return fallback.toLowerCase();
}

const ACK: Record<ResponseEvaluation['overall'], string[]> = {
  excellent: ['Nice — that’s really clear.', 'Got it, that makes total sense.'],
  good: ['Okay, got it.', 'Makes sense.'],
  ok: ['Right.', 'Mm-hm, okay.'],
  poor: ['Sorry — could you say a bit more?', 'Hmm, tell me a little more.'],
};
const FOLLOW_UPS = [
  'What’s the next step from your side?',
  'Anything you need from me?',
  'How are you feeling about the timeline?',
  'Is anything slowing you down?',
  'What are you focusing on today?',
];

export class MockAIConversationService implements AIConversationService {
  readonly name = 'mock';

  async evaluateTurn(context: EvaluateContext): Promise<AiTurnResult> {
    await new Promise((r) => setTimeout(r, 300));

    const { lesson, playerMessage, completedObjectiveIds, playerTurnNumber, comfortableConcepts } =
      context;
    const allIds = lesson.learningObjectives.map((o) => o.id);
    const openObjective =
      lesson.learningObjectives.find((o) => !completedObjectiveIds.includes(o.id)) ??
      lesson.learningObjectives[lesson.learningObjectives.length - 1]!;

    const words = wordCount(playerMessage);
    const meaningCommunicated = words >= 3;

    const rule = GAP_RULES.find(
      (r) => r.test.test(playerMessage) && !(r.unless && r.unless.test(playerMessage)),
    );
    const suppressed = rule ? comfortableConcepts.includes(conceptKey(rule.concept)) : false;
    const intent = inferIntent(playerMessage, openObjective.description);

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

    const lower = playerMessage.toLowerCase();
    const patternsUsedNaturally = gap
      ? []
      : [
          ...new Set(
            PATTERNS.filter((p) => {
              if (p.id === rule?.patternId) return false;
              const head = p.pattern.split('+')[0]!.trim().toLowerCase();
              if (head.length < 2) return false;
              const re = new RegExp(
                `\\b${head.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
                'i',
              );
              return re.test(lower);
            }).map((p) => p.id),
          ),
        ];

    const grammar: ResponseEvaluation['grammar'] = rule
      ? rule.gapType === 'grammar'
        ? 'poor'
        : 'ok'
      : 'good';
    const hasContraction = /\b\w+'\w+\b/.test(playerMessage);
    const natural = !rule && (hasContraction || patternsUsedNaturally.length > 0) && words >= 4;

    let overall: ResponseEvaluation['overall'] = 'ok';
    if (!meaningCommunicated) overall = 'poor';
    else if (!rule && natural) overall = 'excellent';
    else if (!rule) overall = 'good';
    else if (rule.priority === 'optional' || rule.priority === 'useful') overall = 'good';

    const evaluation: ResponseEvaluation = {
      overall,
      meaningCorrect: meaningCommunicated,
      grammar,
      naturalness: natural ? 'natural' : 'ok',
    };

    const analysis: TurnLanguageAnalysis = {
      understoodIntent: intent,
      meaningCommunicated,
      grammarOk: grammar !== 'poor',
      natural,
      contextAppropriate: meaningCommunicated,
      gap,
      patternsUsedNaturally,
    };

    const objectiveProgress: Record<string, boolean> = {};
    for (const id of allIds) objectiveProgress[id] = completedObjectiveIds.includes(id);
    if (meaningCommunicated && !objectiveProgress[openObjective.id]) {
      objectiveProgress[openObjective.id] = true;
    }

    const requiredDone = lesson.completionCriteria.requiredObjectives.every(
      (id) => objectiveProgress[id],
    );
    const lessonComplete =
      requiredDone && playerTurnNumber >= lesson.completionCriteria.minimumTurns;

    let xpEarned = { excellent: 15, good: 10, ok: 5, poor: 0 }[overall];
    if (patternsUsedNaturally.length > 0) xpEarned += 10;
    if (lessonComplete) xpEarned += lesson.xp;

    const learning: LearningFeedback = gap
      ? {
          kind: 'correction',
          shouldShow: true,
          betterExpression: gap.betterExpression,
          explanation: gap.explanation,
        }
      : { kind: 'none', shouldShow: false, betterExpression: null, explanation: null };

    const ackPool = ACK[overall];
    const ack = ackPool[playerTurnNumber % ackPool.length] ?? ackPool[0]!;
    const completedCount = allIds.filter((id) => objectiveProgress[id]).length;
    let text: string;
    if (lessonComplete) {
      text = `${ack} That’s everything I needed — thanks!`;
    } else if (completedCount >= lesson.completionCriteria.requiredObjectives.length) {
      text = `${ack} Anything else before we wrap up?`;
    } else {
      text = `${ack} ${FOLLOW_UPS[(playerTurnNumber + completedCount) % FOLLOW_UPS.length]!}`;
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
      analysis,
      learning,
      objectiveProgress,
      lessonComplete,
      xpEarned,
    };
  }
}
