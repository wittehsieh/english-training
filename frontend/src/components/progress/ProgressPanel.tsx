import { CHAPTERS, LESSONS } from '../../data/curriculum';
import { usePlayer } from '../../state/PlayerContext';
import { weakestSkills } from '../../engine/mastery/weakness';
import {
  SKILL_LABELS,
  STAGE_ICONS,
  STAGE_LABELS,
  type MasteryStage,
} from '../../types';

const WORKING: MasteryStage[] = ['familiar', 'prompted', 'supported'];

export function ProgressPanel() {
  const { profile } = usePlayer();
  const mastery = profile.chunkMastery;

  const working = mastery.filter((m) => WORKING.includes(m.currentStage));
  const strong = mastery.filter((m) => !WORKING.includes(m.currentStage));
  const automatic = mastery.filter((m) => m.currentStage === 'automatic');
  const independentRetrievals = mastery.reduce(
    (sum, m) => sum + m.independentSuccess,
    0,
  );
  const spontaneous = mastery.reduce((sum, m) => sum + m.spontaneousUsage, 0);

  const skills = weakestSkills(profile.weakness, 6);

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="card">
        <h2 style={{ fontSize: 16 }}>Story</h2>
        <div className="stat-row">
          <span>Episodes completed</span>
          <b>
            {profile.completedLessons.length} / {LESSONS.length}
          </b>
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: 16 }}>Your English</h2>
        <div className="stat-row">
          <span>Expressions you're working on</span>
          <b>{working.length}</b>
        </div>
        <div className="stat-row">
          <span>Expressions you can produce</span>
          <b>{strong.length}</b>
        </div>
        <div className="stat-row">
          <span>{STAGE_ICONS.automatic} Becoming automatic</span>
          <b>{automatic.length}</b>
        </div>
        <div className="stat-row">
          <span>Independent retrievals</span>
          <b>{independentRetrievals}</b>
        </div>
        <div className="stat-row">
          <span>Used unprompted</span>
          <b>{spontaneous}</b>
        </div>
      </div>

      {skills.length > 0 ? (
        <div className="card">
          <h2 style={{ fontSize: 16 }}>Communication skills</h2>
          <p className="faint" style={{ fontSize: 13, marginTop: -4 }}>
            Where your practice is going — not a score.
          </p>
          <div className="grid" style={{ gap: 10 }}>
            {skills.map((s) => {
              const pct = Math.round(s.score * 100);
              return (
                <div key={s.skillId}>
                  <div className="stat-row" style={{ borderBottom: 0, paddingBottom: 4 }}>
                    <span>{SKILL_LABELS[s.skillId]}</span>
                    <span className="faint">
                      {s.successes}/{s.attempts}
                    </span>
                  </div>
                  <div className="meter">
                    <div className="meter__fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

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

/** Exported for tests / future use: human label for a mastery stage. */
export const stageLabel = (stage: MasteryStage): string => STAGE_LABELS[stage];
