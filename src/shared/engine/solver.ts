import { step } from './step.ts';
import { DIRS } from './types.ts';
import type { Dir, Level, SolveResult, State } from './types.ts';

const encode = (cells: number, s: State): number =>
  (s[0] * cells + s[1]) * cells + s[2];

const decode = (cells: number, key: number): State => {
  const c = key % cells;
  const rest = (key - c) / cells;
  const b = rest % cells;
  const a = (rest - b) / cells;
  return [a, b, c];
};

/**
 * The largest walking distance from a bird to its nest, ignoring walls and other birds.
 * Par can never be lower than this. When par equals it, the puzzle needs no trick.
 */
export const walkBound = (level: Level): number => {
  let worst = 0;
  for (let i = 0; i < 3; i++) {
    const a = level.starts[i] ?? 0;
    const b = level.nests[i] ?? 0;
    const d =
      Math.abs(Math.floor(a / level.size) - Math.floor(b / level.size)) +
      Math.abs((a % level.size) - (b % level.size));
    worst = Math.max(worst, d);
  }
  return worst;
};

/**
 * Breadth-first search over bird positions. At most 25^3 = 15,625 states on a 5x5 board.
 * Returns null when the level cannot be solved.
 */
export const solve = (level: Level): SolveResult | null => {
  const cells = level.size * level.size;
  const total = cells * cells * cells;
  const dist = new Int32Array(total).fill(-1);
  const parent = new Int32Array(total).fill(-1);
  const parentDir = new Int8Array(total).fill(-1);
  const ways = new Float64Array(total);

  const startKey = encode(cells, level.starts);
  const goalKey = encode(cells, level.nests);
  dist[startKey] = 0;
  ways[startKey] = 1;

  let frontier: number[] = [startKey];
  let reachable = 1;
  let depth = 0;
  while (frontier.length > 0 && dist[goalKey] === -1) {
    const next: number[] = [];
    for (const key of frontier) {
      const state = decode(cells, key);
      for (let d = 0; d < DIRS.length; d++) {
        const dir = DIRS[d];
        if (!dir) continue;
        const result = step(level, state, dir);
        if (!result.changed) continue;
        const nextKey = encode(cells, result.state);
        if (dist[nextKey] === -1) {
          dist[nextKey] = depth + 1;
          parent[nextKey] = key;
          parentDir[nextKey] = d;
          ways[nextKey] = ways[key] ?? 0;
          next.push(nextKey);
          reachable += 1;
        } else if (dist[nextKey] === depth + 1) {
          ways[nextKey] = (ways[nextKey] ?? 0) + (ways[key] ?? 0);
        }
      }
    }
    frontier = next;
    depth += 1;
  }

  const par = dist[goalKey] ?? -1;
  if (par === -1) return null;

  const path: Dir[] = [];
  let cursor = goalKey;
  while (cursor !== startKey) {
    const dir = DIRS[parentDir[cursor] ?? -1];
    if (!dir) return null;
    path.push(dir);
    cursor = parent[cursor] ?? -1;
    if (cursor === -1) return null;
  }
  path.reverse();

  return {
    par,
    path,
    optimalSolutions: ways[goalKey] ?? 0,
    reachable,
  };
};
