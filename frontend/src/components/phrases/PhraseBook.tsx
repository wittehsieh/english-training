import { usePlayer } from '../../state/PlayerContext';
import { PhraseCard } from './PhraseCard';

export function PhraseBook() {
  const { profile } = usePlayer();
  const phrases = [...profile.learnedPhrases].reverse();

  if (phrases.length === 0) {
    return (
      <div className="empty-state">
        <p style={{ fontSize: 40, margin: 0 }}>📓</p>
        <p>
          Your phrase book is empty. Finish a conversation and the useful
          expressions you used will land here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid--auto">
      {phrases.map((phrase) => (
        <PhraseCard key={`${phrase.id}-${phrase.learnedAt}`} phrase={phrase} />
      ))}
    </div>
  );
}
