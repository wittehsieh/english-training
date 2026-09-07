import { CHAPTERS } from '../../data/curriculum';
import { usePlayer } from '../../state/PlayerContext';
import { LessonCard } from './LessonCard';

export function LessonList() {
  const { isLessonCompleted } = usePlayer();

  return (
    <div>
      {CHAPTERS.map((chapter) => {
        const done = chapter.lessons.filter((l) => isLessonCompleted(l.id)).length;
        return (
          <section key={chapter.id} className="category-block">
            <div className="category-block__head">
              <span aria-hidden="true" style={{ fontSize: 20 }}>
                {chapter.icon}
              </span>
              <h2>{chapter.title}</h2>
              <span className="faint" style={{ fontSize: 13 }}>
                {done}/{chapter.lessons.length}
              </span>
            </div>

            <div className="grid grid--auto">
              {chapter.lessons.map((lesson) => (
                <LessonCard
                  key={lesson.id}
                  lesson={lesson}
                  completed={isLessonCompleted(lesson.id)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
