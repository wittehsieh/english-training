import { getLesson } from '../../data/curriculum';
import {
  MASTERY_STAGES,
  STAGE_ICONS,
  STAGE_LABELS,
  type ChunkMastery,
  type EnglishChunk,
  type MasteryStage,
} from '../../types';

const NEXT_CHALLENGE: Record<MasteryStage, string> = {
  familiar: 'Produce it with a hint',
  prompted: 'Produce it from the situation alone',
  supported: 'Produce it with no prompt at all',
  independent: 'Use it in a different situation',
  flexible: 'Use it again after a break, unprompted',
  automatic: 'Keep using it',
};

export function ChunkCard({
  chunk,
  mastery,
}: {
  chunk: EnglishChunk;
  mastery?: ChunkMastery;
}) {
  const stage: MasteryStage = mastery?.currentStage ?? 'familiar';
  const step = MASTERY_STAGES.indexOf(stage) + 1;

  const contexts = (mastery?.contextsUsed ?? [])
    .map((key) => {
      const lessonId = key.startsWith('lesson:') ? key.slice(7) : null;
      return lessonId ? (getLesson(lessonId)?.title ?? null) : null;
    })
    .filter((t): t is string => Boolean(t));

  return (
    <div className="card gap-card">
      <div className="gap-card__top">
        <span className="gap-card__concept">{chunk.phrase}</span>
        <span className={`tag gap-status gap-status--${stage}`}>
          {STAGE_ICONS[stage]} {STAGE_LABELS[stage]}
        </span>
      </div>

      <div
        className="gap-card__mastery"
        aria-label={`Mastery: ${STAGE_LABELS[stage]}`}
      >
        {MASTERY_STAGES.map((_, i) => (
          <span key={i} className={`gap-dot${i < step ? ' gap-dot--on' : ''}`} />
        ))}
      </div>

      {chunk.pattern ? (
        <p className="gap-card__pattern">
          Pattern: <b>{chunk.pattern}</b>
        </p>
      ) : null}

      <p className="gap-card__intent">{chunk.meaning}</p>

      {chunk.usage ? (
        <p className="faint" style={{ fontSize: 13, margin: 0 }}>
          {chunk.usage}
        </p>
      ) : null}

      {chunk.examples?.length ? (
        <div className="gap-card__compare">
          <div>
            <span className="faint">For example</span>
            <p className="gap-card__better">“{chunk.examples[0]}”</p>
          </div>
        </div>
      ) : null}

      {chunk.originalAttempt ? (
        <p className="gap-card__attempt" style={{ fontSize: 13 }}>
          <span className="faint">You said: </span>“{chunk.originalAttempt}”
        </p>
      ) : null}

      {contexts.length ? (
        <p className="faint gap-card__foot">
          Used in: {[...new Set(contexts)].join(' · ')}
        </p>
      ) : null}

      <p className="faint gap-card__foot">
        Next: {NEXT_CHALLENGE[stage]}
        {mastery?.spontaneousUsage
          ? ` · used unprompted ${mastery.spontaneousUsage}×`
          : ''}
      </p>
    </div>
  );
}
