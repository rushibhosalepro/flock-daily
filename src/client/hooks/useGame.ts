import { isSolved, onFeather, step } from '../../shared/engine/step.ts';
import type { Dir, Level, State } from '../../shared/engine/types.ts';

export type GameState = {
  level: Level;
  current: State;
  history: State[];
  moves: Dir[];
  /** True per bird when its last horizontal flight was to the left. */
  facing: readonly [boolean, boolean, boolean];
  /** Counts blocked swipes, used to replay the shake animation. */
  blocked: number;
  /** Birds that stayed put on the last swipe, so they can squash against what stopped them. */
  bumped: readonly [boolean, boolean, boolean];
  /** Increases on every swipe, so the squash animation replays. */
  swipes: number;
  /** Direction of the last swipe, for the squash direction. */
  lastDir: Dir | null;
  /** True once a bird has landed on the golden feather this run. */
  feather: boolean;
  /** Feather state before each move, so undo can give the feather back. */
  featherHistory: boolean[];
  status: 'playing' | 'won';
};

export type GameAction =
  { type: 'move'; dir: Dir } | { type: 'undo' } | { type: 'restart' };

export const createGame = (level: Level): GameState => ({
  level,
  current: level.starts,
  history: [],
  moves: [],
  facing: [false, false, false],
  blocked: 0,
  bumped: [false, false, false],
  swipes: 0,
  lastDir: null,
  feather: onFeather(level, level.starts),
  featherHistory: [],
  status: 'playing',
});

const stayed = (
  before: State,
  after: State
): readonly [boolean, boolean, boolean] => [
  before[0] === after[0],
  before[1] === after[1],
  before[2] === after[2],
];

const faceAfter = (
  level: Level,
  before: State,
  after: State,
  previous: GameState['facing']
): GameState['facing'] => {
  const pick = (i: 0 | 1 | 2): boolean => {
    const from = before[i] % level.size;
    const to = after[i] % level.size;
    if (to < from) return true;
    if (to > from) return false;
    return previous[i];
  };
  return [pick(0), pick(1), pick(2)];
};

export const gameReducer = (
  state: GameState,
  action: GameAction
): GameState => {
  switch (action.type) {
    case 'move': {
      if (state.status !== 'playing') return state;
      const result = step(state.level, state.current, action.dir);
      if (!result.changed) {
        return {
          ...state,
          blocked: state.blocked + 1,
          bumped: [true, true, true],
          swipes: state.swipes + 1,
          lastDir: action.dir,
        };
      }
      return {
        ...state,
        bumped: stayed(state.current, result.state),
        swipes: state.swipes + 1,
        lastDir: action.dir,
        feather: state.feather || onFeather(state.level, result.state),
        featherHistory: [...state.featherHistory, state.feather],
        current: result.state,
        history: [...state.history, state.current],
        moves: [...state.moves, action.dir],
        facing: faceAfter(
          state.level,
          state.current,
          result.state,
          state.facing
        ),
        status: isSolved(state.level, result.state) ? 'won' : 'playing',
      };
    }
    case 'undo': {
      if (state.status !== 'playing') return state;
      const previous = state.history[state.history.length - 1];
      if (!previous) return state;
      return {
        ...state,
        current: previous,
        history: state.history.slice(0, -1),
        moves: state.moves.slice(0, -1),
        facing: faceAfter(state.level, state.current, previous, state.facing),
        bumped: [false, false, false],
        lastDir: null,
        feather: state.featherHistory[state.featherHistory.length - 1] ?? false,
        featherHistory: state.featherHistory.slice(0, -1),
      };
    }
    case 'restart':
      return { ...createGame(state.level), blocked: state.blocked };
  }
};
