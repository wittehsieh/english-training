import { useMemo, useState } from 'react';
import { usePlayer } from '../../state/PlayerContext';
import type { MasteryStatus } from '../../types';
import { LanguageGapCard } from './LanguageGapCard';

type Filter = 'open' | 'all' | 'closed';

const OPEN: MasteryStatus[] = ['needs_practice', 'developing'];

export function MyEnglishPanel() {
  const { profile } = usePlayer();
  const [filter, setFilter] = useState<Filter>('open');

  const gaps = useMemo(() => {
    const sorted = [...profile.languageGaps].sort(
      (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    );
    if (filter === 'open') return sorted.filter((g) => OPEN.includes(g.status));
    if (filter === 'closed') return sorted.filter((g) => !OPEN.includes(g.status));
    return sorted;
  }, [profile.languageGaps, filter]);

  const counts = useMemo(() => {
    const open = profile.languageGaps.filter((g) => OPEN.includes(g.status)).length;
    return { open, total: profile.languageGaps.length, closed: profile.languageGaps.length - open };
  }, [profile.languageGaps]);

  if (profile.languageGaps.length === 0) {
    return (
      <div className="empty-state">
        <p style={{ fontSize: 40, margin: 0 }}>🗒️</p>
        <p>
          Nothing here yet. As you talk to coworkers, the specific things you
          <i> tried</i> to say but couldn’t quite phrase get tracked here — not
          every word you meet, just your personal gaps.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="segmented" role="group" aria-label="Filter" style={{ marginBottom: 16 }}>
        <button type="button" aria-pressed={filter === 'open'} onClick={() => setFilter('open')}>
          Working on ({counts.open})
        </button>
        <button type="button" aria-pressed={filter === 'closed'} onClick={() => setFilter('closed')}>
          Getting there ({counts.closed})
        </button>
        <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
          All ({counts.total})
        </button>
      </div>

      {gaps.length === 0 ? (
        <p className="faint">Nothing in this view.</p>
      ) : (
        <div className="grid grid--auto">
          {gaps.map((gap) => (
            <LanguageGapCard key={gap.id} gap={gap} />
          ))}
        </div>
      )}
    </div>
  );
}
