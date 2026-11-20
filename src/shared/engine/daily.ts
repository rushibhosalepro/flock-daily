import { generateLevel } from './generator.ts';
import type { GenerateOptions, GeneratedLevel } from './generator.ts';

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
  },
  {
    label: 'Easy',
    minPar: 5,
    maxPar: 7,
    minExtra: 1,
    maxExtra: 3,
    maxOptimalSolutions: 6,
    twist: false,
  },
  {
    label: 'Medium',
    minPar: 6,
    maxPar: 8,
    minExtra: 2,
    maxExtra: 4,
    maxOptimalSolutions: 4,
    twist: false,
  },
  {
    label: 'Medium',
    minPar: 7,
    maxPar: 9,
    minExtra: 3,
    maxExtra: 5,
    maxOptimalSolutions: 3,
    twist: false,
  },
  {
    label: 'Twist',
    minPar: 6,
    maxPar: 9,
    minExtra: 2,
    maxExtra: 5,
    maxOptimalSolutions: 4,
    twist: true,
  },
  {
    label: 'Hard',
    minPar: 9,
    maxPar: 12,
    minExtra: 4,
    maxExtra: 99,
    maxOptimalSolutions: 2,
    twist: false,
  },
  {
    label: 'Twist+',
    minPar: 8,
    maxPar: 11,
    minExtra: 3,
    maxExtra: 99,
    maxOptimalSolutions: 2,
    twist: true,
  },
];

export type DailyPuzzle = GeneratedLevel & {
  day: number;
  label: string;
  twist: boolean;
};

const SALT = 0x51ed27;

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
      return {
        ...found,
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
