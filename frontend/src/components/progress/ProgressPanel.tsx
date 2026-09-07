import { CHAPTERS, LESSONS } from '../../data/curriculum';
import { usePlayer } from '../../state/PlayerContext';
import { levelForXp, type MasteryStatus } from '../../types';
import { XPBar } from './XPBar';

const OPEN: MasteryStatus[] = ['needs_practice', 'developing'];

export function ProgressPanel() {
  const { profile } = usePlayer();
  const level = levelForXp(profile.xp);

  const openGaps = profile.languageGaps.filter((g) => OPEN.includes(g.status));
  const closingGaps = profile.languageGaps.filter((g) => !OPEN.includes(g.status));

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="card">
        <div className="stat-row">
          <span>Total XP</span>
          <b>{profile.xp}</b>
        </div>
        <div className="stat-row">
          <span>Level</span>
          <b>{level}</b>
        </div>
        <div className="stat-row">
          <span>Lessons completed</span>
          <b>
            {profile.completedLessons.length} / {LESSONS.length}
          </b>
        </div>
        <div className="stat-row">
          <span>Language gaps — working on</span>
          <b>{openGaps.length}</b>
        </div>
        <div className="stat-row">
          <span>Language gaps — familiar / mastered</span>
          <b>{closingGaps.length}</b>
        </div>
        <div style={{ marginTop: 16 }}>
          <XPBar xp={profile.xp} />
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: 16 }}>Chapters</h2>
        <div className="grid" style={{ gap: 10 }}>
          {CHAPTERS.map((chapter) => {
            const done = chapter.lessons.filter((l) =>
              profile.completedLessons.some((c) => c.lessonId === l.id),
            ).length;
            return (
              <div key={chapter.id} className="stat-row">
                <span>
                  {chapter.icon} {chapter.title}
                </span>
                <span className="faint">
                  {done} / {chapter.lessons.length}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
