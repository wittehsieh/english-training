import type { LearningFeedback as LearningFeedbackData } from '../../types';

interface LearningFeedbackProps {
  feedback: LearningFeedbackData;
  /** Player can silence hints in Settings. */
  enabled: boolean;
}

/**
 * Deliberately quiet. Shows at most one line of coaching and only when the
 * mock/AI decided it was worth it (`kind !== 'none'`).
 */
export function LearningFeedback({ feedback, enabled }: LearningFeedbackProps) {
  if (!enabled) return null;
  if (feedback.kind === 'none') return null;

  const icon =
    feedback.kind === 'phrase-learned'
      ? '📎'
      : feedback.kind === 'correction'
        ? '💡'
        : 'ℹ️';

  const lead =
    feedback.kind === 'phrase-learned' ? 'Phrase added' : 'More natural';

  return (
    <div className={`learn learn--${feedback.kind}`} role="note">
      <span aria-hidden="true">{icon}</span>
      <span>
        {feedback.betterExpression ? (
          <>
            <span className="faint">{lead}: </span>
            <span className="learn__better">“{feedback.betterExpression}”</span>
          </>
        ) : null}
        {feedback.explanation ? (
          <>
            {feedback.betterExpression ? <br /> : null}
            <span className="learn__note">{feedback.explanation}</span>
          </>
        ) : null}
      </span>
    </div>
  );
}
