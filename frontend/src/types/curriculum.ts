/**
 * Raw curriculum shapes — exactly what ships in
 * `src/data/curriculum/*.json`. These are NOT used directly by the game UI;
 * `src/data/curriculum.ts` adapts them into the runtime `Lesson` type.
 */

export type CurriculumDifficulty = 'easy' | 'medium' | 'hard';

export interface CurriculumLesson {
  id: string;
  title: string;
  /** one-line goal for the player, shown on the lesson card */
  mission: string;
  /** objective ids — human text is derived / looked up */
  learningObjectives: string[];
  /**
   * Language resources the AI may introduce or reference.
   * NEVER an answer key — the player is not required to use these.
   */
  targetExpressions: string[];
  difficulty: CurriculumDifficulty;
  xp: number;
}

export interface Chapter {
  id: string;
  title: string;
  lessons: CurriculumLesson[];
}

export interface Curriculum {
  version: string;
  designPrinciple: string;
  chapters: Chapter[];
}

/* ---- phrasePatterns.json ---- */

export interface PhrasePattern {
  id: string;
  /** e.g. "wait for + thing/person" */
  pattern: string;
  examples: string[];
  category: string;
}

export interface PhrasePatternFile {
  version: string;
  description: string;
  patterns: PhrasePattern[];
}

/* ---- learningModel.json ---- */

export interface LearningModelFile {
  version: string;
  principle: string;
  priorities: string[];
  statuses: string[];
  gapTypes: string[];
  evaluationRules: string[];
  recordSchema: Record<string, string>;
  masteryEvidenceSchema: Record<string, string>;
}

/**
 * A target expression, adapted from a bare curriculum string. Kept as a small
 * object so it can carry a link to a reusable {@link PhrasePattern}.
 */
export interface TargetExpression {
  id: string;
  text: string;
  patternId?: string;
  /** usage guidance for the AI / soft hint — never shown as "the answer" */
  note?: string;
}
