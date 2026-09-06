import { levelForXp, xpWithinLevel } from '../../types';

interface XPBarProps {
  xp: number;
  compact?: boolean;
}

export function XPBar({ xp, compact = false }: XPBarProps) {
  const level = levelForXp(xp);
  const { current, needed } = xpWithinLevel(xp);
  const pct = Math.round((current / needed) * 100);

  return (
    <div>
      {!compact ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 13,
            marginBottom: 6,
          }}
        >
          <span>Level {level}</span>
          <span className="faint">
            {current} / {needed} XP
          </span>
        </div>
      ) : null}
      <div
        className="xpbar"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={needed}
        aria-label={`Level ${level} progress`}
      >
        <div className="xpbar__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
