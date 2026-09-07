import type { LessonCharacter } from '../types';

/**
 * The coworker roster. Personalities feed the AI's system prompt; ids resolve
 * to portraits via AssetManager (CSS placeholder until real art exists).
 */
export const CHARACTERS: Record<string, Omit<LessonCharacter, 'expression' | 'position'>> = {
  emily: {
    id: 'emily',
    name: 'Emily',
    role: 'Product Manager',
    personality: ['friendly', 'efficient', 'direct'],
  },
  daniel: {
    id: 'daniel',
    name: 'Daniel',
    role: 'Backend Engineer',
    personality: ['relaxed', 'chatty', 'warm'],
  },
  priya: {
    id: 'priya',
    name: 'Priya',
    role: 'Tech Lead',
    personality: ['calm', 'precise', 'supportive'],
  },
  alex: {
    id: 'alex',
    name: 'Alex',
    role: 'UX Designer',
    personality: ['curious', 'collaborative', 'upbeat'],
  },
  mike: {
    id: 'mike',
    name: 'Mike',
    role: 'Engineering Manager',
    personality: ['measured', 'encouraging', 'big-picture'],
  },
  nina: {
    id: 'nina',
    name: 'Nina',
    role: 'TPM',
    personality: ['organized', 'pragmatic', 'clear'],
  },
};

export const DEFAULT_CHARACTER_ID = 'emily';
