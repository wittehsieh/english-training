import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/common/Layout';
import { HomePage } from './pages/HomePage';
import { LessonsPage } from './pages/LessonsPage';
import { ConversationPage } from './pages/ConversationPage';
import { ResultPage } from './pages/ResultPage';
import { PhraseBookPage } from './pages/PhraseBookPage';
import { ProgressPage } from './pages/ProgressPage';
import { SettingsPage } from './pages/SettingsPage';
import { PlayerProvider, usePlayer } from './state/PlayerContext';

/**
 * HashRouter keeps client-side routing working on GitHub Pages without a
 * custom 404 redirect — every route lives under `/english-training/#/...`.
 */
function SettingsEffects() {
  const { profile } = usePlayer();
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.textSize = profile.settings.textSize;
    root.dataset.reducedMotion = String(profile.settings.reducedMotion);
  }, [profile.settings.textSize, profile.settings.reducedMotion]);
  return null;
}

export function App() {
  return (
    <PlayerProvider>
      <SettingsEffects />
      <HashRouter>
        <Routes>
          {/* Full-screen visual-novel screen — no app chrome */}
          <Route path="/lesson/:lessonId" element={<ConversationPage />} />

          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/lessons" element={<LessonsPage />} />
            <Route path="/result/:lessonId" element={<ResultPage />} />
            <Route path="/phrases" element={<PhraseBookPage />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </PlayerProvider>
  );
}
