import type { Dir } from '../shared/engine/types.ts';
import type {
  CommentResponse,
  ErrorResponse,
  InitResponse,
  JoinResponse,
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
