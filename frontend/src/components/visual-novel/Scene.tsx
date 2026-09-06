import { useEffect, useState, type ReactNode } from 'react';
import { AssetManager } from '../../assets/AssetManager';
import type { CharacterExpression, CharacterPosition } from '../../types';
import { Character } from './Character';

export interface SceneCharacter {
  id: string;
  expression: CharacterExpression;
  position?: CharacterPosition;
  speaking?: boolean;
  visible?: boolean;
  scale?: number;
}

interface VisualNovelSceneProps {
  /** background asset id */
  background: string;
  backgroundPosition?: string;
  characters: SceneCharacter[];
  /** rendered over the scene (objectives, leave button) */
  overlay?: ReactNode;
}

/**
 * Full-bleed 2D stage: background layer + independent character layer.
 * Background and characters are ALWAYS separate assets — never a flattened image.
 */
export function VisualNovelScene({
  background,
  backgroundPosition,
  characters,
  overlay,
}: VisualNovelSceneProps) {
  const bg = AssetManager.getBackground(background, backgroundPosition);
  const [bgBroken, setBgBroken] = useState(false);

  useEffect(() => {
    setBgBroken(false);
    if (!bg.url) return;
    const img = new Image();
    img.onerror = () => setBgBroken(true);
    img.src = bg.url;
  }, [bg.url]);

  const showImage = bg.url && !bgBroken;

  return (
    <div className="vn-stage">
      <div className="vn-stage__bg" aria-hidden="true">
        {showImage ? (
          <img
            className="vn-stage__bg-img"
            src={bg.url ?? undefined}
            alt=""
            style={{ objectPosition: bg.focalPoint }}
            decoding="async"
          />
        ) : (
          <div
            className="vn-stage__bg-placeholder"
            style={{
              background: `radial-gradient(circle at 50% 20%, ${bg.placeholderColor}, #0e1120 75%)`,
            }}
          />
        )}
      </div>

      <div className="vn-stage__characters">
        {characters
          .filter((c) => c.visible !== false)
          .map((c) => (
            <Character
              key={c.id}
              characterId={c.id}
              expression={c.expression}
              position={c.position ?? 'center'}
              speaking={c.speaking}
              dimmed={characters.some((o) => o.speaking) && !c.speaking}
              scale={c.scale}
            />
          ))}
      </div>

      {overlay ? <div className="vn-stage__overlay">{overlay}</div> : null}
    </div>
  );
}
