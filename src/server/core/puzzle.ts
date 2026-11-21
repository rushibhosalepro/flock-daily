import { redis } from '@devvit/web/server';
import {
  PUZZLE_VERSION,
  dayNumber,
  puzzleForDay,
  utcDate,
} from '../../shared/engine/daily.ts';
import type { PuzzleInfo } from '../../shared/api.ts';

const EPOCH_KEY = 'flock:epoch';

/** Day-keyed data is namespaced by puzzle version, so new content never meets old results. */
export const dayKey = (
  kind: 'p' | 'r' | 's' | 'b' | 'k',
  day: number
): string => `flock:v${PUZZLE_VERSION}:${kind}:${day}`;
const memory = new Map<number, PuzzleInfo>();

/** UTC date of puzzle 1. It is set the first time the app asks for it. */
export const getEpoch = async (): Promise<string> => {
  const existing = await redis.get(EPOCH_KEY);
  if (existing) return existing;
  const today = utcDate(new Date());
  await redis.set(EPOCH_KEY, today);
  // If two requests raced, the stored value wins.
  return (await redis.get(EPOCH_KEY)) ?? today;
};

export const getToday = async (): Promise<number> =>
  dayNumber(await getEpoch(), utcDate(new Date()));

const isPuzzleInfo = (value: unknown): value is PuzzleInfo =>
  typeof value === 'object' &&
  value !== null &&
  'level' in value &&
  'par' in value &&
  // Boards cached before the feather existed lack crownPar and are rebuilt.
  'crownPar' in value &&
  'day' in value;

/** Builds, verifies and caches the puzzle for a day. */
export const getPuzzle = async (day: number): Promise<PuzzleInfo> => {
  const cached = memory.get(day);
  if (cached) return cached;

  const stored = await redis.get(dayKey('p', day));
  if (stored) {
    const parsed: unknown = JSON.parse(stored);
    if (isPuzzleInfo(parsed)) {
      memory.set(day, parsed);
      return parsed;
    }
  }

  const built = puzzleForDay(day);
  const info: PuzzleInfo = {
    day,
    label: built.label,
    twist: built.twist,
    level: built.level,
    par: built.solution.par,
    crownPar: built.crown?.crownPar ?? null,
  };
  await redis.set(dayKey('p', day), JSON.stringify(info));
  memory.set(day, info);
  return info;
};
