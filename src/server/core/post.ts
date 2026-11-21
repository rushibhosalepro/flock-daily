import { context, redis, reddit } from '@devvit/web/server';
import { getPuzzle, getToday } from './puzzle.ts';

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
    return { id: post.id, day: target, url };
  } catch (error) {
    // Free the guard so a later run can retry.
    await redis.del(`flock:posted:${target}`);
    throw error;
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
