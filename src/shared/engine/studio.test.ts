import { test } from 'node:test';
import assert from 'node:assert/strict';
import { puzzleForDay } from './daily.ts';
import { replay } from './step.ts';
import {
  EMPTY_DRAFT,
  applyTool,
  checkLevel,
  draftLevel,
  itemAt,
  levelFingerprint,
  missingPieces,
  parseStudioLevel,
} from './studio.ts';
import type { Level } from './types.ts';

const level = (over: Partial<Level>): Level => ({
  size: 5,
  walls: [],
  starts: [0, 5, 10],
  nests: [4, 9, 14],
  kinds: ['normal', 'normal', 'normal'],
  ...over,
});

test('placing a bird twice moves it', () => {
  let d = applyTool(EMPTY_DRAFT, { kind: 'bird', bird: 1 }, 3);
  d = applyTool(d, { kind: 'bird', bird: 1 }, 7);
  assert.deepEqual(d.starts, [null, 7, null]);
  assert.equal(itemAt(d, 3), null);
});

test('one item per cell: a new tool replaces what was there', () => {
  let d = applyTool(EMPTY_DRAFT, { kind: 'hedge' }, 6);
  d = applyTool(d, { kind: 'nest', bird: 0 }, 6);
  assert.deepEqual(d.walls, []);
  assert.deepEqual(d.nests, [6, null, null]);
});

test('tapping a cell with what it holds clears it, and erase clears anything', () => {
  let d = applyTool(EMPTY_DRAFT, { kind: 'hedge' }, 2);
  d = applyTool(d, { kind: 'hedge' }, 2);
  assert.deepEqual(d.walls, []);
  d = applyTool(d, { kind: 'feather' }, 9);
  d = applyTool(d, { kind: 'erase' }, 9);
  assert.equal(d.feather, null);
});

test('off-board cells are ignored', () => {
  assert.equal(applyTool(EMPTY_DRAFT, { kind: 'hedge' }, 25), EMPTY_DRAFT);
  assert.equal(applyTool(EMPTY_DRAFT, { kind: 'hedge' }, -1), EMPTY_DRAFT);
});

test('a draft becomes a level only when every bird and nest is placed', () => {
  let d = EMPTY_DRAFT;
  assert.equal(draftLevel(d), null);
  assert.equal(missingPieces(d).length, 6);
  for (const [bird, s, n] of [[0, 0, 4], [1, 5, 9], [2, 10, 14]] as const) {
    d = applyTool(d, { kind: 'bird', bird }, s);
    d = applyTool(d, { kind: 'nest', bird }, n);
  }
  assert.deepEqual(missingPieces(d), []);
  assert.deepEqual(draftLevel(d)?.starts, [0, 5, 10]);
});

test('the Flock #1 board passes with the same par and Crown par as the daily', () => {
  const daily = puzzleForDay(1);
  const check = checkLevel(daily.level);
  assert.deepEqual(check, {
    ok: true,
    par: daily.solution.par,
    crownPar: daily.crown?.crownPar ?? null,
  });
});

test('too easy, unsolvable and already-solved boards are refused', () => {
  const easy = checkLevel(level({ starts: [0, 5, 10], nests: [1, 6, 11] }));
  assert.ok(!easy.ok && easy.reason.startsWith('Too easy'));
  // The red bird is boxed in by hedges, so it can never leave its corner.
  const stuck = checkLevel(level({ starts: [0, 12, 18], nests: [24, 22, 20], walls: [1, 5] }));
  assert.ok(!stuck.ok && stuck.reason.startsWith('No route'));
  const solved = checkLevel(level({ starts: [4, 9, 14] }));
  assert.ok(!solved.ok && solved.reason.startsWith('Every bird starts'));
});

test('a feather on a shortest route is refused, since the Crown would be free', () => {
  const daily = puzzleForDay(1);
  const path = daily.solution.path;
  // Find a cell a bird passes on the par route that is free to hold the feather.
  let cell: number | undefined;
  for (let i = 1; i < path.length && cell === undefined; i++) {
    const state = replay(daily.level, path.slice(0, i))?.state;
    cell = state?.find(
      (c) =>
        !daily.level.walls.includes(c) &&
        !daily.level.starts.includes(c) &&
        !daily.level.nests.includes(c)
    );
  }
  if (cell === undefined) throw new Error('no free cell on the par route');
  const check = checkLevel({ ...daily.level, feather: cell });
  assert.ok(!check.ok && check.reason.includes('free'));
});

test('levels from a client are rebuilt, never trusted', () => {
  assert.equal(parseStudioLevel(null), null);
  assert.equal(parseStudioLevel({ walls: [], starts: [0, 1], nests: [2, 3, 4] }), null);
  assert.equal(parseStudioLevel({ walls: [99], starts: [0, 1, 2], nests: [3, 4, 5] }), null);
  assert.equal(
    parseStudioLevel({ walls: [], starts: [0, 1, 2], nests: [3, 4, 5], kinds: ['fast', 'normal', 'normal'] }),
    null
  );
  const parsed = parseStudioLevel({
    walls: [9, 3],
    starts: [0, 1, 2],
    nests: [20, 21, 22],
    kinds: ['normal', 'normal', 'contrary'],
    size: 9,
  });
  assert.deepEqual(parsed?.kinds, ['normal', 'normal', 'contrary']);
  assert.equal(parsed?.size, 5);
  assert.deepEqual(parsed?.walls, [3, 9]);
  const noKinds = parseStudioLevel({ walls: [], starts: [0, 1, 2], nests: [20, 21, 22] });
  assert.deepEqual(noKinds?.kinds, ['normal', 'normal', 'normal']);
});

test('the twist tool flips a bird and does nothing elsewhere', () => {
  let d = applyTool(EMPTY_DRAFT, { kind: 'bird', bird: 2 }, 7);
  d = applyTool(d, { kind: 'twist' }, 7);
  assert.deepEqual(d.kinds, ['normal', 'normal', 'contrary']);
  assert.equal(d.starts[2], 7, 'the bird stays where it is');
  assert.equal(applyTool(d, { kind: 'twist' }, 12), d, 'an empty cell is left alone');
  d = applyTool(d, { kind: 'twist' }, 7);
  assert.deepEqual(d.kinds, ['normal', 'normal', 'normal']);
});

test('twisted birds play by the twist rule, and twisting all three is refused', () => {
  const daily = puzzleForDay(5);
  assert.ok(daily.twist, 'day 5 is a Twist day');
  const check = checkLevel(daily.level);
  assert.ok(check.ok && check.par === daily.solution.par, 'same par as the daily Twist board');
  const all = checkLevel({ ...daily.level, kinds: ['contrary', 'contrary', 'contrary'] });
  assert.ok(!all.ok && all.reason.includes('Twist one or two'));
});

test('a twist changes the fingerprint', () => {
  assert.notEqual(
    levelFingerprint(level({})),
    levelFingerprint(level({ kinds: ['normal', 'contrary', 'normal'] }))
  );
});

test('the fingerprint ignores hedge order', () => {
  assert.equal(
    levelFingerprint(level({ walls: [3, 1] })),
    levelFingerprint(level({ walls: [1, 3] }))
  );
  assert.notEqual(
    levelFingerprint(level({ walls: [1] })),
    levelFingerprint(level({ walls: [2] }))
  );
});
