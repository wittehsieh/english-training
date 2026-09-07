import type {
  LanguageGapObservation,
  LearningFeedback as LearningFeedbackData,
} from '../../types';

interface LearningFeedbackProps {
  feedback: LearningFeedbackData;
  /** the gap behind this feedback, when there is one */
  gap?: LanguageGapObservation | null;
  /** player can silence hints in Settings */
  enabled: boolean;
}

/**
 * Deliberately quiet. Shows at most once per turn, only when the evaluator
 * decided it was worth saying (`shouldShow`). Never a grammar lecture.
 *
 *   💡 One thing to improve
 *   You said: "I am waiting the UX feedback."
 *   More natural: "I'm waiting for the UX feedback."
 *   Why: Use "wait for" when you are waiting for something.
 */
export function LearningFeedback({ feedback, gap, enabled }: LearningFeedbackProps) {
  if (!enabled || !feedback.shouldShow || feedback.kind === 'none') return null;

  const better = feedback.betterExpression ?? gap?.betterExpression ?? null;
  const why = feedback.explanation ?? gap?.explanation ?? null;

  return (
    <div className={`learn learn--${feedback.kind}`} role="note">
      <span aria-hidden="true">💡</span>
      <div className="learn__body">
        <span className="learn__lead">One thing to improve</span>
        {gap?.userAttempt ? (
          <span>
            <span className="faint">You said: </span>“{gap.userAttempt}”
          </span>
        ) : null}
        {better ? (
          <span>
            <span className="faint">More natural: </span>
            <span className="learn__better">“{better}”</span>
          </span>
        ) : null}
        {why ? (
          <span className="learn__note">
            <span className="faint">Why: </span>
            {why}
          </span>
        ) : null}
      </div>
    </div>
  );
}
