import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayNumber, daysBetween, planForDay, puzzleForDay } from './daily.ts';
import { generateLevel, makeRng, randomLevel } from './generator.ts';
import { TUTORIAL } from './tutorial.ts';
import {
  encodeChallenge,
  parseChallenge,
  ratingFor,
  resultText,
  solutionSpoiler,
  untilNextPuzzle,
} from './share.ts';
import { solve, walkBound } from './solver.ts';
import { isSolved, replay, step, validateLevel } from './step.ts';
import type { Level } from './types.ts';

// Cell index = row * 5 + col on a 5x5 board.
const at = (row: number, col: number): number => row * 5 + col;

const base = (over: Partial<Level>): Level => ({
  size: 5,
  walls: [],
  starts: [at(0, 0), at(2, 0), at(4, 0)],
  nests: [at(0, 4), at(2, 4), at(4, 4)],
  kinds: ['normal', 'normal', 'normal'],
  ...over,
});

test('birds slide one cell and stop at the board edge', () => {
  const level = base({});
  const right = step(level, level.starts, 'R');
  assert.deepEqual(right.state, [at(0, 1), at(2, 1), at(4, 1)]);
  const left = step(level, level.starts, 'L');
  assert.equal(left.changed, false);
  assert.deepEqual(left.state, level.starts);
});

test('walls block a bird without stopping the others', () => {
  const level = base({ walls: [at(2, 1)] });
  const right = step(level, level.starts, 'R');
  assert.deepEqual(right.state, [at(0, 1), at(2, 0), at(4, 1)]);
});

test('a bird cannot enter a cell held by a blocked bird', () => {
  const level = base({
    starts: [at(0, 0), at(0, 1), at(4, 4)],
    nests: [at(1, 0), at(1, 1), at(1, 2)],
    walls: [at(0, 2)],
  });
  // Blue is blocked by the wall, so Red behind it cannot move either.
  const right = step(level, level.starts, 'R');
  assert.deepEqual(right.state, [at(0, 0), at(0, 1), at(4, 4)]);
  assert.equal(right.changed, false);
});

test('a bird may follow another bird that moves away in the same swipe', () => {
  const level = base({ starts: [at(0, 0), at(0, 1), at(4, 4)] });
  const right = step(level, level.starts, 'R');
  assert.deepEqual(right.state, [at(0, 1), at(0, 2), at(4, 4)]);
});

test('a chain stops when its front bird is blocked', () => {
  const level = base({ starts: [at(0, 2), at(0, 3), at(0, 4)] });
  const right = step(level, level.starts, 'R');
  assert.equal(right.changed, false);
});

test('contrary bird flies the opposite way', () => {
  const level = base({ kinds: ['normal', 'normal', 'contrary'] });
  const right = step(level, level.starts, 'R');
  // Yellow starts in column 0, so it is stopped by the left edge.
  assert.deepEqual(right.state, [at(0, 1), at(2, 1), at(4, 0)]);
  const left = step(level, level.starts, 'L');
  assert.deepEqual(left.state, [at(0, 0), at(2, 0), at(4, 1)]);
});

test('two birds heading for the same cell both stay', () => {
  const level = base({
    starts: [at(2, 0), at(2, 2), at(4, 4)],
    nests: [at(0, 0), at(0, 1), at(0, 2)],
    kinds: ['normal', 'contrary', 'normal'],
  });
  // Red goes right into column 1. Blue is contrary, so it goes left into column 1.
  const right = step(level, level.starts, 'R');
  assert.deepEqual(right.state, [at(2, 0), at(2, 2), at(4, 4)]);
});

test('two adjacent birds moving toward each other do not swap', () => {
  const level = base({
    starts: [at(2, 1), at(2, 2), at(4, 4)],
    nests: [at(0, 0), at(0, 1), at(0, 2)],
    kinds: ['normal', 'contrary', 'normal'],
  });
  const right = step(level, level.starts, 'R');
  assert.deepEqual(right.state, [at(2, 1), at(2, 2), at(4, 4)]);
});

test('step does not depend on bird order', () => {
  const a = base({ starts: [at(1, 1), at(1, 2), at(1, 3)] });
  const b = base({
    starts: [at(1, 3), at(1, 1), at(1, 2)],
    nests: [a.nests[2], a.nests[0], a.nests[1]],
  });
  const ra = step(a, a.starts, 'R').state;
  const rb = step(b, b.starts, 'R').state;
  assert.deepEqual([...ra].sort(), [...rb].sort());
});

