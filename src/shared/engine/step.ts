import type {
  BirdIndex,
  Dir,
  Level,
  State,
  StepResult,
  Triple,
} from './types.ts';

const OPPOSITE: Record<Dir, Dir> = { U: 'D', D: 'U', L: 'R', R: 'L' };

export const BIRDS: readonly BirdIndex[] = [0, 1, 2];

/** Cell a bird at `pos` tries to enter, or -1 if a wall or the board edge stops it. */
const targetCell = (
  size: number,
  wallSet: ReadonlySet<number>,
  pos: number,
  dir: Dir
): number => {
  let r = Math.floor(pos / size);
  let c = pos % size;
  if (dir === 'U') r -= 1;
  else if (dir === 'D') r += 1;
  else if (dir === 'L') c -= 1;
  else c += 1;
  if (r < 0 || r >= size || c < 0 || c >= size) return -1;
  const next = r * size + c;
  return wallSet.has(next) ? -1 : next;
};

const wallSets = new WeakMap<Level, ReadonlySet<number>>();
const getWallSet = (level: Level): ReadonlySet<number> => {
  let set = wallSets.get(level);
  if (!set) {
    set = new Set(level.walls);
    wallSets.set(level, set);
  }
  return set;
};

/**
 * Applies one swipe to the whole flock.
 *
 * Rules:
 * 1. Every bird tries to move one cell. Contrary birds move the opposite way.
 * 2. A wall or the board edge blocks a bird.
 * 3. A bird cannot enter a cell held by a blocked bird.
 * 4. Two birds cannot enter the same cell, so both stay.
 * 5. Two birds cannot swap cells, so both stay.
 * 6. A bird may enter a cell another bird is leaving in the same swipe.
 *
 * Blocking is propagated until nothing changes. The outcome does not depend on bird order.
 */
export const step = (level: Level, state: State, dir: Dir): StepResult => {
  const walls = getWallSet(level);
  const targets: [number, number, number] = [-1, -1, -1];
  const blocked: [boolean, boolean, boolean] = [false, false, false];
  for (const i of BIRDS) {
    const birdDir = level.kinds[i] === 'contrary' ? OPPOSITE[dir] : dir;
    targets[i] = targetCell(level.size, walls, state[i], birdDir);
    blocked[i] = targets[i] === -1;
  }

  // Each pass reads a snapshot of who is blocked, then applies every new block at once.
  // This keeps head-on conflicts symmetric, so the result never depends on bird order.
  let progress = true;
  while (progress) {
    progress = false;
    const snapshot: [boolean, boolean, boolean] = [
      blocked[0],
      blocked[1],
      blocked[2],
    ];
    for (const i of BIRDS) {
      if (snapshot[i]) continue;
      for (const j of BIRDS) {
        if (j === i) continue;
        const intoStationary = snapshot[j] && state[j] === targets[i];
        const sameTarget = !snapshot[j] && targets[j] === targets[i];
        const swap =
          !snapshot[j] && targets[j] === state[i] && targets[i] === state[j];
        if (intoStationary || sameTarget || swap) {
          blocked[i] = true;
          progress = true;
          break;
        }
      }
    }
  }

  const next: Triple = [
    blocked[0] ? state[0] : targets[0],
    blocked[1] ? state[1] : targets[1],
    blocked[2] ? state[2] : targets[2],
  ];
  const changed =
    next[0] !== state[0] || next[1] !== state[1] || next[2] !== state[2];
  return { state: next, changed };
};

export const isSolved = (level: Level, state: State): boolean =>
  state[0] === level.nests[0] &&
  state[1] === level.nests[1] &&
  state[2] === level.nests[2];

/** Checks the structural rules a level must satisfy before it can be played. */
export const validateLevel = (level: Level): string | null => {
  const cells = level.size * level.size;
  const all = [...level.walls, ...level.starts, ...level.nests];
  for (const cell of all) {
    if (!Number.isInteger(cell) || cell < 0 || cell >= cells) {
      return 'cell out of range';
    }
  }
  if (new Set(level.starts).size !== 3) return 'starts must be distinct';
  if (new Set(level.nests).size !== 3) return 'nests must be distinct';
  const wallSet = new Set(level.walls);
  if (wallSet.size !== level.walls.length) return 'duplicate walls';
  for (const cell of [...level.starts, ...level.nests]) {
    if (wallSet.has(cell)) return 'bird or nest on a wall';
  }
  if (isSolved(level, level.starts)) return 'level starts solved';
  return null;
};

/** Replays a move list. Returns null if any move changes nothing. */
export const replay = (
  level: Level,
  moves: readonly Dir[]
): { state: State; solved: boolean } | null => {
  let state: State = level.starts;
  for (const move of moves) {
    const result = step(level, state, move);
    if (!result.changed) return null;
    state = result.state;
  }
  return { state, solved: isSolved(level, state) };
};
