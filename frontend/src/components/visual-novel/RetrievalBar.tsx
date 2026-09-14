import type { Hint } from '../../engine/retrieval/hints';
import { hintButtonLabel } from '../../engine/retrieval/hints';

interface RetrievalBarProps {
  hint: Hint | null;
  onHint: () => void;
  disabled: boolean;
}

/**
 * The only on-screen sign that a retrieval is happening (§14/§33).
 *
 * No "Question 1/5", no score, no countdown — just a nudge that it's the
 * player's turn to say it, and a hint they can reach for. The NPC's situation
 * is already in the dialogue above; this sits with the input.
 */
export function RetrievalBar({ hint, onHint, disabled }: RetrievalBarProps) {
  const revealed = hint && hint.level !== 'none' ? hint : null;

  return (
    <div className="retrieval">
      <div className="retrieval__row">
        <span className="retrieval__cue">🎯 Your turn — in your own words</span>
        {!revealed?.isFinal ? (
          <button
            type="button"
            className="chip"
            onClick={onHint}
            disabled={disabled}
          >
            {hintButtonLabel(hint?.level ?? 'none')}
          </button>
        ) : null}
      </div>

      {revealed ? (
        <p className={`retrieval__hint retrieval__hint--${revealed.level}`}>
          {revealed.isFinal ? 'You could say: ' : ''}
          {revealed.text}
        </p>
      ) : null}
    </div>
  );
}
