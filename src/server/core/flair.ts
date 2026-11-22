import { context, redis, reddit } from '@devvit/web/server';
import { flairFor } from '../../shared/community.ts';

const userKey = (userId: string): string => `flock:u:${userId}`;

/**
 * Sets the player's subreddit flair to their streak and Crown count, e.g.
 * "🔥 7-day streak · 👑 2". Runs after a first solve or a new Crown.
 *
 * A flair the player chose themselves is never replaced: the app only changes
 * a flair that is empty or that it set last time (remembered in field `fl`).
 * Failures are logged and ignored, because flair must never block a solve.
 */
export const updatePlayerFlair = async (
  userId: string,
  username: string,
  today: number
): Promise<void> => {
  try {
    const subredditName = context.subredditName;
    const raw = await redis.hGetAll(userKey(userId));
    const last = Number(raw['last'] ?? 0);
    // A streak that missed yesterday is over, even before the next solve resets it.
    const streak = last >= today - 1 ? Number(raw['cur'] ?? 0) : 0;
    const crowns = Number(raw['crw'] ?? 0);
    const ours = raw['fl'] ?? '';

    const user = await reddit.getCurrentUser();
    const current = (await user?.getUserFlairBySubreddit(subredditName))?.flairText ?? '';
    if (current !== '' && current !== ours) return;

    const style = flairFor(streak, crowns);
    if (!style) {
      if (ours !== '' && current === ours) {
        await reddit.removeUserFlair(subredditName, username);
        await redis.hDel(userKey(userId), ['fl']);
      }
      return;
    }
    if (style.text === current) return;
    await reddit.setUserFlair({
      subredditName,
      username,
      text: style.text,
      backgroundColor: style.backgroundColor,
      textColor: style.textColor,
    });
    await redis.hSet(userKey(userId), { fl: style.text });
  } catch (error) {
    console.error('could not update flair', error);
  }
};
