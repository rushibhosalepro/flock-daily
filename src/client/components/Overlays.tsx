import { useEffect, useState } from 'react';
import {
  encodeChallenge,
  isCrown,
  resultText,
  solutionSpoiler,
  untilNextPuzzle,
} from '../../shared/engine/share.ts';
import type { Challenge } from '../../shared/engine/share.ts';
import type { DayStats, ResultInfo, StreakInfo } from '../../shared/api.ts';
import { copyText } from '../clipboard.ts';
import { shareResult } from '../share.ts';

/** Live countdown to the next daily puzzle. Refreshes every 20 seconds. */
const NextPuzzle = () => {
  const [left, setLeft] = useState(() => untilNextPuzzle(new Date()));
  useEffect(() => {
    const id = setInterval(() => setLeft(untilNextPuzzle(new Date())), 20_000);
    return () => clearInterval(id);
  }, []);
  return (
    <p className="next-puzzle" aria-live="off">
      Next puzzle in <strong>{left}</strong>
    </p>
  );
};

type ResultCardProps = {
  day: number;
  /** The round just played, or the best solve when the card opens on load. */
  result: ResultInfo;
  /** The player's best solve. Sharing always uses this. */
  best: ResultInfo;
  /** The player's best solve that collected the feather, if any. */
  bestCrown: ResultInfo | null;
  /** Crown par for the day, or null when the day has no feather. */
  crownPar: number | null;
  streak: StreakInfo;
  stats: DayStats;
  recorded: boolean;
  loggedIn: boolean;
  isToday: boolean;
  /** Puzzle number for the current UTC day. */
  today: number;
  saveError: boolean;
  username: string | null;
  /** A friend's score from the share link this post was opened with. */
  challenge: Challenge | null;
  onClose: () => void;
  onReplay: () => void;
  onWatch: () => void;
  /** Opens today's post. Null on today's post, or when its link is unknown. */
  onToday: (() => void) | null;
};

const HEADLINE: Record<ResultInfo['rating'], string> = {
  Perfect: 'Perfect!',
  Excellent: 'Excellent!',
  Good: 'Nicely done',
  Completed: 'Solved',
};

export const ResultCard = ({
  day,
  result,
  best,
  bestCrown,
  crownPar,
  streak,
  stats,
  recorded,
  loggedIn,
  isToday,
  today,
  saveError,
  username,
  challenge,
  onClose,
  onReplay,
  onWatch,
  onToday,
}: ResultCardProps) => {
  const sender = challenge?.by ? `u/${challenge.by}` : 'your friend';
  const share = resultText({
    day,
    moves: best.moves,
    par: best.par,
    streak: isToday ? streak.current : 0,
    crownPar,
    crownMoves: bestCrown?.moves ?? null,
  });
  const atParPct =
    stats.solved > 0 ? Math.round((stats.atPar / stats.solved) * 100) : 0;
  const roundCrown =
    crownPar !== null && result.feather && isCrown(result.moves, crownPar);
  const bestIsCrown =
    crownPar !== null &&
    bestCrown !== null &&
    isCrown(bestCrown.moves, crownPar);
  const crownLine =
    crownPar === null
      ? null
      : roundCrown
        ? `👑 Crown! The feather and every bird home in ${result.moves}.`
        : bestIsCrown && bestCrown
          ? `👑 Crown earned in ${bestCrown.moves}.`
          : bestCrown
            ? `🪶 Feather in ${bestCrown.moves}. Crown par is ${crownPar}.`
            : `🪶 Bonus: grab the golden feather and finish in ${crownPar} for a Crown.`;
  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Result"
    >
      <div className="card">
        <h2>{roundCrown ? 'Crowned! 👑' : HEADLINE[result.rating]}</h2>
        <div className="big">
          {result.moves} {result.moves === 1 ? 'move' : 'moves'} · Par{' '}
          {result.par}
        </div>
        {best.moves < result.moves ? (
          <p className="best-line">
            Your best: {best.moves} moves · {best.rating}
          </p>
        ) : null}
        {crownLine ? (
          <p className={`crown-line${roundCrown || bestIsCrown ? ' won' : ''}`}>
            {crownLine}
          </p>
        ) : null}
        {isToday && loggedIn && streak.current > 0 ? (
          <p>
            🔥 {streak.current} day streak
            <span className="muted"> · best {streak.best}</span>
          </p>
        ) : null}
        {isToday ? (
          <NextPuzzle />
        ) : onToday ? (
          <button type="button" className="btn primary" onClick={onToday}>
            Play today&apos;s puzzle: Flock #{today} →
          </button>
        ) : (
          <p className="muted">
            Practice puzzle, so your streak is unchanged. Today&apos;s puzzle is
            Flock #{today}.
          </p>
        )}
        {!loggedIn ? (
          <p className="muted">Log in to Reddit to keep a streak.</p>
        ) : null}
        {saveError ? (
          <p className="muted">
            Could not save this result. Check your connection.
          </p>
        ) : null}
        {stats.solved > 0 ? (
          <p className="muted">
            {stats.solved} {stats.solved === 1 ? 'player has' : 'players have'}{' '}
            solved this one · {atParPct}% hit par
            {crownPar !== null && stats.crowned > 0
              ? ` · ${stats.crowned} crowned`
              : ''}
          </p>
        ) : null}
        {recorded || !loggedIn || saveError ? null : (
          <p className="muted">
            Daily stats count each player&apos;s first solve.
          </p>
        )}
        {challenge ? (
          <p className="best-line">
            {best.moves < challenge.moves
              ? `You beat ${sender}!`
              : best.moves === challenge.moves
                ? `You tied ${sender}!`
                : `${sender} still leads with ${challenge.moves} moves.`}
          </p>
        ) : null}
        <div className="row">
          <button
            type="button"
            className="btn primary"
            onClick={() =>
              void shareResult(
                `Flock #${day}`,
                `${share}\nCan you beat it?`,
                encodeChallenge({ day, moves: best.moves, by: username })
              )
            }
          >
            Share
          </button>
          <button type="button" className="btn" onClick={onWatch}>
            Watch my solve
          </button>
        </div>
        <button
          type="button"
          className="link-btn solution-link"
          onClick={() =>
            void copyText(
              solutionSpoiler(best.moveList),
              'Solution copied. Paste it in the comments; it stays hidden as a spoiler.'
            )
          }
        >
          Copy solution for the comments
        </button>
        <div className="row">
          <button type="button" className="btn" onClick={onReplay}>
            Play again
          </button>
          <button type="button" className="btn" onClick={onClose}>
            See board
          </button>
        </div>
      </div>
    </div>
  );
};
