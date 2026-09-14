import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseStage, chunkFromDiscovery, decideNextAction } from './learningEngine';
import { learningConfig } from '../../config/learningConfig';
import { emptyMastery, type ChunkMastery } from '../../types/mastery';
import type { ChunkDiscovery } from '../../types/conversation';

const NOW = '2026-01-01T09:00:00.000Z';

const discovery = (over: Partial<ChunkDiscovery> = {}): ChunkDiscovery => ({
  phrase: "I haven't had much time to...",
  pattern: "I haven't had much time to + VERB",
  meaning: "You haven't been able to get to it yet.",
  usage: 'When someone asks about something you have not started.',
  category: 'progress',
  skill: 'explaining_progress',
  situationPrompt: 'The client asks whether you reviewed the proposal. What do you say?',
  ...over,
});

const base = {
  playerTurns: 5,
  lastRetrievalTurn: null,
  retrievalsThisLesson: 0,
  masteryFor: () => undefined,
  existingChunk: () => undefined,
};

test('no discovery means the conversation just continues', () => {
  assert.equal(decideNextAction({ ...base, discovery: null }).kind, 'continue');
});

test('a discovery with no situation cannot drive a retrieval', () => {
  const action = decideNextAction({
    ...base,
    discovery: discovery({ situationPrompt: '  ' }),
  });
  assert.equal(action.kind, 'continue');
});

test('a good discovery becomes a retrieval', () => {
  const action = decideNextAction({ ...base, discovery: discovery() });
  assert.equal(action.kind, 'discover');
  if (action.kind !== 'discover') return;
  assert.equal(action.chunk.phrase, "I haven't had much time to...");
  assert.equal(action.stage, 'supported');
});

test('the cooldown keeps an episode from becoming a drill', () => {
  const action = decideNextAction({
    ...base,
    discovery: discovery(),
    playerTurns: 5,
    lastRetrievalTurn: 4, // only 1 turn ago
  });
  assert.equal(action.kind, 'continue');

  const later = decideNextAction({
    ...base,
    discovery: discovery(),
    playerTurns: 5,
    lastRetrievalTurn: 5 - learningConfig.retrievalCooldownTurns,
  });
  assert.equal(later.kind, 'discover');
});

test('the per-lesson cap is respected', () => {
  const action = decideNextAction({
    ...base,
    discovery: discovery(),
    retrievalsThisLesson: learningConfig.maxRetrievalsPerLesson,
  });
  assert.equal(action.kind, 'continue');
});

test('an expression the player already produces is not re-trained', () => {
  const comfortable: ChunkMastery = {
    ...emptyMastery('havent-had-much-time-to', NOW),
    independentSuccess: 2,
    currentStage: 'independent',
  };
  const action = decideNextAction({
    ...base,
    discovery: discovery(),
    masteryFor: () => comfortable,
  });
  assert.equal(action.kind, 'continue');
});

test('a discovery matching the library reuses that chunk instead of duplicating', () => {
  const chunk = chunkFromDiscovery(
    discovery({ phrase: "I'm not sure how to...", pattern: "I'm not sure how to + VERB" }),
  );
  assert.equal(chunk.id, 'not-sure-how-to');
  assert.equal(chunk.source, 'library');
});

test('an unknown expression becomes a personal chunk', () => {
  const chunk = chunkFromDiscovery(
    discovery({ phrase: 'Let me circle back on that.', pattern: 'circle back on + TOPIC' }),
  );
  assert.equal(chunk.source, 'personal');
  assert.ok(chunk.id.startsWith('personal:'));
});

test('the asked stage climbs with mastery', () => {
  assert.equal(chooseStage(undefined), 'supported');
  assert.equal(
    chooseStage({ ...emptyMastery('c', NOW), currentStage: 'familiar' }),
    'supported',
  );
  assert.equal(
    chooseStage({ ...emptyMastery('c', NOW), currentStage: 'supported' }),
    'independent',
  );
});
