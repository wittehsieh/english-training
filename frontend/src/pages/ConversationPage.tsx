import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { AssetManager } from '../assets/AssetManager';
import { VisualNovelScene } from '../components/visual-novel/Scene';
import { DialogueBox } from '../components/visual-novel/DialogueBox';
import { PlayerInput } from '../components/visual-novel/PlayerInput';
import { LearningFeedback } from '../components/visual-novel/LearningFeedback';
import { getCharacter, getLesson } from '../data/lessons';
import { useConversation, type LessonSummary } from '../engine/useConversation';
import { usePlayer } from '../state/PlayerContext';
import type { CharacterExpression, TurnLanguageAnalysis } from '../types';

export function ConversationPage() {
  const { lessonId = '' } = useParams();
  const lesson = getLesson(lessonId);
  const navigate = useNavigate();
  const { profile, comfortableConcepts, observeTurn, completeLesson } = usePlayer();

  if (!lesson) return <Navigate to="/lessons" replace />;

  return (
    <ConversationScreen
      key={lesson.id}
      lessonId={lesson.id}
      hintsEnabled={profile.settings.showLearningHints}
      reducedMotion={profile.settings.reducedMotion}
      comfortableConcepts={comfortableConcepts}
      onObserveTurn={(analysis) => observeTurn(analysis, lesson.id)}
      onExit={() => navigate('/lessons')}
      onComplete={(summary) => {
        completeLesson({
          lessonId: lesson.id,
          chapterId: lesson.chapterId,
          score: summary.score,
          xpEarned: summary.xpEarned,
        });
        navigate(`/result/${lesson.id}`, { state: summary });
      }}
    />
  );
}

interface ScreenProps {
  lessonId: string;
  hintsEnabled: boolean;
  reducedMotion: boolean;
  comfortableConcepts: string[];
  onObserveTurn: (analysis: TurnLanguageAnalysis) => void;
  onExit: () => void;
  onComplete: (summary: LessonSummary) => void;
}

function ConversationScreen({
  lessonId,
  hintsEnabled,
  reducedMotion,
  comfortableConcepts,
  onObserveTurn,
  onExit,
  onComplete,
}: ScreenProps) {
  const lesson = getLesson(lessonId)!;
  const { phase, error, state, progress, lastResult, summary, send } =
    useConversation(lesson, comfortableConcepts);
  const [showHint, setShowHint] = useState(false);
  const completedRef = useRef(false);
  const observedRef = useRef<string | null>(null);

  // Warm the cache for this lesson's background + character expressions.
  useEffect(() => {
    AssetManager.preload(
      AssetManager.lessonAssetUrls(
        lesson.scene.background,
        lesson.characters.map((c) => c.id),
      ),
    );
  }, [lesson]);

  // Fold each freshly evaluated turn into the Personal Language Gap store.
  useEffect(() => {
    if (lastResult && state) {
      const lastPlayerTurn = [...state.turns]
        .reverse()
        .find((t) => t.speaker === 'player');
      const marker = lastPlayerTurn?.id ?? null;
      if (marker && marker !== observedRef.current) {
        observedRef.current = marker;
        onObserveTurn(lastResult.analysis);
      }
    }
  }, [lastResult, state, onObserveTurn]);

  useEffect(() => {
    if (summary && !completedRef.current) {
      completedRef.current = true;
      onComplete(summary);
    }
  }, [summary, onComplete]);

  const openingCharId = lesson.conversation.opening.characterId;
  const speaker = getCharacter(lesson, openingCharId);
  const sceneChar = lesson.characters.find((c) => c.id === openingCharId);

  const turns = state?.turns ?? [];
  const lastTurn = turns[turns.length - 1];

  const expression: CharacterExpression = useMemo(() => {
    if (phase === 'sending') return 'thinking';
    const lastCharacterTurn = [...turns]
      .reverse()
      .find((t) => t.speaker === 'character');
    return (
      (lastCharacterTurn?.emotion as CharacterExpression | undefined) ??
      sceneChar?.expression ??
      'neutral'
    );
  }, [turns, phase, sceneChar]);

  const playerTurns = progress?.playerTurns ?? 0;
  const hintExpression =
    lesson.targetExpressions[
      Math.min(playerTurns, lesson.targetExpressions.length - 1)
    ];
  const busy = phase === 'sending' || phase === 'loading' || phase === 'complete';

  if (phase === 'error' && !state) {
    return (
      <div className="vn-error">
        <div className="banner banner--error">
          {error ?? 'Could not load this lesson.'}
        </div>
        <button type="button" className="btn" onClick={onExit}>
          ← Back to lessons
        </button>
      </div>
    );
  }

  return (
    <div className="vn">
      <VisualNovelScene
        background={lesson.scene.background}
        backgroundPosition={lesson.scene.backgroundPosition}
        characters={
          speaker
            ? [
                {
                  id: speaker.id,
                  expression,
                  position: sceneChar?.position ?? 'center',
                  speaking: phase !== 'sending' && lastTurn?.speaker === 'character',
                },
              ]
            : []
        }
        overlay={
          <div className="vn-hud">
            <button
              type="button"
              className="btn btn--sm btn--ghost vn-hud__leave"
              onClick={onExit}
            >
              ← Leave
            </button>
            <div className="vn-hud__objectives">
              {lesson.learningObjectives.map((objective) => {
                const done = state?.objectives[objective.id]?.completed;
                return (
                  <span
                    key={objective.id}
                    className={`objective-pip${done ? ' objective-pip--done' : ''}`}
                  >
                    {done ? '✓' : '○'} {objective.description}
                  </span>
                );
              })}
            </div>
          </div>
        }
      />

      <DialogueBox
        turn={lastTurn}
        speakerName={speaker?.name ?? 'Coworker'}
        speakerRole={speaker?.role}
        waiting={phase === 'sending'}
        reducedMotion={reducedMotion}
        hint={
          hintsEnabled && lastTurn?.speaker === 'character'
            ? hintExpression?.text
            : undefined
        }
      >
        {lastResult ? (
          <LearningFeedback
            feedback={lastResult.learning}
            gap={lastResult.analysis.gap}
            enabled={hintsEnabled}
          />
        ) : null}

        {error ? <div className="banner banner--error">{error}</div> : null}

        <PlayerInput
          disabled={busy}
          onSend={(message) => {
            setShowHint(false);
            void send(message);
          }}
          onHint={() => setShowHint((v) => !v)}
          suggestion={showHint ? (hintExpression?.text ?? null) : null}
        />
      </DialogueBox>
    </div>
  );
}
