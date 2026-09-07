import { type ReactNode } from 'react';
import type { ConversationTurn } from '../../types';
import { useTypewriter } from '../../hooks/useTypewriter';
import { CharacterName } from './CharacterName';

interface DialogueBoxProps {
  turn: ConversationTurn | undefined;
  speakerName: string;
  speakerRole?: string;
  waiting: boolean;
  hint?: string;
  reducedMotion: boolean;
  children: ReactNode;
}

/**
 * Bottom sheet of the visual novel: name plate, typewriter dialogue, an
 * optional learning hint, then the player input (passed as children).
 * Tapping the text area finishes the typewriter immediately.
 */
export function DialogueBox({
  turn,
  speakerName,
  speakerRole,
  waiting,
  hint,
  reducedMotion,
  children,
}: DialogueBoxProps) {
  const isPlayer = turn?.speaker === 'player';
  const fullText = turn?.text ?? '';

  const { text, done, skip } = useTypewriter(fullText, {
    instant: reducedMotion || isPlayer,
    speed: 16,
  });

  return (
    <section className={`vn-dialogue${isPlayer ? ' vn-dialogue--player' : ''}`}>
      <div
        className="vn-dialogue__body"
        role="button"
        tabIndex={done || waiting ? -1 : 0}
        aria-label={done ? undefined : 'Tap to show full text'}
        onClick={() => !done && skip()}
        onKeyDown={(e) => {
          if (!done && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            skip();
          }
        }}
      >
        <CharacterName
          name={isPlayer ? 'You' : speakerName}
          role={isPlayer ? undefined : speakerRole}
        />

        {waiting ? (
          <p className="vn-dialogue__text">
            <span className="typing" aria-label={`${speakerName} is typing`}>
              <span />
              <span />
              <span />
            </span>
          </p>
        ) : (
          <p
            className={`vn-dialogue__text${isPlayer ? ' vn-dialogue__text--player' : ''}`}
            aria-live="polite"
          >
            {text}
            {!done ? <span className="vn-dialogue__caret" aria-hidden="true" /> : null}
          </p>
        )}

        {hint && !isPlayer && done && !waiting ? (
          <p className="vn-dialogue__hint">
            💬 One way to say it: <b>{hint}</b> — but your own words are fine.
          </p>
        ) : null}
      </div>

      <div className="vn-dialogue__foot">{children}</div>
    </section>
  );
}
