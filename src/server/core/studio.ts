import { context, redis, reddit } from '@devvit/web/server';
import { utcDate } from '../../shared/engine/daily.ts';
import { puzzleTitle } from '../../shared/engine/share.ts';
import { checkLevel, levelFingerprint, parseStudioLevel } from '../../shared/engine/studio.ts';
import type { Level } from '../../shared/engine/types.ts';
import type { PuzzleInfo } from '../../shared/api.ts';

/**
 * Boards built in Flock Studio. Each posted board gets an id; its level is
 * kept in Redis and the post's data holds only the id, so a board can never be
 * changed after it is posted.
 */
const boardKey = (id: number): string => `flock:studio:board:${id}`;
const NEXT_ID = 'flock:studio:next';
/** Fingerprint of every posted board, so the same board is posted once. */
const PRINTS = 'flock:studio:prints';
const quotaKey = (userId: string): string =>
  `flock:studio:quota:${userId}:${utcDate(new Date())}`;

/** Boards one player may post per UTC day. */
export const STUDIO_DAILY_LIMIT = 5;

type StoredBoard = {
  level: Level;
  par: number;
  crownPar: number | null;
  by: string;
};

const memory = new Map<number, PuzzleInfo>();

const toPuzzle = (id: number, board: StoredBoard): PuzzleInfo => ({
  day: id,
  label: 'Community',
  twist: board.level.kinds.includes('contrary'),
  level: board.level,
  par: board.par,
  crownPar: board.crownPar,
  custom: { id, by: board.by },
});

/** A posted Studio board, or null if there is no board with that id. */
export const getStudioPuzzle = async (id: number): Promise<PuzzleInfo | null> => {
  const cached = memory.get(id);
  if (cached) return cached;
  const text = await redis.get(boardKey(id));
  if (!text) return null;
  const raw: unknown = JSON.parse(text);
  if (typeof raw !== 'object' || raw === null) return null;
  const level = parseStudioLevel(Reflect.get(raw, 'level'));
  const by = Reflect.get(raw, 'by');
  if (!level || typeof by !== 'string') return null;
  // Par is worked out again rather than read back, so a stored board can never claim a wrong par.
  const check = checkLevel(level);
  if (!check.ok) return null;
  const puzzle = toPuzzle(id, { level, par: check.par, crownPar: check.crownPar, by });
  memory.set(id, puzzle);
  return puzzle;
};

export type StudioPostOutcome =
  | { ok: true; id: number; url: string }
  | { ok: false; status: 400 | 409 | 429; message: string };

/**
 * Checks a board with the solver and posts it to the subreddit as the player.
 * Refuses boards the solver rejects, a board that is already posted, and more
 * than STUDIO_DAILY_LIMIT posts per player per day.
 */
export const postStudioBoard = async (
  level: Level,
  userId: string,
  username: string
): Promise<StudioPostOutcome> => {
  const check = checkLevel(level);
  if (!check.ok) return { ok: false, status: 400, message: check.reason };

  const quota = quotaKey(userId);
  const used = await redis.incrBy(quota, 1);
  await redis.expire(quota, 2 * 24 * 60 * 60);
  if (used > STUDIO_DAILY_LIMIT) {
    return {
      ok: false,
      status: 429,
      message: `You can post ${STUDIO_DAILY_LIMIT} boards a day. Come back tomorrow.`,
    };
  }

  const id = await redis.incrBy(NEXT_ID, 1);
  const print = levelFingerprint(level);
  if ((await redis.hSetNX(PRINTS, print, String(id))) !== 1) {
    await redis.incrBy(quota, -1);
    return { ok: false, status: 409, message: 'This exact board is already posted.' };
  }

  const board: StoredBoard = { level, par: check.par, crownPar: check.crownPar, by: username };
  try {
    await redis.set(boardKey(id), JSON.stringify(board));
    const crown =
      (check.crownPar !== null ? ' · 👑' : '') +
      (level.kinds.includes('contrary') ? ' · Twist' : '');
    const post = await reddit.submitCustomPost({
      runAs: 'USER',
      userGeneratedContent: {
        text: `A Flock puzzle built by u/${username} in Flock Studio. Par ${check.par}.`,
      },
      subredditName: context.subredditName,
      title: `${puzzleTitle(id, username)} · Par ${check.par}${crown}`,
      entry: 'default',
      postData: { studio: id },
    });
    return { ok: true, id, url: `https://www.reddit.com${post.permalink}` };
  } catch (error) {
    // Undo the claim so the player can try again.
    await redis.hDel(PRINTS, [print]);
    await redis.del(boardKey(id));
    await redis.incrBy(quota, -1);
    throw error;
  }
};
