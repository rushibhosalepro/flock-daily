import { generateLevel, makeRng } from './generator.ts';
import type { GenerateOptions, GeneratedLevel } from './generator.ts';
import { crownTable, solveCrown } from './solver.ts';
import type { CrownResult, Level } from './types.ts';

export const BOARD_SIZE = 5;

/** Bump when puzzle content changes, so cached boards and results from older content are not reused. */
export const PUZZLE_VERSION = 3;

type Plan = {
  label: string;
  minPar: number;
  maxPar: number;
  /** Moves beyond plain walking distance. More extra moves means a deeper trick. */
  minExtra: number;
  maxExtra: number;
  maxOptimalSolutions: number;
  twist: boolean;
  /** Extra moves the Crown should cost over par, so the feather is a real trade-off. */
  crownMin: number;
  crownMax: number;
};

/**
 * The difficulty ramp repeats every 7 puzzles.
 * Twist puzzles make the yellow bird fly the opposite way to the swipe.
 */
const WEEK: readonly Plan[] = [
  {
    label: 'Easy',
    minPar: 4,
    maxPar: 6,
    minExtra: 1,
    maxExtra: 2,
    maxOptimalSolutions: 6,
    twist: false,
    crownMin: 1,
    crownMax: 2,
  },
  {
    label: 'Easy',
    minPar: 5,
    maxPar: 7,
    minExtra: 1,
    maxExtra: 3,
    maxOptimalSolutions: 6,
    twist: false,
    crownMin: 1,
    crownMax: 2,
  },
  {
    label: 'Medium',
    minPar: 6,
    maxPar: 8,
    minExtra: 2,
    maxExtra: 4,
    maxOptimalSolutions: 4,
    twist: false,
    crownMin: 1,
    crownMax: 3,
  },
  {
    label: 'Medium',
    minPar: 7,
    maxPar: 9,
    minExtra: 3,
    maxExtra: 5,
    maxOptimalSolutions: 3,
    twist: false,
    crownMin: 1,
    crownMax: 3,
  },
  {
    label: 'Twist',
    minPar: 6,
    maxPar: 9,
    minExtra: 2,
    maxExtra: 5,
    maxOptimalSolutions: 4,
    twist: true,
    crownMin: 1,
    crownMax: 3,
  },
  {
    label: 'Hard',
    minPar: 9,
    maxPar: 12,
    minExtra: 4,
    maxExtra: 99,
    maxOptimalSolutions: 2,
    twist: false,
    crownMin: 2,
    crownMax: 4,
  },
  {
    label: 'Twist+',
    minPar: 8,
    maxPar: 11,
    minExtra: 3,
    maxExtra: 99,
    maxOptimalSolutions: 2,
    twist: true,
    crownMin: 2,
    crownMax: 4,
  },
];

export type DailyPuzzle = GeneratedLevel & {
  day: number;
  label: string;
  twist: boolean;
  /** The Crown target, or null on a day where no good feather cell exists. */
  crown: CrownResult | null;
};

const SALT = 0x51ed27;
const FEATHER_SALT = 0xfea7;

/**
 * Puts the golden feather on an empty cell where the Crown costs crownMin to
 * crownMax moves more than par, picked by a seeded draw so every player sees the
 * same cell. Returns the level unchanged when no cell fits.
 */
export const placeFeather = (
  level: Level,
  par: number,
  seed: number,
  crownMin: number,
  crownMax: number
): { level: Level; crown: CrownResult | null } => {
  const table = crownTable(level);
  if (!table) return { level, crown: null };
  const blocked = new Set([...level.walls, ...level.starts, ...level.nests]);
  const candidates: number[] = [];
  for (let cell = 0; cell < table.length; cell++) {
    if (blocked.has(cell)) continue;
    const length = table[cell] ?? -1;
    if (length === -1) continue;
    const extra = length - par;
    if (extra >= crownMin && extra <= crownMax) candidates.push(cell);
  }
  if (candidates.length === 0) return { level, crown: null };
  const rng = makeRng(seed ^ FEATHER_SALT);
  const feather = candidates[Math.floor(rng() * candidates.length)];
  if (feather === undefined) return { level, crown: null };
  const withFeather: Level = { ...level, feather };
  return { level: withFeather, crown: solveCrown(withFeather) };
};

/** Puzzle 1 is the first Easy day of the ramp. */
export const planForDay = (day: number): Plan => {
  const n = day - 1;
  const index = ((n % WEEK.length) + WEEK.length) % WEEK.length;
  return WEEK[index] ?? WEEK[0]!;
};

const optionsFor = (plan: Plan): GenerateOptions => ({
  size: BOARD_SIZE,
  minWalls: 4,
  maxWalls: 8,
  minPar: plan.minPar,
  maxPar: plan.maxPar,
  minExtra: plan.minExtra,
  maxExtra: plan.maxExtra,
  maxOptimalSolutions: plan.maxOptimalSolutions,
  kinds: plan.twist
    ? ['normal', 'normal', 'contrary']
    : ['normal', 'normal', 'normal'],
});

/** The puzzle for a given puzzle number. Same number, same board, everywhere. */
export const puzzleForDay = (day: number): DailyPuzzle => {
  const plan = planForDay(day);
  const options = optionsFor(plan);
  for (let round = 0; round < 8; round++) {
    const seed = Math.imul(day, 2654435761) ^ (SALT + round);
    const found = generateLevel(seed >>> 0, options);
    if (found) {
      // The board itself is chosen first, so adding the feather never changes par.
      const placed = placeFeather(
        found.level,
        found.solution.par,
        seed >>> 0,
        plan.crownMin,
        plan.crownMax
      );
      return {
        ...found,
        level: placed.level,
        crown: placed.crown,
        day,
        label: plan.label,
        twist: plan.twist,
      };
    }
  }
  throw new Error(`could not generate puzzle ${day}`);
};

const MS_PER_DAY = 86_400_000;

/** Whole UTC days between two YYYY-MM-DD strings. */
export const daysBetween = (fromDate: string, toDate: string): number => {
  const from = Date.parse(`${fromDate}T00:00:00Z`);
  const to = Date.parse(`${toDate}T00:00:00Z`);
  return Math.round((to - from) / MS_PER_DAY);
};

export const utcDate = (now: Date): string => now.toISOString().slice(0, 10);

/** Puzzle number for a date, where the epoch date is puzzle 1. */
export const dayNumber = (epochDate: string, date: string): number =>
  daysBetween(epochDate, date) + 1;
