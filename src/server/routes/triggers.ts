import { Hono } from 'hono';
import type { OnAppInstallRequest, TriggerResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { createDailyPost } from '../core/post.ts';
import { getEpoch } from '../core/puzzle.ts';

export const triggers = new Hono();

triggers.post('/on-app-install', async (c) => {
  try {
    // Fixes the date of puzzle 1 before the first post is made.
    await getEpoch();
    const post = await createDailyPost();
    const input = await c.req.json<OnAppInstallRequest>();
    return c.json<TriggerResponse>(
      {
        status: 'success',
        message: post
          ? `Post ${post.id} for puzzle ${post.day} created in ${context.subredditName} (trigger: ${input.type})`
          : 'Post for today already exists',
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<TriggerResponse>(
      { status: 'error', message: 'Failed to create post' },
      400
    );
  }
});
