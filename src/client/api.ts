import type { Dir } from '../shared/engine/types.ts';
import type {
  ErrorResponse,
  InitResponse,
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
