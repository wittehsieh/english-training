/**
 * Back-compat surface. The game now loads everything from the curriculum
 * package — see `./curriculum.ts`.
 */
export {
  CHAPTERS,
  LESSONS,
  getLesson,
  getChapter,
  getCharacter,
  getPhrasePattern,
  findPattern,
  PHRASE_PATTERNS,
  LEARNING_MODEL,
  CURRICULUM_VERSION,
} from './curriculum';
