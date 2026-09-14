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

test('picks the expression curriculum data names for the objective', () => {
  const objective = lesson.learningObjectives.find((o) => o.id === 'describe_today_plan')!;
  const example = pickExampleExpression(lesson, objective);
  // office-01's curriculum.json maps describe_today_plan -> "I'm planning to..."
  // via `objectiveExpressions`, resolved onto `objective.example` by the loader.
  assert.equal(example, objective.example);
  assert.ok(example, 'an example was found');
  assert.equal(example!.text, "I'm planning to...");
});

test('an objective with no curriculum-defined example falls back to the first expression', () => {
  const example = pickExampleExpression(lesson, {
    id: 'x',
    description: 'Some objective the curriculum never mapped',
  });
  assert.equal(example, lesson.targetExpressions[0]);
});

test('with no objective at all, still returns something to say', () => {
  assert.equal(pickExampleExpression(lesson, null), lesson.targetExpressions[0]);
});
