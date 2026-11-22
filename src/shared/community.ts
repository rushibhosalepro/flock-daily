/**
 * Text the app writes into the subreddit: player flair and the daily recap.
 * Pure functions, so the tests can check them without Reddit.
 */

export type FlairStyle = {
  text: string;
  /** Hex colour behind the flair text. */
  backgroundColor: string;
  textColor: 'dark' | 'light';
};

/** Streak lengths where the flair appears and then changes colour. */
export const STREAK_TIERS = [3, 7, 30] as const;

const STREAK_COLOURS: Record<(typeof STREAK_TIERS)[number], FlairStyle['backgroundColor']> = {
  3: '#ffd8a8',
  7: '#ff922b',
  30: '#e8590c',
};

/**
 * The flair a player has earned: their streak once it reaches 3 days, and how
 * many Crowns they have collected. Null when they have earned neither yet.
 */
export const flairFor = (streak: number, crowns: number): FlairStyle | null => {
  const tier = [...STREAK_TIERS].reverse().find((t) => streak >= t);
  const parts = [
    tier !== undefined ? `🔥 ${streak}-day streak` : null,
    crowns > 0 ? `👑 ${crowns}` : null,
  ].filter((part): part is string => part !== null);
  if (parts.length === 0) return null;
  if (tier === undefined) {
    return {
      text: `👑 ${crowns} ${crowns === 1 ? 'Crown' : 'Crowns'}`,
      backgroundColor: '#ffe27a',
      textColor: 'dark',
    };
  }
  return {
    text: parts.join(' · '),
    backgroundColor: STREAK_COLOURS[tier],
    textColor: tier === 30 ? 'light' : 'dark',
  };
};

export type RecapInput = {
  day: number;
  par: number;
  solved: number;
  atPar: number;
  crowned: number;
  /** Today's top solvers by first-solve moves, best first. */
  top: readonly { name: string; moves: number; crown: boolean }[];
};

/** Keeps underscores and asterisks in usernames from turning into Markdown. */
const plain = (name: string): string => name.replace(/([_*~^\\])/g, '\\$1');

/**
 * One line summing up a finished day, for the top of the next day's results
 * thread. Names are written without "u/" so the recap never pings anyone.
 * Null when nobody solved.
 */
export const recapText = (input: RecapInput): string | null => {
  if (input.solved === 0) return null;
  const stats = [
    `${input.solved} solved`,
    `${input.atPar} at par (${input.par} moves)`,
    input.crowned > 0 ? `👑 ${input.crowned} crowned` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');
  const leaders =
    input.top.length > 0
      ? ` Top solvers: ${input.top
          .map((row) => `**${plain(row.name)}** ${row.moves}${row.crown ? ' 👑' : ''}`)
          .join(', ')}.`
      : '';
  return `**Yesterday's Flock #${input.day}:** ${stats}.${leaders}`;
};
