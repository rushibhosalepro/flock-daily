import { onFeather, step } from './step.ts';
import { DIRS } from './types.ts';
import type { CrownResult, Dir, Level, SolveResult, State } from './types.ts';

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

/**
 * Crown par for every cell at once: the fewest moves to get every bird home after
 * some bird has stood on that cell. table[cell] is -1 where it cannot be done.
 *
 * A shortest crown route passes through some board state X with a bird on the
 * feather, so its length is dist(start, X) + dist(X, goal). One forward search from
 * the start and one backward search from the goal give both distances for every X.
 * The level's own feather, if any, is ignored here.
 */
export const crownTable = (level: Level): Int32Array | null => {
  const cells = level.size * level.size;
  const total = cells * cells * cells;
  const startKey = encode(cells, level.starts);
  const goalKey = encode(cells, level.nests);

  // Forward search over every reachable state, remembering each move's result.
  const fwd = new Int32Array(total).fill(-1);
  const succ = new Int32Array(total * 4).fill(-1);
  const order: number[] = [startKey];
  fwd[startKey] = 0;
  for (let i = 0; i < order.length; i++) {
    const key = order[i] ?? 0;
    const state = decode(cells, key);
    for (let d = 0; d < DIRS.length; d++) {
      const dir = DIRS[d];
      if (!dir) continue;
      const result = step(level, state, dir);
      if (!result.changed) continue;
      const nextKey = encode(cells, result.state);
      succ[key * 4 + d] = nextKey;
      if (fwd[nextKey] === -1) {
        fwd[nextKey] = (fwd[key] ?? 0) + 1;
        order.push(nextKey);
      }
    }
  }
  if (fwd[goalKey] === -1) return null;

  // Reverse the recorded moves, then search backward from the goal.
  const preds = new Map<number, number[]>();
  for (const key of order) {
    for (let d = 0; d < 4; d++) {
      const to = succ[key * 4 + d] ?? -1;
      if (to === -1) continue;
      const list = preds.get(to);
      if (list) list.push(key);
      else preds.set(to, [key]);
    }
  }
  const back = new Int32Array(total).fill(-1);
  back[goalKey] = 0;
  const queue: number[] = [goalKey];
  for (let i = 0; i < queue.length; i++) {
    const key = queue[i] ?? 0;
    for (const from of preds.get(key) ?? []) {
      if (back[from] === -1) {
        back[from] = (back[key] ?? 0) + 1;
        queue.push(from);
      }
    }
  }

  const table = new Int32Array(cells).fill(-1);
  for (const key of order) {
    const b = back[key] ?? -1;
    if (b === -1) continue;
    const length = (fwd[key] ?? 0) + b;
    const state = decode(cells, key);
    for (const cell of state) {
      const best = table[cell] ?? -1;
      if (best === -1 || length < best) table[cell] = length;
    }
  }
  return table;
};

/**
 * Breadth-first search for the level's own feather: each state also records
 * whether the feather has been collected. Returns null when there is no feather
 * or no crown route.
 */
export const solveCrown = (level: Level): CrownResult | null => {
  if (level.feather === undefined) return null;
  const cells = level.size * level.size;
  const total = cells * cells * cells * 2;
  const dist = new Int32Array(total).fill(-1);
  const parent = new Int32Array(total).fill(-1);
  const parentDir = new Int8Array(total).fill(-1);

  const startKey =
    encode(cells, level.starts) * 2 + (onFeather(level, level.starts) ? 1 : 0);
  const goalKey = encode(cells, level.nests) * 2 + 1;
  dist[startKey] = 0;

  const queue: number[] = [startKey];
  for (let i = 0; i < queue.length && dist[goalKey] === -1; i++) {
    const key = queue[i] ?? 0;
    const bit = key % 2;
    const state = decode(cells, (key - bit) / 2);
    for (let d = 0; d < DIRS.length; d++) {
      const dir = DIRS[d];
      if (!dir) continue;
      const result = step(level, state, dir);
      if (!result.changed) continue;
      const nextBit = bit === 1 || onFeather(level, result.state) ? 1 : 0;
      const nextKey = encode(cells, result.state) * 2 + nextBit;
      if (dist[nextKey] !== -1) continue;
      dist[nextKey] = (dist[key] ?? 0) + 1;
      parent[nextKey] = key;
      parentDir[nextKey] = d;
      queue.push(nextKey);
    }
  }

  const crownPar = dist[goalKey] ?? -1;
  if (crownPar === -1) return null;
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
  return { crownPar, path };
};
