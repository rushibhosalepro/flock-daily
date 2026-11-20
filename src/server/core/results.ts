import { redis } from '@devvit/web/server';
import { ratingFor } from '../../shared/engine/share.ts';
import { dayKey } from './puzzle.ts';
import type { Dir } from '../../shared/engine/types.ts';
import type {
  DayStats,
  PuzzleInfo,
  ResultInfo,
  StreakInfo,
} from '../../shared/api.ts';

const DIR_SET: ReadonlySet<string> = new Set(['U', 'D', 'L', 'R']);

export const isDir = (value: unknown): value is Dir =>
  typeof value === 'string' && DIR_SET.has(value);

export const parseMoves = (text: string): Dir[] => {
  const out: Dir[] = [];
  for (const ch of text) {
    if (isDir(ch)) out.push(ch);
  }
  return out;
};

export const toResult = (puzzle: PuzzleInfo, moves: Dir[]): ResultInfo => ({
  moves: moves.length,
  par: puzzle.par,
  rating: ratingFor(moves.length, puzzle.par),
  moveList: moves,
});

export const getStoredResult = async (
  puzzle: PuzzleInfo,
  userId: string
): Promise<ResultInfo | null> => {
  const text = await redis.hGet(dayKey('r', puzzle.day), userId);
  if (!text) return null;
  const moves = parseMoves(text);
  return moves.length > 0 ? toResult(puzzle, moves) : null;
};

/**
 * The player's fewest-move solve. Falls back to the first solve for players
 * who solved before best scores were kept.
 */
export const getBestResult = async (
  puzzle: PuzzleInfo,
  userId: string
): Promise<ResultInfo | null> => {
  const text = await redis.hGet(dayKey('b', puzzle.day), userId);
  const moves = text ? parseMoves(text) : [];
  if (moves.length > 0) return toResult(puzzle, moves);
  return getStoredResult(puzzle, userId);
};

/** Keeps the new solve if it uses fewer moves than the stored best. Returns the best after saving. */
export const saveBestResult = async (
  puzzle: PuzzleInfo,
  userId: string,
  moves: Dir[]
): Promise<ResultInfo> => {
  const current = await getBestResult(puzzle, userId);
  if (current && current.moves <= moves.length) return current;
  await redis.hSet(dayKey('b', puzzle.day), { [userId]: moves.join('') });
  return toResult(puzzle, moves);
};

/** Stores the first solve for a user. Returns true only for the first one. */
export const recordResult = async (
  puzzle: PuzzleInfo,
  userId: string,
  moves: Dir[]
): Promise<boolean> => {
  const created = await redis.hSetNX(
    dayKey('r', puzzle.day),
    userId,
    moves.join('')
  );
  if (!created) return false;
  const statsKey = dayKey('s', puzzle.day);
  await redis.hIncrBy(statsKey, 'solved', 1);
  if (moves.length === puzzle.par) {
    await redis.hIncrBy(statsKey, 'atPar', 1);
  }
  return true;
};

export const getStats = async (day: number): Promise<DayStats> => {
  const raw = await redis.hGetAll(dayKey('s', day));
  return {
    solved: Number(raw['solved'] ?? 0),
    atPar: Number(raw['atPar'] ?? 0),
  };
};

/** The tutorial flag lives in the user hash, so it survives app updates (localStorage does not). */
export const getTutorialDone = async (
  userId: string | undefined
): Promise<boolean> => {
  if (!userId) return false;
  return (await redis.hGet(`flock:u:${userId}`, 'tut')) === '1';
};

export const setTutorialDone = async (userId: string): Promise<void> => {
  await redis.hSet(`flock:u:${userId}`, { tut: '1' });
};

export const getStreak = async (
  userId: string | undefined
): Promise<StreakInfo> => {
  if (!userId) return { current: 0, best: 0 };
  const raw = await redis.hGetAll(`flock:u:${userId}`);
  const current = Number(raw['cur'] ?? 0);
  const best = Number(raw['best'] ?? 0);
  return { current, best: Math.max(best, current) };
};

/**
 * Updates the streak after a first solve of today's puzzle.
 * Same-day repeats cannot happen because only the first solve is recorded.
 */
export const bumpStreak = async (
  userId: string,
  day: number
): Promise<StreakInfo> => {
  const key = `flock:u:${userId}`;
  const raw = await redis.hGetAll(key);
  const last = Number(raw['last'] ?? 0);
  const prev = Number(raw['cur'] ?? 0);
  const best = Number(raw['best'] ?? 0);
  const current = last === day ? prev : last === day - 1 ? prev + 1 : 1;
  const nextBest = Math.max(best, current);
  await redis.hSet(key, {
    last: String(day),
    cur: String(current),
    best: String(nextBest),
  });
  return { current, best: nextBest };
};
