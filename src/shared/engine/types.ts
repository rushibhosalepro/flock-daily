export type Dir = 'U' | 'D' | 'L' | 'R';

/** Birds are indexed 0 = red, 1 = blue, 2 = yellow. */
export type BirdIndex = 0 | 1 | 2;

/** A normal bird flies in the swiped direction. A contrary bird flies the opposite way. */
export type BirdKind = 'normal' | 'contrary';

export type Triple = readonly [number, number, number];

export type Level = {
  /** Board is size x size. Cells are indexed row * size + col. */
  size: number;
  walls: readonly number[];
  starts: Triple;
  nests: Triple;
  kinds: readonly [BirdKind, BirdKind, BirdKind];
  /**
   * Cell holding the golden feather, if the level has one. Any bird landing on it
   * collects it. Getting every bird home with the feather collected earns a Crown.
   */
  feather?: number;
};

/** Bird positions, one cell index per bird. */
export type State = Triple;

export type StepResult = {
  state: State;
  /** True when at least one bird changed cell. */
  changed: boolean;
};

export type SolveResult = {
  /** Fewest moves that solve the level. */
  par: number;
  /** One shortest solution. */
  path: Dir[];
  /** How many distinct shortest solutions exist. */
  optimalSolutions: number;
  /** Number of states reachable from the start. */
  reachable: number;
};

export type CrownResult = {
  /** Fewest moves that get every bird home with the feather collected. */
  crownPar: number;
  /** One shortest crown solution. */
  path: Dir[];
};

export const DIRS: readonly Dir[] = ['U', 'D', 'L', 'R'];

export const BIRD_NAMES = ['Red', 'Blue', 'Yellow'] as const;
