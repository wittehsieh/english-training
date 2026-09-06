import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { getLesson } from '../data/lessons';
import type { LessonSummary } from '../engine/useConversation';
import { usePlayer } from '../state/PlayerContext';

export function ResultPage() {
  const { lessonId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = usePlayer();

  const lesson = getLesson(lessonId);
  const summary = location.state as LessonSummary | null;

  if (!lesson) return <Navigate to="/lessons" replace />;
  if (!summary || summary.lessonId !== lesson.id) {
    // Direct visit / refresh — nothing to show.
    return <Navigate to={`/lesson/${lesson.id}`} replace />;
  }

  const learnedPhrases = lesson.targetPhrases.filter((p) =>
    summary.learnedPhraseIds.includes(p.id),
  );
  const grade =
    summary.score >= 85 ? 'Excellent' : summary.score >= 65 ? 'Solid' : 'Keep practising';

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <div className="page-head" style={{ textAlign: 'center' }}>
        <p className="faint" style={{ letterSpacing: '0.1em' }}>
          LESSON COMPLETE
        </p>
        <h1>{lesson.title}</h1>
        <div className="result-score">{summary.score}</div>
        <p className="muted">{grade}</p>
      </div>

      <div className="card">
        <div className="stat-row">
          <span>XP earned</span>
          <b>+{summary.xpEarned}</b>
        </div>
        <div className="stat-row">
          <span>Turns</span>
          <b>{summary.turns}</b>
        </div>
        <div className="stat-row">
          <span>Total XP</span>
          <b>{profile.xp}</b>
        </div>
      </div>

      {learnedPhrases.length ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 16 }}>Phrases you used well</h2>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {learnedPhrases.map((p) => (
              <li key={p.id} style={{ marginBottom: 6 }}>
                <b>{p.phrase}</b>
                <span className="faint"> — {p.meaning}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary.improvements.length ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 16 }}>Suggested improvements</h2>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {summary.improvements.map((tip) => (
              <li key={tip} style={{ marginBottom: 6 }}>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 16 }}>
          No big corrections this time — your English got the job done.
        </p>
      )}

      <div className="grid grid--2" style={{ marginTop: 24 }}>
        <Button onClick={() => navigate(`/lesson/${lesson.id}`)}>↻ Replay</Button>
        <Button variant="primary" onClick={() => navigate('/lessons')}>
          Next lesson →
        </Button>
      </div>
    </div>
  );
}
