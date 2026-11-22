import { context, redis, reddit } from '@devvit/web/server';
import { getPuzzle, getToday } from './puzzle.ts';
import { getLeaders, getStats } from './results.ts';
import { recapText } from '../../shared/community.ts';

const urlKey = (day: number): string => `flock:postUrl:${day}`;

const titlePrefix = (day: number): string => `Flock #${day} ·`;

const fullUrl = (permalink: string): string =>
  `https://www.reddit.com${permalink}`;

/**
 * Creates the Reddit post for a puzzle day. Each day gets at most one post,
 * so a retried scheduler run or a repeated menu click cannot create duplicates.
 * Returns null when the post for that day already exists.
 */
export const createDailyPost = async (
  day?: number
): Promise<{ id: string; day: number; url: string } | null> => {
  const target = day ?? (await getToday());
  const first = await redis.incrBy(`flock:posted:${target}`, 1);
  if (first !== 1) return null;

  try {
    const puzzle = await getPuzzle(target);
    const post = await reddit.submitCustomPost({
      title: `${titlePrefix(target)} ${puzzle.label}${puzzle.twist ? ' · yellow flies the other way' : ''}`,
      entry: 'default',
      postData: { day: target },
    });
    const url = fullUrl(post.permalink);
    await redis.set(urlKey(target), url);
    // The scores comment is also made on first use, so a failure here is not fatal.
    await getScoresThread(post.id, `Flock #${target}`, target).catch((error: unknown) =>
      console.error('could not make the scores comment', error)
    );
    return { id: post.id, day: target, url };
  } catch (error) {
    // Free the guard so a later run can retry.
    await redis.del(`flock:posted:${target}`);
    throw error;
  }
};

/**
 * How the day before went, for the top of a new day's results thread.
 * Null on day 1, when nobody solved, or if the numbers cannot be read.
 */
const yesterdayRecap = async (day: number): Promise<string | null> => {
  if (day <= 1) return null;
  try {
    const [puzzle, stats, leaders] = await Promise.all([
      getPuzzle(day - 1),
      getStats(day - 1),
      getLeaders(day - 1, undefined),
    ]);
    return recapText({
      day: day - 1,
      par: puzzle.par,
      solved: stats.solved,
      atPar: stats.atPar,
      crowned: stats.crowned,
      top: leaders.top,
    });
  } catch (error) {
    console.error(`could not build the recap for day ${day - 1}`, error);
    return null;
  }
};

const threadKey = (postId: string): string => `flock:scores:${postId}`;
const isCommentId = (id: string | undefined): id is `t1_${string}` =>
  id !== undefined && id.startsWith('t1_');
const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));

/**
 * The app's stickied comment that players' results are posted under, as
 * Reddit asks of score comments. It is made once per post, the first time it
 * is needed, and remembered in Redis.
 */
export const getScoresThread = async (
  postId: `t3_${string}`,
  /** "Flock #12" or "Community Flock by u/name". */
  title: string,
  /** The daily puzzle number, so yesterday's recap can head the thread. Null for Studio boards. */
  day: number | null
): Promise<`t1_${string}`> => {
  const stored = await redis.get(threadKey(postId));
  if (isCommentId(stored)) return stored;
  // Only one request makes the comment; any other waits for it.
  const lock = `${threadKey(postId)}:lock`;
  if ((await redis.incrBy(lock, 1)) !== 1) {
    await pause(1500);
    const made = await redis.get(threadKey(postId));
    if (isCommentId(made)) return made;
    throw new Error('the scores comment is still being made');
  }
  try {
    const intro = `**${title} results.** Tap "Post to comments" in the game to add yours here. Solutions are hidden as spoilers.`;
    const recap = day === null ? null : await yesterdayRecap(day);
    const comment = await reddit.submitComment({
      id: postId,
      text: recap ? `${intro}\n\n${recap}` : intro,
    });
    await comment.distinguish(true);
    await redis.set(threadKey(postId), comment.id);
    return comment.id;
  } finally {
    await redis.del(lock);
  }
};

/**
 * The URL of a day's post, so old posts can send players to today's puzzle.
 * Posts made before URLs were stored are found among the newest posts in the
 * subreddit. If the day has no post at all (the scheduler failed), it is created.
 * Returns null when nothing can be found; the game still works without it.
 */
export const getPostUrl = async (day: number): Promise<string | null> => {
  try {
    const stored = await redis.get(urlKey(day));
    if (stored) return stored;

    const prefix = titlePrefix(day);
    const recent = await reddit
      .getNewPosts({ subredditName: context.subredditName, limit: 50 })
      .all();
    const match = recent.find((post) => post.title.startsWith(prefix));
    if (match) {
      const url = fullUrl(match.permalink);
      await redis.set(urlKey(day), url);
      return url;
    }

    const created = await createDailyPost(day);
    return created?.url ?? null;
  } catch (error) {
    console.error(`could not find the post for day ${day}`, error);
    return null;
  }
};
