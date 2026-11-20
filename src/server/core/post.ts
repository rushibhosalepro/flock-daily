import { redis, reddit } from '@devvit/web/server';
import { getPuzzle, getToday } from './puzzle.ts';

/**
 * Creates the Reddit post for a puzzle day. Each day gets at most one post,
 * so a retried scheduler run or a repeated menu click cannot create duplicates.
 * Returns null when the post for that day already exists.
 */
export const createDailyPost = async (
  day?: number
): Promise<{ id: string; day: number } | null> => {
  const target = day ?? (await getToday());
  const first = await redis.incrBy(`flock:posted:${target}`, 1);
  if (first !== 1) return null;

  try {
    const puzzle = await getPuzzle(target);
    const post = await reddit.submitCustomPost({
      title: `Flock #${target} · ${puzzle.label}${puzzle.twist ? ' · yellow flies the other way' : ''}`,
      entry: 'default',
      postData: { day: target },
    });
    return { id: post.id, day: target };
  } catch (error) {
    // Free the guard so a later run can retry.
    await redis.del(`flock:posted:${target}`);
    throw error;
  }
};