test('step gives the same result for every bird ordering on random boards', () => {
  const rng = makeRng(99);
  const perms = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ] as const;
  const options = {
    size: 5,
    minWalls: 2,
    maxWalls: 6,
    minPar: 0,
    maxPar: 99,
    maxOptimalSolutions: Infinity,
    kinds: ['normal', 'contrary', 'normal'],
  } as const;
  for (let n = 0; n < 400; n++) {
    const level = randomLevel(rng, options);
    // Crowd the birds so collisions are common.
    const crowded: Level = {
      ...level,
      starts: [at(2, 1), at(2, 2), at(2, 3)],
    };
    for (const dir of ['U', 'D', 'L', 'R'] as const) {
      const reference = step(crowded, crowded.starts, dir).state;
      const expected = reference.map(
        (cell, i) => `${crowded.kinds[i]}:${cell}`
      );
      for (const p of perms) {
        const [a, b, c] = p;
        const permuted: Level = {
          ...crowded,
          starts: [crowded.starts[a], crowded.starts[b], crowded.starts[c]],
          nests: [crowded.nests[a], crowded.nests[b], crowded.nests[c]],
          kinds: [crowded.kinds[a], crowded.kinds[b], crowded.kinds[c]],
        };
        const out = step(permuted, permuted.starts, dir).state;
        const got = out.map((cell, i) => `${permuted.kinds[i]}:${cell}`);
        assert.deepEqual([...got].sort(), [...expected].sort());
      }
    }
  }
});

test('validateLevel rejects bad boards', () => {
  assert.equal(validateLevel(base({})), null);
  assert.ok(validateLevel(base({ walls: [at(0, 0)] })));
  assert.ok(validateLevel(base({ starts: [0, 0, 1] })));
  assert.ok(validateLevel(base({ starts: [at(0, 4), at(2, 4), at(4, 4)] })));
  assert.ok(validateLevel(base({ walls: [99] })));
});

test('solver finds a shortest path that replays to a win', () => {
  const level = base({});
  const result = solve(level);
  assert.ok(result);
  assert.equal(result.par, 4);
  assert.equal(result.path.length, result.par);
  const replayed = replay(level, result.path);
  assert.ok(replayed?.solved);
  assert.ok(isSolved(level, replayed.state));
});

test('solver returns null for an unsolvable board', () => {
  // Red is walled into the corner and cannot reach its nest.
  const level = base({
    walls: [at(0, 1), at(1, 0)],
  });
  assert.equal(solve(level), null);
});

test('no shorter solution exists than the reported par', () => {
  const generated = generateLevel(42, {
    size: 5,
    minWalls: 4,
    maxWalls: 8,
    minPar: 5,
    maxPar: 7,
    maxOptimalSolutions: 10,
    kinds: ['normal', 'normal', 'normal'],
  });
  assert.ok(generated);
  const { level, solution } = generated;
  const dirs = ['U', 'D', 'L', 'R'] as const;
  // Brute force every move list shorter than par.
  const search = (state: Level['starts'], depth: number): boolean => {
    if (isSolved(level, state)) return true;
    if (depth === 0) return false;
    for (const d of dirs) {
      const r = step(level, state, d);
      if (r.changed && search(r.state, depth - 1)) return true;
    }
    return false;
  };
  assert.equal(search(level.starts, solution.par - 1), false);
  assert.equal(search(level.starts, solution.par), true);
});

test('daily puzzles are deterministic', () => {
  const a = puzzleForDay(12);
  const b = puzzleForDay(12);
  assert.deepEqual(a.level, b.level);
  assert.equal(a.solution.par, b.solution.par);
});

test('the tutorial is solved by swiping right twice, and the wall stops red on the second swipe', () => {
  assert.equal(validateLevel(TUTORIAL), null);
  const solved = solve(TUTORIAL);
  assert.ok(solved);
  assert.equal(solved.par, 2);
  assert.equal(solved.optimalSolutions, 1);
  assert.deepEqual(solved.path, ['R', 'R']);

  const first = step(TUTORIAL, TUTORIAL.starts, 'R');
  assert.equal(
    first.state[0],
    TUTORIAL.nests[0],
    'red is home after one swipe'
  );
  assert.equal(isSolved(TUTORIAL, first.state), false);
  const second = step(TUTORIAL, first.state, 'R');
  assert.equal(second.state[0], first.state[0], 'the wall holds red');
  assert.notEqual(second.state[1], first.state[1], 'blue keeps flying');
  assert.ok(isSolved(TUTORIAL, second.state));
});

