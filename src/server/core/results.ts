import { redis } from '@devvit/web/server';
import { isCrown, ratingFor } from '../../shared/engine/share.ts';
import { replay } from '../../shared/engine/step.ts';
import { dayKey } from './puzzle.ts';
import type { Dir } from '../../shared/engine/types.ts';
import type {
  Community,
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
  feather: replay(puzzle.level, moves)?.feather ?? false,
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

export const getBestCrown = async (
  puzzle: PuzzleInfo,
  userId: string
): Promise<ResultInfo | null> => {
  if (puzzle.crownPar === null) return null;
  const text = await redis.hGet(dayKey('k', puzzle.day), userId);
  const moves = text ? parseMoves(text) : [];
  return moves.length > 0 ? toResult(puzzle, moves) : null;
};

/**
 * Keeps a feather solve if it is the player's shortest one. The first time a
 * player's best feather solve reaches Crown par, the day's Crown count goes up.
 * Returns the best feather solve after saving, or null for solves without the feather.
 */
export const saveBestCrown = async (
  puzzle: PuzzleInfo,
  userId: string,
  moves: Dir[]
): Promise<ResultInfo | null> => {
  const current = await getBestCrown(puzzle, userId);
  const crownPar = puzzle.crownPar;
  if (crownPar === null) return current;
  const round = toResult(puzzle, moves);
  if (!round.feather) return current;
  if (current && current.moves <= round.moves) return current;
  await redis.hSet(dayKey('k', puzzle.day), { [userId]: moves.join('') });
  const wasCrown = current !== null && isCrown(current.moves, crownPar);
  if (!wasCrown && isCrown(round.moves, crownPar)) {
    await redis.hIncrBy(dayKey('s', puzzle.day), 'crowned', 1);
  }
  return round;
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
  await redis.hIncrBy(dayKey('h', puzzle.day), String(moves.length), 1);
  const statsKey = dayKey('s', puzzle.day);
  await redis.hIncrBy(statsKey, 'solved', 1);
  if (moves.length === puzzle.par) {
    await redis.hIncrBy(statsKey, 'atPar', 1);
  }
  return true;
};

/**
 * Groups today's first solves for the chart, and works out what share of other
 * solvers this player beat on their first try.
 */
export const getCommunity = async (
  puzzle: PuzzleInfo,
  myFirstMoves: number | null
): Promise<Community> => {
  const raw = await redis.hGetAll(dayKey('h', puzzle.day));
  let atPar = 0;
  let near = 0;
  let far = 0;
  let total = 0;
  let worse = 0;
  for (const [field, value] of Object.entries(raw)) {
    const moves = Number(field);
    const count = Number(value);
    if (!Number.isInteger(moves) || !Number.isFinite(count) || count <= 0) {
      continue;
    }
    total += count;
    const over = moves - puzzle.par;
    if (over <= 0) atPar += count;
    else if (over <= 2) near += count;
    else far += count;
    if (myFirstMoves !== null && moves > myFirstMoves) worse += count;
  }
  const others = total - (myFirstMoves !== null ? 1 : 0);
  const beat =
    myFirstMoves !== null && others > 0
      ? Math.round((worse / others) * 100)
      : null;
  return { atPar, near, far, beat };
};

/**
 * Marks that a player has commented on this puzzle. Returns false if they
 * already had, so each player posts their result at most once per puzzle.
 */
export const claimComment = async (
  day: number,
  userId: string
): Promise<boolean> =>
  (await redis.hSetNX(dayKey('c', day), userId, String(Date.now()))) === 1;

export const releaseComment = async (
  day: number,
  userId: string
): Promise<void> => {
  await redis.hDel(dayKey('c', day), [userId]);
};

export const hasCommented = async (
  day: number,
  userId: string | undefined
): Promise<boolean> =>
  userId ? (await redis.hGet(dayKey('c', day), userId)) !== undefined : false;

export const getStats = async (day: number): Promise<DayStats> => {
  const raw = await redis.hGetAll(dayKey('s', day));
  return {
    solved: Number(raw['solved'] ?? 0),
    atPar: Number(raw['atPar'] ?? 0),
    crowned: Number(raw['crowned'] ?? 0),
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
