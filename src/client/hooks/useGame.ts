import { isSolved, step } from '../../shared/engine/step.ts';
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
  status: 'playing',
});

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
        return { ...state, blocked: state.blocked + 1 };
      }
      return {
        ...state,
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
      };
    }
    case 'restart':
      return { ...createGame(state.level), blocked: state.blocked };
  }
};
