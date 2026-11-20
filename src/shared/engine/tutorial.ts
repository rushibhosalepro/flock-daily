import type { Level } from './types.ts';

const SIZE = 5;
const at = (row: number, col: number): number => row * SIZE + col;

/**
 * A two-swipe board shown once to new players. Swiping right twice teaches the
 * two rules that matter: every bird moves together, and a wall stops a bird
 * while the others keep flying. Par comes from the solver.
 */
export const TUTORIAL: Level = {
  size: SIZE,
  starts: [at(1, 0), at(2, 0), at(3, 0)],
  nests: [at(1, 1), at(2, 2), at(3, 2)],
  walls: [at(1, 2)],
  kinds: ['normal', 'normal', 'normal'],
};

export const TUTORIAL_HINT = 'Swipe right. Every bird moves.';
