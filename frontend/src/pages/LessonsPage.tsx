import { LessonList } from '../components/lessons/LessonList';

export function LessonsPage() {
  return (
    <div>
      <div className="page-head">
        <h1>Lessons</h1>
        <p>
          Each lesson drops you into a workplace scene. Reply in your own words —
          your coworker will keep the conversation going.
        </p>
      </div>
      <LessonList />
    </div>
  );
}
