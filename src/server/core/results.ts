import { redis } from '@devvit/web/server';
import { isCrown, ratingFor } from '../../shared/engine/share.ts';
import { replay } from '../../shared/engine/step.ts';
import { dayKey, puzzleSlot } from './puzzle.ts';
import type { Slot } from './puzzle.ts';
import type { Dir } from '../../shared/engine/types.ts';
import type {
  Community,
  DayStats,
  Leaders,
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
  const text = await redis.hGet(dayKey('r', puzzleSlot(puzzle)), userId);
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
  const text = await redis.hGet(dayKey('b', puzzleSlot(puzzle)), userId);
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
  await redis.hSet(dayKey('b', puzzleSlot(puzzle)), { [userId]: moves.join('') });
  return toResult(puzzle, moves);
};

export const getBestCrown = async (
  puzzle: PuzzleInfo,
  userId: string
): Promise<ResultInfo | null> => {
  if (puzzle.crownPar === null) return null;
  const text = await redis.hGet(dayKey('k', puzzleSlot(puzzle)), userId);
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
  await redis.hSet(dayKey('k', puzzleSlot(puzzle)), { [userId]: moves.join('') });
  const wasCrown = current !== null && isCrown(current.moves, crownPar);
  if (!wasCrown && isCrown(round.moves, crownPar)) {
    await redis.hIncrBy(dayKey('s', puzzleSlot(puzzle)), 'crowned', 1);
  }
  return round;
};

/**
 * Sort key for the top solvers: fewer first-solve moves first, then whoever
 * solved earlier. Seconds stay below 1e9 for decades, so they never reach the moves part.
 */
const leaderScore = (moves: number, now: number): number =>
  moves * 1e9 + (Math.floor(now / 1000) % 1e9);

/** Adds a player's first solve to the day's top solvers. */
export const addLeader = async (
  slot: Slot,
  username: string,
  moves: number
): Promise<void> => {
  await redis.zAdd(dayKey('l', slot), {
    member: username,
    score: leaderScore(moves, Date.now()),
  });
};

/**
 * Marks that a player earned the Crown on this puzzle, for the badge on the top
 * solvers list. A daily Crown also counts once towards their Crown total (field
 * `crw`, shown in flair). Studio boards never count, so nobody can build an easy
 * board to collect Crowns. Returns true only the first time for this puzzle.
 */
export const markCrowned = async (
  slot: Slot,
  username: string,
  userId: string
): Promise<boolean> => {
  const added = await redis.hSetNX(dayKey('w', slot), username, '1');
  if (added !== 1) return false;
  if (typeof slot === 'number') {
    await redis.hIncrBy(`flock:u:${userId}`, 'crw', 1);
  }
  return true;
};

const TOP = 3;

export const getLeaders = async (
  slot: Slot,
  username: string | undefined
): Promise<Leaders> => {
  const key = dayKey('l', slot);
  const [top, total, rank, crowned] = await Promise.all([
    redis.zRange(key, 0, TOP - 1, { by: 'rank' }),
    redis.zCard(key),
    username ? redis.zRank(key, username) : Promise.resolve(undefined),
    redis.hGetAll(dayKey('w', slot)),
  ]);
  return {
    top: top.map((entry) => ({
      name: entry.member,
      moves: Math.floor(entry.score / 1e9),
      crown: crowned[entry.member] === '1',
    })),
    myRank: rank === undefined ? null : rank + 1,
    total,
  };
};

/** Stores the first solve for a user. Returns true only for the first one. */
export const recordResult = async (
  puzzle: PuzzleInfo,
  userId: string,
  moves: Dir[]
): Promise<boolean> => {
  const created = await redis.hSetNX(
    dayKey('r', puzzleSlot(puzzle)),
    userId,
    moves.join('')
  );
  if (!created) return false;
  await redis.hIncrBy(dayKey('h', puzzleSlot(puzzle)), String(moves.length), 1);
  const statsKey = dayKey('s', puzzleSlot(puzzle));
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
  const raw = await redis.hGetAll(dayKey('h', puzzleSlot(puzzle)));
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
  slot: Slot,
  userId: string
): Promise<boolean> =>
  (await redis.hSetNX(dayKey('c', slot), userId, String(Date.now()))) === 1;

export const releaseComment = async (
  slot: Slot,
  userId: string
): Promise<void> => {
  await redis.hDel(dayKey('c', slot), [userId]);
};

export const hasCommented = async (
  slot: Slot,
  userId: string | undefined
): Promise<boolean> =>
  userId ? (await redis.hGet(dayKey('c', slot), userId)) !== undefined : false;

export const getStats = async (slot: Slot): Promise<DayStats> => {
  const raw = await redis.hGetAll(dayKey('s', slot));
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

/** Sound is on unless the player turned it off. Field `snd` is '0' when muted. */
export const getSoundOn = async (
  userId: string | undefined
): Promise<boolean> => {
  if (!userId) return true;
  return (await redis.hGet(`flock:u:${userId}`, 'snd')) !== '0';
};

export const setSoundOn = async (userId: string, on: boolean): Promise<void> => {
  await redis.hSet(`flock:u:${userId}`, { snd: on ? '1' : '0' });
};

/**
 * Reddit has no API to check a subscription, so the game remembers that the
 * player joined from here. Field `sub` holds the subreddit name.
 */
export const getJoined = async (
  userId: string | undefined,
  subredditName: string
): Promise<boolean> => {
  if (!userId) return false;
  return (await redis.hGet(`flock:u:${userId}`, 'sub')) === subredditName;
};

export const setJoined = async (
  userId: string,
  subredditName: string
): Promise<void> => {
  await redis.hSet(`flock:u:${userId}`, { sub: subredditName });
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
