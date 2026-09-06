import { useNavigate } from 'react-router-dom';
import { LESSONS } from '../data/lessons';
import { Button } from '../components/common/Button';
import { XPBar } from '../components/progress/XPBar';
import { usePlayer } from '../state/PlayerContext';

export function HomePage() {
  const navigate = useNavigate();
  const { profile, isLessonCompleted } = usePlayer();

  const nextLesson =
    LESSONS.find((l) => !isLessonCompleted(l.id)) ?? LESSONS[0];
  const started = profile.xp > 0 || profile.completedLessons.length > 0;

  return (
    <div>
      <div className="home-hero">
        <h1>
          Workplace <span style={{ color: 'var(--accent)' }}>English</span>{' '}
          Adventure
        </h1>
        <p>
          Learn English by actually using it — talk your way through real
          workplace moments with your coworkers.
        </p>

        <div className="home-menu">
          {nextLesson ? (
            <Button
              variant="primary"
              block
              onClick={() => navigate(`/lesson/${nextLesson.id}`)}
            >
              {started ? '▶ Continue' : '▶ Start playing'}
            </Button>
          ) : null}
          <Button block onClick={() => navigate('/lessons')}>
            📚 Lessons
          </Button>
          <Button block onClick={() => navigate('/phrases')}>
            📓 Phrase Book
          </Button>
          <Button block onClick={() => navigate('/progress')}>
            📈 Progress
          </Button>
          <Button block onClick={() => navigate('/settings')}>
            ⚙️ Settings
          </Button>
        </div>
      </div>

      {started ? (
        <div className="card" style={{ maxWidth: 420, margin: '0 auto' }}>
          <XPBar xp={profile.xp} />
        </div>
      ) : null}
    </div>
  );
}
