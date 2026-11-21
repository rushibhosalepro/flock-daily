import { Hono } from 'hono';
import { context, reddit } from '@devvit/web/server';
import { replay } from '../../shared/engine/step.ts';
import { getPostUrl } from '../core/post.ts';
import { getPuzzle, getToday } from '../core/puzzle.ts';
import {
  bumpStreak,
  getStats,
  getBestCrown,
  getBestResult,
  getStreak,
  getTutorialDone,
  isDir,
  setTutorialDone,
  recordResult,
  saveBestCrown,
  saveBestResult,
  toResult,
} from '../core/results.ts';
import type { Dir } from '../../shared/engine/types.ts';
import type {
  ErrorResponse,
  InitResponse,
  SubmitResponse,
  TutorialDoneResponse,
} from '../../shared/api.ts';

export const api = new Hono();

const MAX_MOVES = 200;

const dayFromPostData = (postData: unknown): number | null => {
  if (typeof postData !== 'object' || postData === null) return null;
  if (!('day' in postData)) return null;
  const day = postData.day;
  return typeof day === 'number' && Number.isInteger(day) && day >= 1
    ? day
    : null;
};

const parseMoveList = (body: unknown): Dir[] | null => {
  if (typeof body !== 'object' || body === null) return null;
  if (!('moves' in body) || !Array.isArray(body.moves)) return null;
  if (body.moves.length === 0 || body.moves.length > MAX_MOVES) return null;
  const out: Dir[] = [];
  for (const move of body.moves) {
    if (!isDir(move)) return null;
    out.push(move);
  }
  return out;
};

api.get('/init', async (c) => {
  try {
    const today = await getToday();
    const day = dayFromPostData(context.postData) ?? today;
    const puzzle = await getPuzzle(day);
    const userId = context.userId;
    const isToday = day === today;
    const [username, best, bestCrown, streak, stats, tutorialDone, todayUrl] =
      await Promise.all([
        reddit.getCurrentUsername(),
        userId ? getBestResult(puzzle, userId) : Promise.resolve(null),
        userId ? getBestCrown(puzzle, userId) : Promise.resolve(null),
        getStreak(userId),
        getStats(day),
        getTutorialDone(userId),
        isToday ? Promise.resolve(null) : getPostUrl(today),
      ]);
    return c.json<InitResponse>({
      type: 'init',
      puzzle,
      today,
      isToday,
      todayUrl,
      username: username ?? null,
      tutorialDone,
      best,
      bestCrown,
      streak,
      stats,
    });
  } catch (error) {
    console.error('init failed', error);
    return c.json<ErrorResponse>(
      { status: 'error', message: 'Could not load the puzzle' },
      500
    );
  }
});

api.post('/tutorial-done', async (c) => {
  try {
    const userId = context.userId;
    if (userId) await setTutorialDone(userId);
    return c.json<TutorialDoneResponse>({
      type: 'tutorial-done',
      saved: Boolean(userId),
    });
  } catch (error) {
    console.error('tutorial-done failed', error);
    return c.json<ErrorResponse>(
      { status: 'error', message: 'Could not save tutorial progress' },
      500
    );
  }
});

api.post('/submit', async (c) => {
  try {
    const body: unknown = await c.req.json();
    const moves = parseMoveList(body);
    if (!moves) {
      return c.json<ErrorResponse>(
        { status: 'error', message: 'Invalid move list' },
        400
      );
    }

    const today = await getToday();
    const day = dayFromPostData(context.postData) ?? today;
    const puzzle = await getPuzzle(day);

    // The server never trusts the client: it replays the moves itself.
    const outcome = replay(puzzle.level, moves);
    if (!outcome || !outcome.solved) {
      return c.json<ErrorResponse>(
        { status: 'error', message: 'Those moves do not solve the puzzle' },
        400
      );
    }

    const userId = context.userId;
    let recorded = false;
    let streak = await getStreak(userId);
    const result = toResult(puzzle, moves);
    let best = result;
    let bestCrown = result.feather && puzzle.crownPar !== null ? result : null;
    if (userId) {
      // Daily stats and the streak use the first solve. The best scores keep improving on replays.
      recorded = await recordResult(puzzle, userId, moves);
      if (recorded && day === today) {
        streak = await bumpStreak(userId, day);
      }
      best = await saveBestResult(puzzle, userId, moves);
      bestCrown = await saveBestCrown(puzzle, userId, moves);
    }
    return c.json<SubmitResponse>({
      type: 'submit',
      result,
      best,
      bestCrown,
      recorded,
      streak,
      stats: await getStats(day),
    });
  } catch (error) {
    console.error('submit failed', error);
    return c.json<ErrorResponse>(
      { status: 'error', message: 'Could not save the result' },
      500
    );
  }
});
