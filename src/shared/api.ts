import type { Dir, Level } from './engine/types.ts';
import type { Rating } from './engine/share.ts';

export type PuzzleInfo = {
  day: number;
  label: string;
  twist: boolean;
  level: Level;
  par: number;
  /** Fewest moves for a Crown, or null on a day without a feather. */
  crownPar: number | null;
};

export type ResultInfo = {
  moves: number;
  par: number;
  rating: Rating;
  /** The solution as recorded on the server. */
  moveList: Dir[];
  /** True when this solve collected the golden feather. */
  feather: boolean;
};

export type DayStats = {
  solved: number;
  atPar: number;
  /** Players who earned the Crown: every bird home with the feather, within Crown par. */
  crowned: number;
};

/** How today's first solves are spread, for the bar chart on the result card. */
export type Community = {
  /** Players whose first solve hit par. */
  atPar: number;
  /** Players 1 or 2 moves over par. */
  near: number;
  /** Players 3 or more moves over par. */
  far: number;
  /** Percent of other solvers who used more moves on their first try than you, or null. */
  beat: number | null;
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
  /** Link to today's post, sent only when this post is an older puzzle. */
  todayUrl: string | null;
  username: string | null;
  /** True once this player has finished the tutorial. Always false when logged out. */
  tutorialDone: boolean;
  /** This player's fewest-move solve of this puzzle, or null if they have not solved it. */
  best: ResultInfo | null;
  /** This player's fewest-move solve that collected the feather, or null. */
  bestCrown: ResultInfo | null;
  /** This player's first solve, which is what the daily stats count. */
  first: ResultInfo | null;
  /** True once this player has posted their result as a comment on this post. */
  commented: boolean;
  subredditName: string;
  /** True once this player joined the subreddit from the game. */
  joined: boolean;
  community: Community;
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
  /** The player's best feather solve so far, or null if none. */
  bestCrown: ResultInfo | null;
  /** The player's first solve, which is what the daily stats count. */
  first: ResultInfo;
  community: Community;
  /** True when this round was the player's first solve, which is what daily stats count. */
  recorded: boolean;
  streak: StreakInfo;
  stats: DayStats;
};

export type CommentResponse = {
  type: 'comment';
  /** 'posted' now, 'already' if this player commented before. */
  outcome: 'posted' | 'already';
};

export type JoinResponse = {
  type: 'join';
  joined: boolean;
};
export type TutorialDoneResponse = {
  type: 'tutorial-done';
  saved: boolean;
};

export type ErrorResponse = {
  status: 'error';
  message: string;
};
