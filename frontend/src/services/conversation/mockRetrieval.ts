import type { ChunkCategory, SkillId } from '../../types/chunk';
import type { RetrievalEvaluation } from '../../types/conversation';
import type { LanguageUsed } from '../../types/learning';
/** CJK detection — the mock can't read Chinese, but it can spot it. */
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff]/;

export function detectLanguageUsed(message: string): LanguageUsed {
  if (!CJK.test(message)) return 'english';
  return /[a-z]{2,}/i.test(message) ? 'mixed' : 'l1';
}


/* ==========================================================================
 * Mock-side helpers for discovery + retrieval.
 *
 * Rule-based stand-in for what the real model does. Mirrored on the backend
 * in MockAIConversationService so offline play behaves the same.
 * ======================================================================== */

/**
 * New situations that would naturally REQUIRE the expression — never
 * "repeat after me" (§13). Two variants each so back-to-back retrievals of
 * the same skill don't read identically.
 */
const SITUATIONS: Record<SkillId, string[]> = {
  explaining_progress: [
    'Oh — before I forget, Emily just asked me where the checkout page is at. What should I tell her?',
    'The client is on a call in ten minutes and will ask about the dashboard. How would you sum it up?',
  ],
  expressing_uncertainty: [
    'Actually, our manager wants you to explain the outage to the client tomorrow. How do you feel about that?',
    'Someone in the standup just asked how we should handle the migration. What would you say?',
  ],
  asking_clarification: [
    'Sarah just sent: "Can you make the onboarding better?" — that\'s all. What do you write back?',
    'The PM says the feature should be "flexible". How would you respond?',
  ],
  making_suggestions: [
    'We\'re short a week and something has to give. What do you propose in the meeting?',
    'The team is stuck choosing between two designs. How would you open?',
  ],
  softening_disagreement: [
    'Your manager wants to ship on Friday without QA. You think that\'s risky — how do you put it?',
    'A teammate suggests rewriting the module from scratch. You disagree. What do you say?',
  ],
  explaining_blockers: [
    'Standup is starting and you still can\'t run the tests. How do you explain it?',
    'The PM asks why the ticket hasn\'t moved since Monday. What do you say?',
  ],
  giving_opinions: [
    'In the retro, someone asks what you honestly thought of the new process. How do you answer?',
    'Your lead asks which approach you\'d pick. What do you say?',
  ],
  giving_timeline: [
    'The client just asked when they can see it. How do you answer?',
    'Your manager needs a date for the roadmap. What do you tell them?',
  ],
  small_talk: [
    'You bump into someone from another team in the lift. They say hi. What do you say?',
    'A new teammate sits down next to you at lunch. How do you open?',
  ],
  handling_misunderstanding: [
    'Turns out the client understood something completely different. How do you handle it?',
    'Your teammate built the wrong thing based on your message. What do you say?',
  ],
  following_up: [
    'You asked design for feedback three days ago and heard nothing. How do you chase it?',
    'The client still hasn\'t confirmed the scope. How do you follow up?',
  ],
  asking_for_help: [
    'You\'ve been stuck on the same bug for two hours. How do you ask your teammate?',
    'You need someone to review your PR before end of day. What do you say?',
  ],
};

export function mockSituationFor(skill: SkillId, variant = 0): string {
  const options = SITUATIONS[skill] ?? SITUATIONS.handling_misunderstanding;
  return options[variant % options.length]!;
}

/** Route a gap concept to a plausible category + skill for a discovered chunk. */
const ROUTES: { test: RegExp; category: ChunkCategory; skill: SkillId }[] = [
  { test: /\b(wait|block|stuck|issue|trouble|problem)/i, category: 'problem', skill: 'explaining_blockers' },
  { test: /\b(not sure|unsure|uncertain)/i, category: 'uncertainty', skill: 'expressing_uncertainty' },
  { test: /\b(clarif|explain|mean|make sure)/i, category: 'clarification', skill: 'asking_clarification' },
  { test: /\b(by |deadline|friday|timeline|eta|done by)/i, category: 'timeline', skill: 'giving_timeline' },
  { test: /\b(option|suggest|what if|maybe we)/i, category: 'suggestion', skill: 'making_suggestions' },
  { test: /\b(concern|disagree|approach)/i, category: 'disagreement', skill: 'softening_disagreement' },
  { test: /\b(done|progress|working on|almost|finish)/i, category: 'progress', skill: 'explaining_progress' },
  { test: /\b(follow up|chance to|look into|get back)/i, category: 'other', skill: 'following_up' },
];

export function routeChunk(text: string): { category: ChunkCategory; skill: SkillId } {
  for (const r of ROUTES) {
    if (r.test.test(text)) return { category: r.category, skill: r.skill };
  }
  return { category: 'other', skill: 'handling_misunderstanding' };
}

/** Content words worth matching on — drops filler so matching is meaningful. */
const STOP = new Set([
  'i', 'im', 'a', 'an', 'the', 'to', 'it', 'is', 'are', 'am', 'be', 'of', 'on',
  'in', 'for', 'and', 'that', 'this', 'with', 'you', 'we', 'my', 'your',
]);

/** Slot placeholders in a pattern — never part of what the player must say. */
const PLACEHOLDER =
  /\b(verb|noun|clause|thing|person|people|time|amount|topic|target|deadline|something|someone)\b/gi;

/** Crude stemmer so "waiting" matches "wait" — enough for pattern matching. */
export function stem(word: string): string {
  if (word.length > 4 && word.endsWith('ing')) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith('ed')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) {
    return word.slice(0, -1);
  }
  return word;
}

export function contentWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/\.\.\.|…/g, ' ')
    .replace(PLACEHOLDER, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(stem);
}

/**
 * Did the player reach for the target pattern? Deliberately lenient about the
 * slot they filled — "I'm not sure how to explain it" must count for
 * "I'm not sure how to + VERB".
 */
export function evaluateProduction(
  message: string,
  targetPhrase: string,
  targetPattern?: string,
): RetrievalEvaluation {
  const said = new Set(contentWords(message));
  const target = contentWords(targetPattern ?? targetPhrase);
  const words = message.trim().split(/\s+/).filter(Boolean).length;

  if (target.length === 0) {
    return { produced: words >= 3, usedTargetPattern: false, note: '' };
  }

  const hits = target.filter((w) => said.has(w)).length;
  const coverage = hits / target.length;
  const usedTargetPattern = coverage >= 0.6;

  return {
    produced: words >= 3,
    usedTargetPattern,
    note: usedTargetPattern
      ? 'Used the expression in a new situation.'
      : 'Got the meaning across another way.',
  };
}
