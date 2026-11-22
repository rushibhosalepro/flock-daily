import type { Dir, Level } from '../shared/engine/types.ts';
import type {
  CommentResponse,
  ErrorResponse,
  InitResponse,
  JoinResponse,
  StudioPostResponse,
  SubmitRequest,
  SubmitResponse,
} from '../shared/api.ts';

const hasField = (value: unknown, field: string, expected: string): boolean =>
  typeof value === 'object' &&
  value !== null &&
  field in value &&
  Reflect.get(value, field) === expected;

const isError = (value: unknown): value is ErrorResponse =>
  hasField(value, 'status', 'error');

// The server builds these responses with the same shared types, so the tag is enough.
const isInit = (value: unknown): value is InitResponse =>
  hasField(value, 'type', 'init');

const isSubmit = (value: unknown): value is SubmitResponse =>
  hasField(value, 'type', 'submit');

export const fetchInit = async (): Promise<InitResponse> => {
  const response = await fetch('/api/init');
  const body: unknown = await response.json();
  if (isInit(body)) return body;
  throw new Error(isError(body) ? body.message : 'Could not load the puzzle');
};

const isComment = (value: unknown): value is CommentResponse =>
  hasField(value, 'type', 'comment');
const isJoin = (value: unknown): value is JoinResponse =>
  hasField(value, 'type', 'join');

/** Subscribes the player to this subreddit. Called only from the Join button. */
export const joinSubreddit = async (): Promise<JoinResponse> => {
  const response = await fetch('/api/join', { method: 'POST' });
  const body: unknown = await response.json();
  if (isJoin(body)) return body;
  throw new Error(isError(body) ? body.message : 'Could not join');
};

/** Asks the server to post the player's result as a comment, as the player. */
export const postComment = async (): Promise<CommentResponse> => {
  const response = await fetch('/api/comment', { method: 'POST' });
  const body: unknown = await response.json();
  if (isComment(body)) return body;
  throw new Error(isError(body) ? body.message : 'Could not post the comment');
};

const isStudioPost = (value: unknown): value is StudioPostResponse =>
  hasField(value, 'type', 'studio-post');

/** Asks the server to check a Studio board and post it, as the player. Throws with the reason if refused. */
export const postStudioBoard = async (level: Level): Promise<StudioPostResponse> => {
  const response = await fetch('/api/studio/post', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level }),
  });
  const body: unknown = await response.json();
  if (isStudioPost(body)) return body;
  throw new Error(isError(body) ? body.message : 'Could not post the puzzle');
};

/** Saves the sound choice. Failure is harmless: it only resets on the next visit. */
export const saveSound = async (on: boolean): Promise<void> => {
  try {
    await fetch('/api/sound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ on }),
    });
  } catch {
    // Ignore network errors.
  }
};

/** Tells the server the tutorial is done. Failure is harmless: the tutorial just shows again later. */
export const markTutorialDone = async (): Promise<void> => {
  try {
    await fetch('/api/tutorial-done', { method: 'POST' });
  } catch {
    // Ignore network errors.
  }
};

export const submitMoves = async (moves: Dir[]): Promise<SubmitResponse> => {
  const request: SubmitRequest = { moves };
  const response = await fetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const body: unknown = await response.json();
  if (isSubmit(body)) return body;
  throw new Error(isError(body) ? body.message : 'Could not save the result');
};
