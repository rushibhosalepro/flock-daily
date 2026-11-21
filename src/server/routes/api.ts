import { Hono } from 'hono';
import { context, reddit } from '@devvit/web/server';
import { replay } from '../../shared/engine/step.ts';
import { getPostUrl, getScoresThread } from '../core/post.ts';
import { getPuzzle, getToday } from '../core/puzzle.ts';
import { commentText, isCrown } from '../../shared/engine/share.ts';
import {
  bumpStreak,
  claimComment,
  getCommunity,
  getStoredResult,
  hasCommented,
  releaseComment,
  getStats,
  getBestCrown,
  getBestResult,
  getStreak,
  addLeader,
  getJoined,
  getLeaders,
  markCrowned,
  getTutorialDone,
  isDir,
  setJoined,
  setTutorialDone,
  recordResult,
  saveBestCrown,
  saveBestResult,
  toResult,
} from '../core/results.ts';
import type { Dir } from '../../shared/engine/types.ts';
import type {
  CommentResponse,
  ErrorResponse,
  InitResponse,
  JoinResponse,
  SubmitResponse,
  TutorialDoneResponse,
} from '../../shared/api.ts';

export const api = new Hono();

/** Narrows a post id to Reddit's `t3_` form without a cast. */
const isPostId = (id: string): id is `t3_${string}` => id.startsWith('t3_');

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
    const [
      username,
      best,
      bestCrown,
      first,
      commented,
      streak,
      stats,
      tutorialDone,
      todayUrl,
      joined,
    ] = await Promise.all([
      reddit.getCurrentUsername(),
      userId ? getBestResult(puzzle, userId) : Promise.resolve(null),
      userId ? getBestCrown(puzzle, userId) : Promise.resolve(null),
      userId ? getStoredResult(puzzle, userId) : Promise.resolve(null),
      hasCommented(day, userId),
      getStreak(userId),
      getStats(day),
      getTutorialDone(userId),
      isToday ? Promise.resolve(null) : getPostUrl(today),
      getJoined(userId, context.subredditName),
    ]);
    const [community, leaders] = await Promise.all([
      getCommunity(puzzle, first?.moves ?? null),
      getLeaders(day, username ?? undefined),
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
      first,
      commented,
      leaders,
      subredditName: context.subredditName,
      joined,
      community,
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

/**
 * Posts the player's result as a comment on this post, as the player.
 * The text is built here from the player's verified best solve, never from the
 * client, and each player can post at most once per puzzle.
 */
/** Subscribes the player to this subreddit, only from their tap on Join. */
api.post('/join', async (c) => {
  const userId = context.userId;
  if (!userId) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'Log in to Reddit to join' },
      401
    );
  }
  try {
    await reddit.subscribeToCurrentSubreddit();
    await setJoined(userId, context.subredditName);
    return c.json<JoinResponse>({ type: 'join', joined: true });
  } catch (error) {
    console.error('join failed', error);
    return c.json<ErrorResponse>(
      { status: 'error', message: 'Could not join the community' },
      500
    );
  }
});

api.post('/comment', async (c) => {
  const userId = context.userId;
  const postId = context.postId;
  if (!userId || !postId) {
    return c.json<ErrorResponse>(
      { status: 'error', message: 'Log in to Reddit to comment' },
      401
    );
  }
  try {
    const today = await getToday();
    const day = dayFromPostData(context.postData) ?? today;
    const puzzle = await getPuzzle(day);
    const [best, bestCrown, streak] = await Promise.all([
      getBestResult(puzzle, userId),
      getBestCrown(puzzle, userId),
      getStreak(userId),
    ]);
    if (!best) {
      return c.json<ErrorResponse>(
        { status: 'error', message: 'Solve the puzzle first' },
        400
      );
    }
    if (!(await claimComment(day, userId))) {
      return c.json<CommentResponse>({ type: 'comment', outcome: 'already' });
    }
    const text = commentText({
      day,
      moves: best.moves,
      par: puzzle.par,
      streak: day === today ? streak.current : 0,
      crownPar: puzzle.crownPar,
      crownMoves: bestCrown?.moves ?? null,
      solution: best.moveList,
    });
    if (!isPostId(postId)) throw new Error(`unexpected post id ${postId}`);
    try {
      const thread = await getScoresThread(postId, day);
      await reddit.submitComment({ id: thread, text, runAs: 'USER' });
    } catch (error) {
      // Let the player try again if Reddit refused the comment.
      await releaseComment(day, userId);
      throw error;
    }
    return c.json<CommentResponse>({ type: 'comment', outcome: 'posted' });
  } catch (error) {
    console.error('comment failed', error);
    return c.json<ErrorResponse>(
      { status: 'error', message: 'Could not post the comment' },
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
    const username = userId ? await reddit.getCurrentUsername() : undefined;
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
      if (username) {
        if (recorded) await addLeader(day, username, moves.length);
        if (
          bestCrown &&
          puzzle.crownPar !== null &&
          isCrown(bestCrown.moves, puzzle.crownPar)
        ) {
          await markCrowned(day, username);
        }
      }
    }
    const first =
      (userId ? await getStoredResult(puzzle, userId) : null) ?? result;
    const community = await getCommunity(
      puzzle,
      userId ? first.moves : null
    );
    return c.json<SubmitResponse>({
      type: 'submit',
      result,
      best,
      bestCrown,
      first,
      community,
      leaders: await getLeaders(day, username),
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
