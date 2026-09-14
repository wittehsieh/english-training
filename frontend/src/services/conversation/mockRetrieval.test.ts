import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  contentWords,
  evaluateProduction,
  mockSituationFor,
  stem,
} from './mockRetrieval';

test('slot placeholders never become words the player must say', () => {
  assert.deepEqual(contentWords('wait for + THING/PERSON'), ['wait']);
  assert.deepEqual(contentWords('by + DEADLINE (not "until")'), ['by', 'not', 'until']);
  assert.ok(!contentWords("I'm not sure how to + VERB").includes('verb'));
});

test('stemming lets an inflected form match the pattern', () => {
  assert.equal(stem('waiting'), 'wait');
  assert.equal(stem('waited'), 'wait');
  assert.equal(stem('reviews'), 'review');
  assert.equal(stem('miss'), 'miss', 'double-s is not stripped');
  assert.equal(stem('is'), 'is', 'short words are left alone');
});

test('the pattern counts however the player fills the slot', () => {
  const cases = [
    "Sorry, I'm still waiting for the design review.",
    "I'm waiting for Alex to get back to me.",
    'We waited for the client all week.',
  ];
  for (const said of cases) {
    const res = evaluateProduction(said, "I'm waiting for...", 'wait for + THING/PERSON');
    assert.equal(res.usedTargetPattern, true, said);
  }
});

test('getting the meaning across another way is produced but not the pattern', () => {
  const res = evaluateProduction(
    'I have no idea about that one.',
    "I'm waiting for...",
    'wait for + THING/PERSON',
  );
  assert.equal(res.produced, true, 'never marked wrong');
  assert.equal(res.usedTargetPattern, false);
});

test('a different uncertainty phrasing does not count as the target pattern', () => {
  const hit = evaluateProduction(
    "I'm not sure how to explain it.",
    "I'm not sure how to...",
    "I'm not sure how to + VERB",
  );
  assert.equal(hit.usedTargetPattern, true);

  const miss = evaluateProduction(
    'I dont know what to do.',
    "I'm not sure how to...",
    "I'm not sure how to + VERB",
  );
  assert.equal(miss.usedTargetPattern, false);
});

test('a one-word reply communicates nothing', () => {
  const res = evaluateProduction('ok', "I'm waiting for...", 'wait for + THING/PERSON');
  assert.equal(res.produced, false);
});

test('situations are real situations, never "repeat after me"', () => {
  for (const variant of [0, 1]) {
    const s = mockSituationFor('explaining_progress', variant);
    assert.ok(s.length > 20);
    assert.ok(!/repeat|say this|use the phrase/i.test(s), s);
  }
  assert.notEqual(
    mockSituationFor('giving_timeline', 0),
    mockSituationFor('giving_timeline', 1),
    'variants differ so retrievals do not read identically',
  );
});
