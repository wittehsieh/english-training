import rawData from './lessons.json';
import type { Lesson, LessonCategory, LessonData } from '../types';

const data = rawData as unknown as LessonData;

export const LESSON_DATA: LessonData = data;
export const CATEGORIES: LessonCategory[] = data.categories;
export const LESSONS: Lesson[] = data.lessons;

export function getLesson(lessonId: string): Lesson | undefined {
  return LESSONS.find((lesson) => lesson.id === lessonId);
}

export function getCategory(categoryId: string): LessonCategory | undefined {
  return CATEGORIES.find((category) => category.id === categoryId);
}

export function lessonsByCategory(): { category: LessonCategory; lessons: Lesson[] }[] {
  return CATEGORIES.map((category) => ({
    category,
    lessons: LESSONS.filter((lesson) => lesson.category === category.id),
  }));
}

export function getCharacter(lesson: Lesson, characterId: string) {
  return lesson.characters.find((character) => character.id === characterId);
}
