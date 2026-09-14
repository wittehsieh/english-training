import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextUnmetObjective, pickExampleExpression } from './nextHint';
import { getLesson } from '../data/curriculum';

const lesson = getLesson('office-01')!; // greet_coworker, small_talk, describe_current_work, describe_today_plan

test('with no progress yet, the first objective is next', () => {
  const next = nextUnmetObjective(lesson, undefined);
  assert.equal(next?.id, 'greet_coworker');
});

test('objectives already marked done are skipped, in lesson order', () => {
  const next = nextUnmetObjective(lesson, {
    greet_coworker: { completed: true },
    small_talk: { completed: false },
    describe_current_work: { completed: false },
    describe_today_plan: { completed: false },
  });
  assert.equal(next?.id, 'small_talk');
});

test('once every objective is done, there is nothing left to hint', () => {
  const done = Object.fromEntries(
    lesson.learningObjectives.map((o) => [o.id, { completed: true }]),
  );
  assert.equal(nextUnmetObjective(lesson, done), null);
});

test('the hint follows progress, not turn count', () => {
  // A player could complete objective 1 on turn 5 and objective 2 on turn 6 —
  // the hint must track which objective is open, not how many turns passed.
  const afterFiveTurnsNoProgress = nextUnmetObjective(lesson, {
    greet_coworker: { completed: false },
    small_talk: { completed: false },
    describe_current_work: { completed: false },
    describe_today_plan: { completed: false },
  });
  assert.equal(afterFiveTurnsNoProgress?.id, 'greet_coworker');
});

test('picks a target expression that shares real words with the objective', () => {
  const objective = lesson.learningObjectives.find((o) => o.id === 'describe_today_plan')!;
  const example = pickExampleExpression(lesson, objective);
  assert.ok(example, 'an example was found');
  // office-01's expressions include "I'm planning to..." / "I'm hoping to..." /
  // "I should be able to..." — all plausible for describing today's plan.
  assert.ok(
    /plan|hoping|today|should/i.test(example!.text),
    `expected a plan-related expression, got "${example!.text}"`,
  );
});

test('returns nothing rather than an irrelevant guess', () => {
  const example = pickExampleExpression(lesson, {
    id: 'x',
    description: 'Zzz Qqq Xxx',
  });
  assert.equal(example, null, 'no shared words -> no misleading example');
});

test('with no objective at all, still returns something to say', () => {
  assert.equal(pickExampleExpression(lesson, null), lesson.targetExpressions[0]);
});
