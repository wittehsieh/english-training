import { useEffect, useState, type CSSProperties } from 'react';
import { AssetManager } from '../../assets/AssetManager';
import type { CharacterExpression, CharacterPosition } from '../../types';

interface CharacterProps {
  characterId: string;
  expression: CharacterExpression;
  position?: CharacterPosition;
  /** subtle bob while this character is the one speaking */
  speaking?: boolean;
  /** fade back non-active characters in multi-character scenes */
  dimmed?: boolean;
  /** relative size, 1 = default */
  scale?: number;
}

/**
 * One character illustration on the stage.
 *
 * - Loads `assets/characters/<id>/<expression>.webp` via {@link AssetManager}.
 * - Falls back to a CSS silhouette if the id/expression is unregistered OR the
 *   image 404s (artwork not generated yet) — never a broken-image icon.
 * - Positioning + scale are CSS-driven so future art of any size/ratio works.
 */
export function Character({
  characterId,
  expression,
  position = 'center',
  speaking = false,
  dimmed = false,
  scale = 1,
}: CharacterProps) {
  const resolved = AssetManager.getCharacter(characterId, expression);
  const [broken, setBroken] = useState(false);

  // A new expression means a new image — retry loading it.
  useEffect(() => {
    setBroken(false);
  }, [resolved.url]);

  const showImage = resolved.url && !broken;

  return (
    <div
      className={[
        'vn-character',
        `vn-character--${position}`,
        speaking ? 'vn-character--speaking' : '',
        dimmed ? 'vn-character--dimmed' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ '--character-scale': scale } as CSSProperties}
      data-expression={resolved.expression}
    >
      {showImage ? (
        <img
          key={resolved.url ?? undefined}
          className="vn-character__img"
          src={resolved.url ?? undefined}
          alt=""
          decoding="async"
          loading="eager"
          onError={() => setBroken(true)}
        />
      ) : (
        <div
          className="vn-character__placeholder"
          style={{
            background: `linear-gradient(180deg, ${resolved.placeholderColor}, ${resolved.placeholderColor}55)`,
          }}
          aria-hidden="true"
        >
          <span>{resolved.name.charAt(0).toUpperCase()}</span>
        </div>
      )}
    </div>
  );
}
