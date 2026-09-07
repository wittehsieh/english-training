import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { getLesson, getPhrasePattern } from '../data/curriculum';
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

  const patterns = [...new Set(summary.patternsUsedNaturally)]
    .map((id) => getPhrasePattern(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
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

      {patterns.length ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 16 }}>Patterns you used naturally</h2>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {patterns.map((p) => (
              <li key={p.id} style={{ marginBottom: 6 }}>
                <b>{p.pattern}</b>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary.identifiedGaps.length ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 16 }}>Added to “My English”</h2>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {summary.identifiedGaps.map((gap) => (
              <li key={gap.concept} style={{ marginBottom: 10 }}>
                <b>{gap.concept}</b>
                <br />
                <span className="faint">you said “{gap.userAttempt}” → </span>
                “{gap.betterExpression}”
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 16 }}>
          No new language gaps this time — you said what you meant.
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