test('puzzle 1 is an easy generated puzzle without the twist', () => {
  const first = puzzleForDay(1);
  assert.equal(first.label, 'Easy');
  assert.equal(first.twist, false);
  assert.ok(first.solution.par <= 6);
});

test('every generated puzzle up to day 120 is valid, needs a trick and fits its plan', () => {
  for (let day = 1; day <= 120; day++) {
    const puzzle = puzzleForDay(day);
    const plan = planForDay(day);
    assert.equal(validateLevel(puzzle.level), null, `day ${day} invalid`);
    assert.ok(puzzle.solution.par >= plan.minPar, `day ${day} too easy`);
    assert.ok(puzzle.solution.par <= plan.maxPar, `day ${day} too hard`);
    const extra = puzzle.solution.par - walkBound(puzzle.level);
    assert.ok(extra >= Math.max(1, plan.minExtra), `day ${day} needs no trick`);
    assert.ok(extra <= plan.maxExtra, `day ${day} trick too deep`);
    assert.ok(
      puzzle.solution.optimalSolutions <= plan.maxOptimalSolutions,
      `day ${day} has too many shortest solutions`
    );
    const replayed = replay(puzzle.level, puzzle.solution.path);
    assert.ok(replayed?.solved, `day ${day} path does not solve`);
    assert.equal(
      puzzle.level.kinds[2],
      plan.twist ? 'contrary' : 'normal',
      `day ${day} twist mismatch`
    );
  }
});

test('puzzles are not all the same', () => {
  const seen = new Set<string>();
  for (let day = 1; day <= 60; day++) {
    seen.add(JSON.stringify(puzzleForDay(day).level));
  }
  assert.equal(seen.size, 60);
});

test('day numbering counts UTC days from the epoch', () => {
  assert.equal(daysBetween('2026-12-01', '2026-12-01'), 0);
  assert.equal(dayNumber('2026-12-01', '2026-12-01'), 1);
  assert.equal(dayNumber('2026-12-01', '2026-12-08'), 8);
  assert.equal(dayNumber('2026-12-28', '2027-01-02'), 6);
});

test('countdown runs to the next UTC midnight', () => {
  assert.equal(untilNextPuzzle(new Date('2026-12-01T17:48:00Z')), '6h 12m');
  assert.equal(untilNextPuzzle(new Date('2026-12-01T23:15:30Z')), '45m');
  assert.equal(untilNextPuzzle(new Date('2026-12-01T00:00:00Z')), '24h 0m');
  assert.equal(untilNextPuzzle(new Date('2026-12-31T23:59:59Z')), '1m');
});

test('challenges round-trip and reject bad share data', () => {
  const c = { day: 3, moves: 6, by: 'Icy-Pomegranate5105' };
  assert.deepEqual(parseChallenge(encodeChallenge(c)), c);
  assert.deepEqual(
    parseChallenge(encodeChallenge({ day: 3, moves: 6, by: null })),
    { day: 3, moves: 6, by: null }
  );
  assert.equal(parseChallenge(undefined), null);
  assert.equal(parseChallenge('not json'), null);
  assert.equal(parseChallenge('{"v":2,"d":3,"m":6,"b":null}'), null);
  assert.equal(parseChallenge('{"v":1,"d":0,"m":6,"b":null}'), null);
  assert.equal(parseChallenge('{"v":1,"d":3,"m":-1,"b":null}'), null);
  assert.equal(parseChallenge('{"v":1,"d":3,"m":6,"b":"<script>"}'), null);
  assert.equal(parseChallenge('{"v":1,"d":3.5,"m":6,"b":null}'), null);
  assert.ok(!encodeChallenge(c).includes('U'), 'no move list inside');
});

test('share text is spoiler free and ratings follow par', () => {
  assert.equal(ratingFor(6, 6), 'Perfect');
  assert.equal(ratingFor(7, 6), 'Excellent');
  assert.equal(ratingFor(8, 6), 'Good');
  assert.equal(ratingFor(12, 6), 'Completed');
  const text = resultText({ day: 12, moves: 6, par: 6, streak: 3 });
  assert.match(text, /Flock #12/);
  assert.match(text, /6 moves/);
  assert.doesNotMatch(text, /[↑↓←→]/);
  assert.equal(solutionSpoiler(['U', 'L']), '>!↑←!<');
});
