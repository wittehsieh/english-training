import { getLesson } from '../../data/lessons';
import type { LearnedPhraseRecord } from '../../types';

interface PhraseCardProps {
  phrase: LearnedPhraseRecord;
}

export function PhraseCard({ phrase }: PhraseCardProps) {
  const sourceLesson = getLesson(phrase.sourceLessonId);

  return (
    <div className="card">
      <div className="phrase-card__phrase">{phrase.phrase}</div>
      <div className="phrase-card__meaning">{phrase.meaning}</div>
      <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
        {phrase.usage}
      </p>
      {phrase.example ? (
        <p className="phrase-card__example">“{phrase.example}”</p>
      ) : null}
      {sourceLesson ? (
        <p className="faint" style={{ fontSize: 12, marginTop: 10 }}>
          From: {sourceLesson.title}
        </p>
      ) : null}
    </div>
  );
}
