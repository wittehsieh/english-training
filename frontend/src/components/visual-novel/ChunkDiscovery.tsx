import type { EnglishChunk } from '../../types';

interface ChunkDiscoveryProps {
  chunk: EnglishChunk;
  onContinue: () => void;
}

/**
 * The discovery card (§8/§33). Deliberately tiny: the expression, one line of
 * when to use it, and a button that moves straight into retrieval. It sits in
 * the dialogue box's feedback slot — no modal, no separate screen.
 *
 * The player sees the phrase here and then it disappears; the next thing that
 * happens is the NPC asking something that needs it.
 */
export function ChunkDiscovery({ chunk, onContinue }: ChunkDiscoveryProps) {
  return (
    <div className="discovery" role="note">
      <div className="discovery__head">
        <span aria-hidden="true">💡</span>
        <span>Expression discovered</span>
      </div>

      <p className="discovery__phrase">{chunk.phrase}</p>

      {chunk.pattern ? (
        <p className="discovery__pattern">{chunk.pattern}</p>
      ) : null}

      <p className="discovery__usage">{chunk.usage ?? chunk.meaning}</p>

      <button type="button" className="btn btn--primary btn--sm" onClick={onContinue}>
        Got it
      </button>
    </div>
  );
}
