import { CATEGORIES, LESSONS } from '../../data/lessons';
import { usePlayer } from '../../state/PlayerContext';
import { levelForXp } from '../../types';
import { XPBar } from './XPBar';

export function ProgressPanel() {
  const { profile } = usePlayer();
  const level = levelForXp(profile.xp);

  const lessonCountByCategory = CATEGORIES.map((category) => {
    const total = LESSONS.filter((l) => l.category === category.id).length;
    const done = profile.categoryProgress[category.id] ?? 0;
    return { category, total, done };
  });

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
          <span>Phrases learned</span>
          <b>{profile.learnedPhrases.length}</b>
        </div>
        <div style={{ marginTop: 16 }}>
          <XPBar xp={profile.xp} />
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: 16 }}>Categories</h2>
        <div className="grid" style={{ gap: 10 }}>
          {lessonCountByCategory.map(({ category, total, done }) => (
            <div key={category.id} className="stat-row">
              <span>
                {category.icon} {category.name}
              </span>
              <span className="faint">
                {done} / {total || '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
