import { solve, walkBound } from './solver.ts';
import { validateLevel } from './step.ts';
import type { BirdKind, Level, SolveResult, Triple } from './types.ts';

/** Small deterministic PRNG so every player and the server build the same board for a seed. */
export const makeRng = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type GenerateOptions = {
  size: number;
  minWalls: number;
  maxWalls: number;
  minPar: number;
  maxPar: number;
  /** Fewest moves beyond plain walking distance. 1 or more means the board needs a trick. */
  minExtra?: number;
  maxExtra?: number;
  /** Reject boards with more optimal solutions than this, so Par is a real target. */
  maxOptimalSolutions: number;
  kinds: readonly [BirdKind, BirdKind, BirdKind];
};

export type GeneratedLevel = {
  level: Level;
  solution: SolveResult;
};

const pickDistinct = (
  rng: () => number,
  cells: number,
  count: number,
  taken: Set<number>
): number[] => {
  const out: number[] = [];
  while (out.length < count) {
    const cell = Math.floor(rng() * cells);
    if (taken.has(cell)) continue;
    taken.add(cell);
    out.push(cell);
  }
  return out;
};

/** One random candidate board. It may be unsolvable or off target. */
export const randomLevel = (
  rng: () => number,
  options: GenerateOptions
): Level => {
  const cells = options.size * options.size;
  const wallCount =
    options.minWalls +
    Math.floor(rng() * (options.maxWalls - options.minWalls + 1));
  const taken = new Set<number>();
  const walls = pickDistinct(rng, cells, wallCount, taken);
  const s = pickDistinct(rng, cells, 3, taken);
  const n = pickDistinct(rng, cells, 3, taken);
  const starts: Triple = [s[0] ?? 0, s[1] ?? 0, s[2] ?? 0];
  const nests: Triple = [n[0] ?? 0, n[1] ?? 0, n[2] ?? 0];
  return {
    size: options.size,
    walls: walls.sort((a, b) => a - b),
    starts,
    nests,
    kinds: options.kinds,
  };
};

/**
 * Searches deterministically for a board that matches the options.
 * The same seed always returns the same board.
 */
export const generateLevel = (
  seed: number,
  options: GenerateOptions,
  maxAttempts = 4000
): GeneratedLevel | null => {
  const rng = makeRng(seed);
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const level = randomLevel(rng, options);
    if (validateLevel(level) !== null) continue;
    const solution = solve(level);
    if (!solution) continue;
    if (solution.par < options.minPar || solution.par > options.maxPar) {
      continue;
    }
    if (solution.optimalSolutions > options.maxOptimalSolutions) continue;
    const extra = solution.par - walkBound(level);
    if (extra < (options.minExtra ?? 0)) continue;
    if (extra > (options.maxExtra ?? Infinity)) continue;
    return { level, solution };
  }
  return null;
};
