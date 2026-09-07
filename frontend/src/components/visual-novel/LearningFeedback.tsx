import type { LearningFeedback as LearningFeedbackData } from '../../types';

interface LearningFeedbackProps {
  feedback: LearningFeedbackData;
  /** player can silence hints in Settings */
  enabled: boolean;
}

/**
 * Deliberately quiet. One line, and only when the evaluator decided it was
 * worth saying (`shouldShow`). It should never feel like a teacher interrupting
 * every turn.
 */
export function LearningFeedback({ feedback, enabled }: LearningFeedbackProps) {
  if (!enabled || !feedback.shouldShow || feedback.kind === 'none') return null;

  return (
    <div className={`learn learn--${feedback.kind}`} role="note">
      <span aria-hidden="true">💡</span>
      <span>
        {feedback.betterExpression ? (
          <>
            <span className="faint">More natural: </span>
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
