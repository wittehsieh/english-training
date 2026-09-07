import phrasePatternsJson from '../data/curriculum/phrasePatterns.json';
import type {
  AiTurnResult,
  CharacterEmotion,
  EvaluateContext,
  GapPriority,
  GapType,
  LanguageGapObservation,
  TurnLanguageAnalysis,
} from '../types';
import type { AIConversationService } from './AIConversationService';
import { conceptKey, scoreTurn } from '../lib/turnScoring';

/* ==========================================================================
 * MockAIConversationService
 *
 * Rule-based stand-in for the OpenAI evaluator. It produces a
 * `TurnLanguageAnalysis` from regex rules; `scoreTurn` (shared with the OpenAI
 * service) turns that into the final `AiTurnResult`, so both engines behave
 * identically downstream.
 *
 * Kept for local dev, UI testing, offline work, automated tests, and to avoid
 * API cost. Still selected automatically when `OPENAI_API_KEY` is absent.
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
    priority: 'useful',
    test: /\bwait(ing)?\s+(the|a|my|your|his|her|their|it|feedback|him|them|response|reply|review)\b/i,
    unless: /\bwait(ing)?\s+for\b/i,
    better: (m) => m.replace(/\bwait(ing)?\s+/i, (s) => s.replace(/\s+$/, '') + ' for '),
    explanation: 'Use "wait for" when you are waiting for something or someone.',
  },
  {
    concept: 'by + deadline (not "until")',
    patternId: 'by-deadline',
    gapType: 'word_choice',
    priority: 'useful',
    test: /\b(finish|done|ready|complete)\b[^.]*\buntil\b/i,
    better: (m) => m.replace(/\buntil\b/i, 'by'),
    explanation: 'For a completion deadline use "by Friday", not "until Friday".',
  },
  {
    concept: 'explain + thing + to + person',
    patternId: 'explain-to',
    gapType: 'sentence_pattern',
    priority: 'useful',
    test: /\bexplain\s+(me|us|him|her|them)\b/i,
    better: (m) =>
      m.replace(/\bexplain\s+(me|us|him|her|them)\b/i, (_s, p: string) => `explain this to ${p}`),
    explanation: 'It\'s "explain something to someone" — e.g. "explain this to me".',
  },
  {
    concept: 'be + almost done/finished',
    gapType: 'grammar',
    priority: 'optional',
    test: /\bi\s+almost\s+(finish|finished|done|complete)\b/i,
    better: () => "I'm almost done with it.",
    explanation: 'Use "I\'m almost done/finished with it" for something nearly complete.',
  },
  {
    concept: 'be blocked on/by + thing',
    gapType: 'grammar',
    priority: 'optional',
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

function inferIntent(message: string, fallback: string): string {
  const m = message.toLowerCase();
  if (/\bweekend|saturday|sunday\b/.test(m)) return 'talk about your weekend';
  if (/\bwait|block|stuck|depend/.test(m)) return 'explain what is blocking your progress';
  if (/\bfriday|monday|tomorrow|by |eta|deadline|week\b/.test(m)) return 'give a timeline';
  if (/\bworking on|work on|building|implement/.test(m)) return 'say what you are working on';
  if (/\bhelp|take a look|could you|would you\b/.test(m)) return 'ask a coworker for help';
  return fallback.toLowerCase();
}

function detectPatternsUsed(message: string, excludePatternId?: string): string[] {
  const lower = message.toLowerCase();
  return [
    ...new Set(
      PATTERNS.filter((p) => {
        if (p.id === excludePatternId) return false;
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
}

const ACK: Record<'excellent' | 'good' | 'ok' | 'poor', string[]> = {
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
    await new Promise((r) => setTimeout(r, 250));

    const { lesson, playerMessage, completedObjectiveIds, playerTurnNumber, comfortableConcepts } =
      context;

    const openObjective =
      lesson.learningObjectives.find((o) => !completedObjectiveIds.includes(o.id)) ??
      lesson.learningObjectives[lesson.learningObjectives.length - 1]!;

    const words = wordCount(playerMessage);
    const meaningCommunicated = words >= 3;
    const intent = inferIntent(playerMessage, openObjective.description);

    const rule = GAP_RULES.find(
      (r) => r.test.test(playerMessage) && !(r.unless && r.unless.test(playerMessage)),
    );
    const suppressed =
      rule && comfortableConcepts.includes(conceptKey(rule.concept));

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
        confidence: 0.82,
      };
    }

    const hasContraction = /\b\w+'\w+\b/.test(playerMessage);
    const patternsUsedNaturally = gap
      ? []
      : detectPatternsUsed(playerMessage, rule?.patternId);
    const natural =
      !rule && (hasContraction || patternsUsedNaturally.length > 0) && words >= 4;

    const analysis: TurnLanguageAnalysis = {
      understoodIntent: intent,
      meaningCommunicated,
      grammarOk: !(rule && rule.gapType === 'grammar'),
      natural,
      contextAppropriate: meaningCommunicated,
      gap,
      patternsUsedNaturally,
    };

    const scored = scoreTurn(context, analysis, {
      advanceOpenObjectiveOnMeaning: true,
    });

    const emotion: CharacterEmotion = scored.lessonComplete
      ? 'happy'
      : scored.evaluation.overall === 'excellent'
        ? 'happy'
        : scored.evaluation.overall === 'poor'
          ? 'concerned'
          : 'talking';

    const ackPool = ACK[scored.evaluation.overall];
    const ack = ackPool[playerTurnNumber % ackPool.length] ?? ackPool[0]!;
    let text: string;
    if (scored.lessonComplete) {
      text = `${ack} That’s everything I needed — thanks!`;
    } else if (
      scored.completedObjectiveCount >= lesson.completionCriteria.requiredObjectives.length
    ) {
      text = `${ack} Anything else before we wrap up?`;
    } else {
      const follow =
        FOLLOW_UPS[
          (playerTurnNumber + scored.completedObjectiveCount) % FOLLOW_UPS.length
        ]!;
      text = `${ack} ${follow}`;
    }

    return {
      characterResponse: { text, emotion },
      evaluation: scored.evaluation,
      analysis: { ...analysis, gap: scored.gap },
      learning: scored.learning,
      objectiveProgress: scored.objectiveProgress,
      lessonComplete: scored.lessonComplete,
      xpEarned: scored.xpEarned,
    };
  }
}
