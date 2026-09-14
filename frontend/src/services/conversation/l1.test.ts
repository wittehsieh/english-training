import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectLanguageUsed } from './mockRetrieval';
import { runMockBrain } from './mockBrain';
import { getLesson } from '../../data/curriculum';

const lesson = getLesson('project-01')!;
const run = (playerMessage: string) =>
  runMockBrain({
    lesson,
    playerMessage,
    completedObjectiveIds: [],
    playerTurnNumber: 1,
    comfortableConcepts: [],
  });

test('detects English, mixed and first-language input', () => {
  assert.equal(detectLanguageUsed("I'm waiting for the UX feedback."), 'english');
  assert.equal(detectLanguageUsed('我還在等 UX 的回饋'), 'mixed');
  assert.equal(detectLanguageUsed('我不知道要怎麼跟他說'), 'l1');
});

test('Chinese input still counts as communicating — never marked wrong', () => {
  const res = run('我不知道要怎麼跟他說這件事');
  assert.equal(res.analysis.languageUsed, 'l1');
  assert.equal(res.analysis.meaningCommunicated, true, 'they did communicate');
  assert.notEqual(res.evaluation.overall, 'poor', 'not punished');
});

test('first-language input is never credited as producing English', () => {
  const res = run('我還在等 UX 的回饋,可能要到禮拜五');
  assert.equal(res.analysis.natural, false);
  assert.deepEqual(res.analysis.patternsUsedNaturally, []);
  assert.notEqual(res.evaluation.overall, 'excellent');
  assert.notEqual(res.evaluation.naturalness, 'natural');
});

test('an equivalent English turn can still score above an L1 turn', () => {
  const english = run("I'm still working on it, and I'm waiting for the UX feedback.");
  const chinese = run('我還在做,而且我在等 UX 的回饋');
  assert.equal(english.analysis.languageUsed, 'english');
  assert.ok(
    ['good', 'excellent'].includes(english.evaluation.overall),
    'English production is rewarded',
  );
  assert.equal(chinese.evaluation.overall, 'ok', 'L1 is capped, not punished');
});

test('the NPC never replies in Chinese', () => {
  const res = run('我不知道要怎麼講');
  assert.ok(!/[一-鿿]/.test(res.characterResponse.text), res.characterResponse.text);
});
