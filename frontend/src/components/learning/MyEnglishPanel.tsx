import { useMemo, useState } from 'react';
import { usePlayer } from '../../state/PlayerContext';
import { CATEGORY_LABELS, type ChunkCategory, type MasteryStage } from '../../types';
import { ChunkCard } from './ChunkCard';

type Filter = 'working' | 'strong' | 'all';

/** Stages that still need production practice. */
const WORKING: MasteryStage[] = ['familiar', 'prompted', 'supported'];

export function MyEnglishPanel() {
  const { profile, allChunks, getMastery } = usePlayer();
  const [filter, setFilter] = useState<Filter>('working');

  /** Only chunks the player has actually met — the library isn't a dictionary. */
  const encountered = useMemo(() => {
    const seen = new Set(profile.chunkMastery.map((m) => m.chunkId));
    return allChunks
      .filter((c) => seen.has(c.id))
      .map((chunk) => ({ chunk, mastery: getMastery(chunk.id) }));
  }, [allChunks, profile.chunkMastery, getMastery]);

  const counts = useMemo(() => {
    const working = encountered.filter((e) =>
      WORKING.includes(e.mastery?.currentStage ?? 'familiar'),
    ).length;
    return {
      working,
      strong: encountered.length - working,
      total: encountered.length,
    };
  }, [encountered]);

  const visible = useMemo(() => {
    if (filter === 'working') {
      return encountered.filter((e) =>
        WORKING.includes(e.mastery?.currentStage ?? 'familiar'),
      );
    }
    if (filter === 'strong') {
      return encountered.filter(
        (e) => !WORKING.includes(e.mastery?.currentStage ?? 'familiar'),
      );
    }
    return encountered;
  }, [encountered, filter]);

  /** Grouped by category so it reads as an expression library, not a list. */
  const grouped = useMemo(() => {
    const map = new Map<ChunkCategory, typeof visible>();
    for (const entry of visible) {
      const list = map.get(entry.chunk.category) ?? [];
      list.push(entry);
      map.set(entry.chunk.category, list);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [visible]);

  if (encountered.length === 0) {
    return (
      <div className="empty-state">
        <p style={{ fontSize: 40, margin: 0 }}>🧩</p>
        <p>
          Nothing here yet. As you talk to coworkers, the expressions you reach
          for — and the ones you don't have yet — collect here as a personal
          library you can actually use.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div
        className="segmented"
        role="group"
        aria-label="Filter"
        style={{ marginBottom: 16 }}
      >
        <button
          type="button"
          aria-pressed={filter === 'working'}
          onClick={() => setFilter('working')}
        >
          Working on ({counts.working})
        </button>
        <button
          type="button"
          aria-pressed={filter === 'strong'}
          onClick={() => setFilter('strong')}
        >
          Strong ({counts.strong})
        </button>
        <button
          type="button"
          aria-pressed={filter === 'all'}
          onClick={() => setFilter('all')}
        >
          All ({counts.total})
        </button>
      </div>

      {grouped.length === 0 ? (
        <p className="faint">Nothing in this view.</p>
      ) : (
        grouped.map(([category, entries]) => (
          <section key={category} className="category-block">
            <div className="category-block__head">
              <h2>{CATEGORY_LABELS[category]}</h2>
              <span className="faint" style={{ fontSize: 13 }}>
                {entries.length}
              </span>
            </div>
            <div className="grid grid--auto">
              {entries.map(({ chunk, mastery }) => (
                <ChunkCard
                  key={chunk.id}
                  chunk={chunk}
                  {...(mastery ? { mastery } : {})}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
