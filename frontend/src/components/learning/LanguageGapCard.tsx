import { getLesson, getPhrasePattern } from '../../data/curriculum';
import type { LanguageGap, MasteryStatus } from '../../types';

const STATUS_LABEL: Record<MasteryStatus, string> = {
  needs_practice: 'Needs practice',
  developing: 'Developing',
  familiar: 'Familiar',
  mastered: 'Mastered',
};

const STATUS_STEP: Record<MasteryStatus, number> = {
  needs_practice: 1,
  developing: 2,
  familiar: 3,
  mastered: 4,
};

export function LanguageGapCard({ gap }: { gap: LanguageGap }) {
  const pattern = gap.patternId ? getPhrasePattern(gap.patternId) : undefined;
  const step = STATUS_STEP[gap.status];

  return (
    <div className="card gap-card">
      <div className="gap-card__top">
        <span className="gap-card__concept">{gap.concept}</span>
        <span className={`tag gap-status gap-status--${gap.status}`}>
          {STATUS_LABEL[gap.status]}
        </span>
      </div>

      <div className="gap-card__mastery" aria-label={`Mastery: ${STATUS_LABEL[gap.status]}`}>
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={`gap-dot${n <= step ? ' gap-dot--on' : ''}`} />
        ))}
      </div>

      <p className="gap-card__intent">
        <span className="faint">You wanted to: </span>
        {gap.userIntent}
      </p>

      <div className="gap-card__compare">
        <div>
          <span className="faint">You said</span>
          <p className="gap-card__attempt">“{gap.userAttempt}”</p>
        </div>
        <div>
          <span className="faint">More natural</span>
          <p className="gap-card__better">“{gap.betterExpression}”</p>
        </div>
      </div>

      {pattern ? (
        <p className="gap-card__pattern">
          Pattern: <b>{pattern.pattern}</b>
          {pattern.examples[0] ? <span className="faint"> — e.g. “{pattern.examples[0]}”</span> : null}
        </p>
      ) : null}

      <p className="faint gap-card__foot">
        {gap.gapType.replace(/_/g, ' ')} · {gap.priority} · seen {gap.timesObserved}×
        {gap.timesUsedCorrectly > 0 ? `, used well ${gap.timesUsedCorrectly}×` : ''}
        {gap.sourceLessons[0]
          ? ` · from ${getLesson(gap.sourceLessons[0])?.title ?? gap.sourceLessons[0]}`
          : ''}
      </p>
    </div>
  );
}
