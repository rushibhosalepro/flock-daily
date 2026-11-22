import type { BirdKind, Dir } from './types.ts';

export type Rating = 'Perfect' | 'Excellent' | 'Good' | 'Completed';

export const ratingFor = (moves: number, par: number): Rating => {
  const over = moves - par;
  if (over <= 0) return 'Perfect';
  if (over === 1) return 'Excellent';
  if (over === 2) return 'Good';
  return 'Completed';
};

const ARROW: Record<Dir, string> = { U: '↑', D: '↓', L: '←', R: '→' };

export const arrows = (moves: readonly Dir[]): string =>
  moves.map((m) => ARROW[m]).join('');

/** A Crown solve: every bird home with the feather, in no more than Crown par moves. */
export const isCrown = (moves: number, crownPar: number): boolean =>
  moves <= crownPar;

const BIRD_WORDS = ['red', 'blue', 'yellow'] as const;

/**
 * Which birds fly the other way, as a phrase: "the yellow bird flies the other
 * way" or "the red and blue birds fly the other way". Null when none do.
 */
export const twistPhrase = (kinds: readonly BirdKind[]): string | null => {
  const names = BIRD_WORDS.filter((_, i) => kinds[i] === 'contrary');
  if (names.length === 0) return null;
  return names.length === 1
    ? `the ${names[0]} bird flies the other way`
    : `the ${names.join(' and ')} birds fly the other way`;
};

/** The puzzle's name: "Flock #12", or "Community Flock by u/name" for a Studio board. */
export const puzzleTitle = (day: number, by: string | null): string =>
  by === null ? `Flock #${day}` : `Community Flock by u/${by}`;

/** Spoiler-free result line. It never contains the move sequence. */
export const resultText = (args: {
  day: number;
  /** Replaces "Flock #day", for Studio boards. */
  title?: string;
  moves: number;
  par: number;
  streak: number;
  /** Crown par for the day, or null when the day has no feather. */
  crownPar?: number | null;
  /** Fewest moves of a solve that collected the feather, or null if none yet. */
  crownMoves?: number | null;
}): string => {
  const rating = ratingFor(args.moves, args.par);
  const lines = [
    `${args.title ?? `Flock #${args.day}`} 🐦`,
    `🟥🟦🟨 in ${args.moves} moves (Par ${args.par}) · ${rating}`,
  ];
  const crownPar = args.crownPar ?? null;
  const crownMoves = args.crownMoves ?? null;
  if (crownPar !== null) {
    if (crownMoves !== null && isCrown(crownMoves, crownPar)) {
      lines.push(`👑 Crown in ${crownMoves} (Crown par ${crownPar})`);
    } else if (crownMoves !== null) {
      lines.push(`🪶 Feather in ${crownMoves} (Crown par ${crownPar})`);
    } else {
      lines.push(`🪶 Crown par ${crownPar}: not yet`);
    }
  }
  if (args.streak > 1) lines.push(`🔥 ${args.streak} day streak`);
  return lines.join('\n');
};

/** Time left until the next UTC midnight, when the next daily puzzle is posted. For example "6h 12m" or "45m". */
export const untilNextPuzzle = (now: Date): string => {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1
  );
  const minutes = Math.max(1, Math.ceil((next - now.getTime()) / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

/** A score sent to a friend inside a share link. It never holds the moves, so it cannot spoil the puzzle. */
export type Challenge = {
  day: number;
  moves: number;
  /** Reddit username of the sender, or null when they were logged out. */
  by: string | null;
};

const USERNAME = /^[A-Za-z0-9_-]{1,30}$/;

export const encodeChallenge = (c: Challenge): string =>
  JSON.stringify({ v: 1, d: c.day, m: c.moves, b: c.by });

/**
 * Reads a challenge from share-link data. The data comes from whoever made the link,
 * so anything malformed returns null.
 */
export const parseChallenge = (text: string | undefined): Challenge | null => {
  if (!text || text.length > 200) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const v = Reflect.get(raw, 'v');
  const d = Reflect.get(raw, 'd');
  const m = Reflect.get(raw, 'm');
  const b = Reflect.get(raw, 'b');
  if (v !== 1) return null;
  if (typeof d !== 'number' || !Number.isInteger(d) || d < 1) return null;
  if (typeof m !== 'number' || !Number.isInteger(m) || m < 1 || m > 200) {
    return null;
  }
  const by = typeof b === 'string' && USERNAME.test(b) ? b : null;
  if (b !== null && by === null) return null;
  return { day: d, moves: m, by };
};

/**
 * The comment a player posts to the thread: the spoiler-free result, then the
 * solution hidden behind Reddit spoiler tags. Lines end in two spaces, which is
 * how Reddit markdown makes a line break.
 */
export const commentText = (
  args: Parameters<typeof resultText>[0] & { solution: readonly Dir[] }
): string => {
  const lines = resultText(args).split('\n');
  lines.push('', `Solution: ${solutionSpoiler(args.solution)}`);
  return lines.join('  \n');
};

/** The solution wrapped in Reddit spoiler markup, for pasting into a comment. */
export const solutionSpoiler = (moves: readonly Dir[]): string =>
  `>!${arrows(moves)}!<`;
