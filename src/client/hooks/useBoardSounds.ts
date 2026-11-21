import { useEffect, useRef } from 'react';
import type { GameState } from './useGame.ts';
import {
  playFeather,
  playFlap,
  playLand,
  playThud,
  playWin,
} from '../sound.ts';

const homeCount = (state: GameState): number =>
  [0, 1, 2].filter((i) => state.current[i] === state.level.nests[i]).length;

/**
 * Plays a sound for what just happened on the board, by comparing each state
 * with the one before: a flap for a move, a thud for a bump, a chirp for each
 * bird that reaches its nest, a sparkle for the feather and a tune for a solve.
 * Undo and restart make no sound.
 */
export const useBoardSounds = (
  state: GameState,
  par: number,
  crownPar: number | null
): void => {
  const last = useRef({
    moves: state.moves.length,
    blocked: state.blocked,
    home: homeCount(state),
    feather: state.feather,
  });
  useEffect(() => {
    const before = last.current;
    const home = homeCount(state);
    const moves = state.moves.length;
    if (moves === before.moves + 1) {
      playFlap();
      if (state.bumped.some(Boolean)) playThud(false);
      if (home > before.home) playLand(home);
      if (state.feather && !before.feather) playFeather();
      if (state.status === 'won') {
        playWin(
          moves <= par ||
            (state.feather && crownPar !== null && moves <= crownPar)
        );
      }
    } else if (state.blocked > before.blocked) {
      playThud(true);
    }
    last.current = { moves, blocked: state.blocked, home, feather: state.feather };
  }, [state, par, crownPar]);
};
