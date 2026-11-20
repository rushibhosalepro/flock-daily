import type { Dir, Level } from './engine/types.ts';
import type { Rating } from './engine/share.ts';

export type PuzzleInfo = {
  day: number;
  label: string;
  twist: boolean;
  level: Level;
  par: number;
};

export type ResultInfo = {
  moves: number;
  par: number;
  rating: Rating;
  /** The solution as recorded on the server. */
  moveList: Dir[];
};

export type DayStats = {
  solved: number;
  atPar: number;
};

export type StreakInfo = {
  current: number;
  best: number;
};

export type InitResponse = {
  type: 'init';
  puzzle: PuzzleInfo;
  /** Puzzle number for the current UTC day. */
  today: number;
  /** True when this post is today's puzzle, so a solve counts toward the streak. */
  isToday: boolean;
  username: string | null;
  /** True once this player has finished the tutorial. Always false when logged out. */
  tutorialDone: boolean;
  /** This player's fewest-move solve of this puzzle, or null if they have not solved it. */
  best: ResultInfo | null;
  streak: StreakInfo;
  stats: DayStats;
};

export type SubmitRequest = {
  moves: Dir[];
};

export type SubmitResponse = {
  type: 'submit';
  /** The round just played, as verified by the server. */
  result: ResultInfo;
  /** The player's best solve so far, including this round. */
  best: ResultInfo;
  /** True when this round was the player's first solve, which is what daily stats count. */
  recorded: boolean;
  streak: StreakInfo;
  stats: DayStats;
};

export type TutorialDoneResponse = {
  type: 'tutorial-done';
  saved: boolean;
};

export type ErrorResponse = {
  status: 'error';
  message: string;
};
