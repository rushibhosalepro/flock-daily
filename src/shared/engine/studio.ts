/**
 * Flock Studio: the rules for a board a player builds and posts.
 * Pure, so the editor in the browser and the server that posts the board run
 * the same check, and a board the editor accepts is one the server accepts.
 */
import { solve, solveCrown } from './solver.ts';
import { validateLevel } from './step.ts';
import type { BirdIndex, Level } from './types.ts';

export const STUDIO_SIZE = 5;
/** Fewer moves than this is not a puzzle. */
export const MIN_PAR = 3;
/** More than this stops being a quick daily-sized puzzle. */
export const MAX_PAR = 30;

/** A board being built. Birds and nests may still be missing. One item per cell. */
export type Draft = {
  walls: readonly number[];
  starts: readonly [number | null, number | null, number | null];
  nests: readonly [number | null, number | null, number | null];
  feather: number | null;
};

export type Tool =
  | { kind: 'hedge' }
  | { kind: 'bird'; bird: BirdIndex }
  | { kind: 'nest'; bird: BirdIndex }
  | { kind: 'feather' }
  | { kind: 'erase' };

export const EMPTY_DRAFT: Draft = {
  walls: [],
  starts: [null, null, null],
  nests: [null, null, null],
  feather: null,
};

const without = (
  slots: Draft['starts'],
  cell: number
): [number | null, number | null, number | null] => [
  slots[0] === cell ? null : slots[0],
  slots[1] === cell ? null : slots[1],
  slots[2] === cell ? null : slots[2],
];

/** Removes whatever is on a cell. */
const clear = (draft: Draft, cell: number): Draft => ({
  walls: draft.walls.filter((w) => w !== cell),
  starts: without(draft.starts, cell),
  nests: without(draft.nests, cell),
  feather: draft.feather === cell ? null : draft.feather,
});

const setSlot = (
  slots: Draft['starts'],
  bird: BirdIndex,
  cell: number
): [number | null, number | null, number | null] => {
  const next: [number | null, number | null, number | null] = [
    slots[0],
    slots[1],
    slots[2],
  ];
  next[bird] = cell;
  return next;
};

/** What a cell holds, for drawing the editor and for toggling. */
export const itemAt = (
  draft: Draft,
  cell: number
): Tool | null => {
  if (draft.walls.includes(cell)) return { kind: 'hedge' };
  if (draft.feather === cell) return { kind: 'feather' };
  for (const bird of [0, 1, 2] as const) {
    if (draft.starts[bird] === cell) return { kind: 'bird', bird };
    if (draft.nests[bird] === cell) return { kind: 'nest', bird };
  }
  return null;
};

const sameTool = (a: Tool | null, b: Tool): boolean =>
  a !== null &&
  a.kind === b.kind &&
  ('bird' in a ? a.bird : -1) === ('bird' in b ? b.bird : -1);

/**
 * Applies a tool to a cell. Each bird, nest and the feather exist once, so
 * placing one moves it. Tapping a cell with the item it already holds clears it.
 */
export const applyTool = (draft: Draft, tool: Tool, cell: number): Draft => {
  if (!Number.isInteger(cell) || cell < 0 || cell >= STUDIO_SIZE * STUDIO_SIZE) {
    return draft;
  }
  const current = itemAt(draft, cell);
  const base = clear(draft, cell);
  if (tool.kind === 'erase' || sameTool(current, tool)) return base;
  switch (tool.kind) {
    case 'hedge':
      return { ...base, walls: [...base.walls, cell].sort((a, b) => a - b) };
    case 'feather':
      return { ...base, feather: cell };
    case 'bird':
      return { ...base, starts: setSlot(base.starts, tool.bird, cell) };
    case 'nest':
      return { ...base, nests: setSlot(base.nests, tool.bird, cell) };
  }
};

const BIRD_WORDS = ['red', 'blue', 'yellow'] as const;

/** The pieces still to place, e.g. "the blue bird and the yellow nest". Empty when none. */
export const missingPieces = (draft: Draft): string[] => {
  const out: string[] = [];
  for (const bird of [0, 1, 2] as const) {
    if (draft.starts[bird] === null) out.push(`the ${BIRD_WORDS[bird]} bird`);
    if (draft.nests[bird] === null) out.push(`the ${BIRD_WORDS[bird]} nest`);
  }
  return out;
};

