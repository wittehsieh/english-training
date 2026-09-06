import { useNavigate } from 'react-router-dom';
import type { Lesson } from '../../types';

interface LessonCardProps {
  lesson: Lesson;
  completed: boolean;
}

export function LessonCard({ lesson, completed }: LessonCardProps) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      className="card lesson-card"
      onClick={() => navigate(`/lesson/${lesson.id}`)}
    >
      <div className="lesson-card__meta">
        <span className={`tag tag--${lesson.difficulty}`}>{lesson.difficulty}</span>
        <span>· {lesson.estimatedMinutes} min</span>
        {completed ? <span className="lesson-card__done">✓ Completed</span> : null}
      </div>
      <div className="lesson-card__title">{lesson.title}</div>
      <div className="muted" style={{ fontSize: 14 }}>
        {lesson.description}
      </div>
    </button>
  );
}
