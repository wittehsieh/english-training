import curriculumJson from './curriculum/curriculum.json';
import phrasePatternsJson from './curriculum/phrasePatterns.json';
import type { LessonBrief, TargetExpression } from '../types';

/* ==========================================================================
 * Backend curriculum adapter.
 *
 * Produces the trimmed `LessonBrief` the conversation engine needs. It mirrors
 * `frontend/src/data/curriculum.ts` (opening line, character, completion
 * criteria) — a shared package should eventually own this logic.
 * ======================================================================== */

interface RawLesson {
  id: string;
  title: string;
  mission: string;
  learningObjectives: string[];
  targetExpressions: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  xp: number;
}
interface RawChapter {
  id: string;
  title: string;
  lessons: RawLesson[];
}

const curriculum = curriculumJson as unknown as { chapters: RawChapter[] };
const patterns = (phrasePatternsJson as unknown as {
  patterns: { id: string; pattern: string }[];
}).patterns;

const CHARACTERS: Record<string, { name: string; role: string; personality: string[] }> = {
  emily: { name: 'Emily', role: 'Product Manager', personality: ['friendly', 'efficient', 'direct'] },
  daniel: { name: 'Daniel', role: 'Backend Engineer', personality: ['relaxed', 'chatty', 'warm'] },
  priya: { name: 'Priya', role: 'Tech Lead', personality: ['calm', 'precise', 'supportive'] },
  alex: { name: 'Alex', role: 'UX Designer', personality: ['curious', 'collaborative', 'upbeat'] },
  mike: { name: 'Mike', role: 'Engineering Manager', personality: ['measured', 'encouraging', 'big-picture'] },
  nina: { name: 'Nina', role: 'TPM', personality: ['organized', 'pragmatic', 'clear'] },
};

const OPENINGS: Record<string, { characterId: string; text: string; emotion: LessonBrief['conversation']['opening']['emotion'] }> = {
  'office-01': { characterId: 'daniel', text: 'Morning! How was your weekend? Ready for Monday?', emotion: 'happy' },
  'office-02': { characterId: 'daniel', text: 'Hey, you look relaxed. Did you get up to anything fun over the weekend?', emotion: 'happy' },
  'office-03': { characterId: 'priya', text: "Oh hey, grabbing a coffee too? How's your day going so far?", emotion: 'talking' },
  'office-04': { characterId: 'emily', text: 'Hey, quick one — what are you working on today?', emotion: 'talking' },
  'office-05': { characterId: 'emily', text: 'Morning! What does your day look like?', emotion: 'talking' },
  'office-06': { characterId: 'alex', text: "Oh, hey! I haven't seen you in a while. How have you been?", emotion: 'happy' },
  'office-07': { characterId: 'nina', text: 'Hey, do you have a few minutes later today? I wanted to go over something with you.', emotion: 'talking' },
  'office-08': { characterId: 'emily', text: "I know you're heads-down right now — could we sync a bit later?", emotion: 'talking' },
  'office-09': { characterId: 'mike', text: 'Welcome aboard! Do you want to introduce yourself to the team?', emotion: 'happy' },
  'office-10': { characterId: 'daniel', text: "Hi! I'm Daniel, I just joined the backend team this week. You're on this project too, right?", emotion: 'happy' },
  'project-01': { characterId: 'emily', text: "Hey! Good timing. How's the project going?", emotion: 'talking' },
  'project-02': { characterId: 'nina', text: 'Quick status check before standup — where are things at on your side?', emotion: 'talking' },
  'project-03': { characterId: 'priya', text: "Can you walk me through what you've been working on?", emotion: 'thinking' },
  'project-04': { characterId: 'emily', text: "You mentioned you're stuck on something. What's blocking you?", emotion: 'concerned' },
  'project-05': { characterId: 'priya', text: 'You wanted to talk? What do you need a hand with?', emotion: 'talking' },
  'project-06': { characterId: 'emily', text: "When do you think you'll have this ready?", emotion: 'talking' },
  'project-07': { characterId: 'emily', text: 'How are we doing on the timeline — still on track for this week?', emotion: 'concerned' },
  'project-08': { characterId: 'mike', text: 'I hear the date might slip. Talk me through it.', emotion: 'concerned' },
  'project-09': { characterId: 'priya', text: 'You said something came up in production? What happened?', emotion: 'concerned' },
  'project-10': { characterId: 'priya', text: 'Okay, so we know it broke. Do we know why yet?', emotion: 'thinking' },
  'project-11': { characterId: 'emily', text: 'So what do you think we should do about it?', emotion: 'thinking' },
  'project-12': { characterId: 'alex', text: 'Hey — you wanted to follow up on something?', emotion: 'talking' },
};

function humanize(id: string): string {
  return id.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

function toTargetExpression(text: string): TargetExpression {
  const lower = text.toLowerCase();
  const pattern = patterns.find((p) => {
    const head = p.pattern.split('+')[0]!.trim().toLowerCase();
    return head.length > 2 && lower.includes(head);
  });
  return {
    id: lower.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'expr',
    text,
    patternId: pattern?.id,
    note: pattern?.pattern,
  };
}

function toBrief(raw: RawLesson, chapter: RawChapter): LessonBrief {
  const opening = OPENINGS[raw.id] ?? {
    characterId: 'emily',
    text: `Hey, got a second? ${raw.mission.replace(/\.$/, '')}?`,
    emotion: 'talking' as const,
  };
  const character = CHARACTERS[opening.characterId] ?? CHARACTERS.emily!;
  const objectiveIds = raw.learningObjectives;

  return {
    id: raw.id,
    chapterId: chapter.id,
    title: raw.title,
    mission: raw.mission,
    learningObjectives: objectiveIds.map((id) => ({ id, description: humanize(id) })),
    targetExpressions: raw.targetExpressions.map(toTargetExpression),
    conversation: { opening },
    completionCriteria: {
      requiredObjectives: objectiveIds,
      minimumTurns: Math.max(3, Math.min(objectiveIds.length, 5)),
    },
    characters: [
      { id: opening.characterId, name: character.name, role: character.role, personality: character.personality },
    ],
    xp: raw.xp,
  };
}

const BRIEFS: LessonBrief[] = curriculum.chapters.flatMap((chapter) =>
  chapter.lessons.map((raw) => toBrief(raw, chapter)),
);

export function getLessonBrief(lessonId: string): LessonBrief | undefined {
  return BRIEFS.find((lesson) => lesson.id === lessonId);
}

export const ALL_LESSON_IDS = BRIEFS.map((b) => b.id);
