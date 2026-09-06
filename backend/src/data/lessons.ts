import lessonsJson from './lessons.json';
import type { LessonBrief } from '../types';

const lessons = (lessonsJson as { lessons: LessonBrief[] }).lessons;

export function getLessonBrief(lessonId: string): LessonBrief | undefined {
  return lessons.find((lesson) => lesson.id === lessonId);
}
