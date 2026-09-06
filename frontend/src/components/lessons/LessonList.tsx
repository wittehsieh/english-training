import { lessonsByCategory } from '../../data/lessons';
import { usePlayer } from '../../state/PlayerContext';
import { LessonCard } from './LessonCard';

export function LessonList() {
  const { isLessonCompleted } = usePlayer();
  const groups = lessonsByCategory();

  return (
    <div>
      {groups.map(({ category, lessons }) => (
        <section key={category.id} className="category-block">
          <div className="category-block__head">
            <span aria-hidden="true" style={{ fontSize: 20 }}>
              {category.icon}
            </span>
            <h2>{category.name}</h2>
            <span className="faint" style={{ fontSize: 13 }}>
              {lessons.length ? `${lessons.length} lesson${lessons.length > 1 ? 's' : ''}` : 'Coming soon'}
            </span>
          </div>

          {lessons.length ? (
            <div className="grid grid--auto">
              {lessons.map((lesson) => (
                <LessonCard
                  key={lesson.id}
                  lesson={lesson}
                  completed={isLessonCompleted(lesson.id)}
                />
              ))}
            </div>
          ) : (
            <p className="faint" style={{ fontSize: 14 }}>
              New scenarios for this category will be added here.
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
