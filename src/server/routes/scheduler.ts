import { Hono } from 'hono';
import type { TaskResponse } from '@devvit/web/server';
import { createDailyPost } from '../core/post.ts';

export const scheduler = new Hono();

scheduler.post('/daily-post', async (c) => {
  try {
    const post = await createDailyPost();
    console.log(
      post ? `daily post created: ${post.id}` : 'daily post already exists'
    );
    return c.json<TaskResponse>({ status: 'ok' }, 200);
  } catch (error) {
    console.error('daily post failed', error);
    return c.json<TaskResponse>({ status: 'error' }, 500);
  }
});
