import { useState, type KeyboardEvent } from 'react';

interface PlayerInputProps {
  disabled: boolean;
  onSend: (message: string) => void;
  /** optional secondary actions */
  onHint?: () => void;
  suggestion?: string | null;
}

/**
 * Free-form English input. Enter submits, Shift+Enter makes a new line.
 * Multiple-choice is intentionally NOT the primary interaction; the hint /
 * suggestion chips are secondary.
 */
export function PlayerInput({
  disabled,
  onSend,
  onHint,
  suggestion,
}: PlayerInputProps) {
  const [value, setValue] = useState('');

  const submit = () => {
    const message = value.trim();
    if (!message || disabled) return;
    onSend(message);
    setValue('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div>
      <div className="player-input">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type your response in English…"
          rows={1}
          disabled={disabled}
          aria-label="Your response"
          autoComplete="off"
        />
        <button
          type="button"
          className="player-input__send"
          onClick={submit}
          disabled={disabled || !value.trim()}
          aria-label="Send response"
        >
          →
        </button>
      </div>

      <div className="player-input__tools">
        {onHint ? (
          <button type="button" className="chip" onClick={onHint} disabled={disabled}>
            💡 Hint
          </button>
        ) : null}
        {suggestion ? (
          <button
            type="button"
            className="chip"
            onClick={() => setValue(suggestion)}
            disabled={disabled}
          >
            ✏️ Use: “{suggestion}”
          </button>
        ) : null}
      </div>
    </div>
  );
}
