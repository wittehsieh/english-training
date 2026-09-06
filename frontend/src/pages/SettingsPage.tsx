import { useState } from 'react';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { isUsingMockConversation } from '../services/conversation';
import { usePlayer } from '../state/PlayerContext';
import type { PlayerSettings } from '../types';

const TEXT_SIZES: PlayerSettings['textSize'][] = ['small', 'medium', 'large'];

export function SettingsPage() {
  const { profile, updateSettings, resetProgress } = usePlayer();
  const { settings } = profile;
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="page-head">
        <h1>Settings</h1>
      </div>

      <div className="card">
        <div className="setting-row">
          <div>
            <div>Learning hints</div>
            <div className="faint" style={{ fontSize: 13 }}>
              Show gentle coaching during conversations
            </div>
          </div>
          <button
            type="button"
            className="btn btn--sm"
            aria-pressed={settings.showLearningHints}
            onClick={() =>
              updateSettings({ showLearningHints: !settings.showLearningHints })
            }
          >
            {settings.showLearningHints ? 'On' : 'Off'}
          </button>
        </div>

        <div className="setting-row">
          <div>Dialogue text size</div>
          <div className="segmented" role="group" aria-label="Dialogue text size">
            {TEXT_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                aria-pressed={settings.textSize === size}
                onClick={() => updateSettings({ textSize: size })}
              >
                {size[0]?.toUpperCase()}
                {size.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="setting-row">
          <div>
            <div>Reduce motion</div>
            <div className="faint" style={{ fontSize: 13 }}>
              Minimise animations and transitions
            </div>
          </div>
          <button
            type="button"
            className="btn btn--sm"
            aria-pressed={settings.reducedMotion}
            onClick={() =>
              updateSettings({ reducedMotion: !settings.reducedMotion })
            }
          >
            {settings.reducedMotion ? 'On' : 'Off'}
          </button>
        </div>

        <div className="setting-row" style={{ borderBottom: 0 }}>
          <div>
            <div>Conversation engine</div>
            <div className="faint" style={{ fontSize: 13 }}>
              {isUsingMockConversation
                ? 'Mock (offline) — set VITE_API_BASE_URL to use the backend'
                : 'Connected to backend API'}
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <Button variant="ghost" onClick={() => setConfirmReset(true)}>
          🗑️ Reset all progress
        </Button>
      </div>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset all progress?"
      >
        <p className="muted">
          This clears your XP, completed lessons, and phrase book. It can't be
          undone.
        </p>
        <div className="grid grid--2" style={{ marginTop: 16 }}>
          <Button onClick={() => setConfirmReset(false)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              resetProgress();
              setConfirmReset(false);
            }}
          >
            Reset
          </Button>
        </div>
      </Modal>
    </div>
  );
}