/** The level a finished draft describes, or null while pieces are missing. Studio birds all fly normally. */
export const draftLevel = (draft: Draft): Level | null => {
  const [s0, s1, s2] = draft.starts;
  const [n0, n1, n2] = draft.nests;
  if (s0 === null || s1 === null || s2 === null) return null;
  if (n0 === null || n1 === null || n2 === null) return null;
  return {
    size: STUDIO_SIZE,
    walls: draft.walls,
    starts: [s0, s1, s2],
    nests: [n0, n1, n2],
    kinds: ['normal', 'normal', 'normal'],
    ...(draft.feather !== null ? { feather: draft.feather } : {}),
  };
};

export type StudioCheck =
  | { ok: true; par: number; crownPar: number | null }
  | { ok: false; reason: string };

/** Whether a built board can be posted, and if so its par and Crown par. */
export const checkLevel = (level: Level): StudioCheck => {
  if (level.size !== STUDIO_SIZE) return { ok: false, reason: 'Boards are 5 by 5.' };
  if (level.kinds.some((kind) => kind !== 'normal')) {
    return { ok: false, reason: 'Studio birds all fly the normal way.' };
  }
  const problem = validateLevel(level);
  if (problem === 'level starts solved') {
    return { ok: false, reason: 'Every bird starts on its nest. Move one.' };
  }
  if (problem !== null) return { ok: false, reason: 'Each cell can hold one thing.' };
  const solution = solve(level);
  if (!solution) {
    return { ok: false, reason: 'No route gets every bird home. Try moving a hedge.' };
  }
  if (solution.par < MIN_PAR) {
    return {
      ok: false,
      reason: `Too easy: solved in ${solution.par}. Make it need at least ${MIN_PAR} moves.`,
    };
  }
  if (solution.par > MAX_PAR) {
    return { ok: false, reason: `Par ${solution.par} is too long. Keep it to ${MAX_PAR} or fewer.` };
  }
  if (level.feather === undefined) return { ok: true, par: solution.par, crownPar: null };
  const crown = solveCrown(level);
  if (!crown) {
    return { ok: false, reason: 'No route collects the feather. Move it or remove it.' };
  }
  if (crown.crownPar <= solution.par) {
    return {
      ok: false,
      reason: 'A shortest route already passes the feather, so the Crown is free. Move it off the way.',
    };
  }
  return { ok: true, par: solution.par, crownPar: crown.crownPar };
};

/** One string per distinct board, so the same board cannot be posted twice. */
export const levelFingerprint = (level: Level): string =>
  [
    [...level.walls].sort((a, b) => a - b).join('.'),
    level.starts.join('.'),
    level.nests.join('.'),
    level.feather ?? '-',
  ].join('|');

const isCell = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 0 &&
  value < STUDIO_SIZE * STUDIO_SIZE;

const isTriple = (value: unknown): value is [number, number, number] =>
  Array.isArray(value) && value.length === 3 && value.every(isCell);

/**
 * Reads a level sent by a client. Anything malformed returns null. Size and
 * bird kinds are fixed here, never taken from the request.
 */
export const parseStudioLevel = (value: unknown): Level | null => {
  if (typeof value !== 'object' || value === null) return null;
  const walls = Reflect.get(value, 'walls');
  const starts = Reflect.get(value, 'starts');
  const nests = Reflect.get(value, 'nests');
  const feather = Reflect.get(value, 'feather');
  if (!Array.isArray(walls) || walls.length > 19 || !walls.every(isCell)) return null;
  if (!isTriple(starts) || !isTriple(nests)) return null;
  if (feather !== undefined && feather !== null && !isCell(feather)) return null;
  return {
    size: STUDIO_SIZE,
    walls: [...walls].sort((a, b) => a - b),
    starts,
    nests,
    kinds: ['normal', 'normal', 'normal'],
    ...(isCell(feather) ? { feather } : {}),
  };
};
