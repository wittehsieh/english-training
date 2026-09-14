import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  creditedStage,
  registerAttempt,
  resolveRetrieval,
  retrievalOutcome,
  startRetrieval,
  useHint,
} from './retrievalEngine';
import { buildHint, escalate, isMaxHint } from './hints';
import { getLibraryChunk } from '../../data/chunks';
import type { RetrievalContext } from '../../types/chunk';

const CHUNK = getLibraryChunk('havent-had-much-time-to')!;
const CONTEXT: RetrievalContext = {
  audience: 'manager',
  setting: 'office',
  purpose: 'explain',
  urgency: 'normal',
  formality: 'professional',
};

const session = () =>
  startRetrieval({
    chunk: CHUNK,
    stage: 'supported',
    situation: 'The client asks if you reviewed the proposal.',
    context: CONTEXT,
    lessonId: 'project-01',
    now: new Date('2026-01-01T09:00:00.000Z'),
  });

test('a retrieval starts with no hint shown', () => {
  const s = session();
  assert.equal(s.hintLevel, 'none');
  assert.equal(buildHint(CHUNK, s.hintLevel).text, '');
  assert.equal(s.attempts, 0);
});

test('hints escalate one step at a time and stop at the full answer', () => {
  let s = session();
  const seen: string[] = [];
  for (let i = 0; i < 8; i += 1) {
    s = useHint(s);
    seen.push(s.hintLevel);
  }
  assert.deepEqual(seen.slice(0, 5), [
    'context',
    'semantic',
    'partial',
    'first_word',
    'full_answer',
  ]);
  assert.ok(seen.slice(5).every((l) => l === 'full_answer'), 'clamped at the end');
  assert.equal(isMaxHint(s.hintLevel), true);
});

test('the full answer is the only hint that reveals the phrase', () => {
  const levels = ['context', 'semantic', 'partial', 'first_word'] as const;
  for (const level of levels) {
    const text = buildHint(CHUNK, level).text;
    assert.notEqual(text, CHUNK.phrase, `${level} must not be the whole answer`);
  }
  assert.equal(buildHint(CHUNK, 'full_answer').text, CHUNK.phrase);
});

test('using any hint means it can never count as unaided production', () => {
  const unaided = session();
  assert.equal(creditedStage(unaided), 'supported');

  const helped = useHint(session());
  assert.equal(creditedStage(helped), 'prompted');
});

test('outcome distinguishes "used the pattern" from "got the meaning across"', () => {
  assert.equal(
    retrievalOutcome({ produced: true, usedTargetPattern: true, note: '' }, 'none'),
    'success',
  );
  assert.equal(
    retrievalOutcome({ produced: true, usedTargetPattern: false, note: '' }, 'none'),
    'partial',
    'communicating another way is not evidence for THIS chunk',
  );
  assert.equal(
    retrievalOutcome({ produced: false, usedTargetPattern: false, note: '' }, 'none'),
    'failed',
  );
  assert.equal(
    retrievalOutcome({ produced: true, usedTargetPattern: true, note: '' }, 'full_answer'),
    'partial',
    'producing it right after seeing it is weak evidence',
  );
});

test('resolveRetrieval tags evidence with the situation for variation tracking', () => {
  const evidence = resolveRetrieval(
    session(),
    { produced: true, usedTargetPattern: true, note: '' },
    new Date('2026-01-01T09:01:00.000Z'),
  );

  assert.equal(evidence.outcome, 'success');
  assert.equal(evidence.stage, 'supported');
  assert.equal(evidence.hintLevel, 'none');
  assert.equal(evidence.contextKey, 'manager|office|explain');
  assert.equal(evidence.lessonId, 'project-01');
  assert.equal(evidence.spontaneous, false);
  assert.equal(evidence.delayed, false);
});

test('a hinted success is recorded as prompted, not supported', () => {
  const helped = useHint(useHint(session())); // context -> semantic
  const evidence = resolveRetrieval(helped, {
    produced: true,
    usedTargetPattern: true,
    note: '',
  });
  assert.equal(evidence.stage, 'prompted');
  assert.equal(evidence.hintLevel, 'semantic');
});

test('attempts are counted', () => {
  assert.equal(registerAttempt(registerAttempt(session())).attempts, 2);
});

test('escalate is a pure step function', () => {
  assert.equal(escalate('none'), 'context');
  assert.equal(escalate('full_answer'), 'full_answer');
});
