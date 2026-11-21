import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  encodeChallenge,
  isCrown,
  resultText,
  solutionSpoiler,
  untilNextPuzzle,
} from '../../shared/engine/share.ts';
import type { Challenge } from '../../shared/engine/share.ts';
import type {
  Community,
  DayStats,
  Leaders,
  ResultInfo,
  StreakInfo,
} from '../../shared/api.ts';
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
    <span className="next-in">
      Next in <strong>{left}</strong>
    </span>
  );
};

/** Three bars of today's first solves: at par, 1 to 2 over, 3 or more over. */
const MoveChart = ({
  community,
  par,
  mine,
}: {
  community: Community;
  par: number;
  /** Which bar the player's own first solve falls in, if any. */
  mine: number | null;
}) => {
  const bars = [
    { key: 'par', label: `Par ${par}`, count: community.atPar },
    { key: 'near', label: `${par + 1}–${par + 2}`, count: community.near },
    { key: 'far', label: `${par + 3}+`, count: community.far },
  ];
  const total = bars.reduce((sum, b) => sum + b.count, 0);
  if (total === 0) return null;
  const myBar =
    mine === null ? -1 : mine <= par ? 0 : mine <= par + 2 ? 1 : 2;
  return (
    <div className="chart" aria-label="Today's first solves">
      {bars.map((bar, i) => {
        const pct = Math.round((bar.count / total) * 100);
        return (
          <div
            key={bar.key}
            className={`chart-col${i === myBar ? ' mine' : ''}`}
            title={`${bar.count} ${bar.count === 1 ? 'player' : 'players'}`}
          >
            <div className="chart-track">
              <div className="chart-fill" style={{ height: `${Math.max(pct, 4)}%` }} />
            </div>
            <span className="chart-pct">{pct}%</span>
            <span className="chart-label">{bar.label}</span>
          </div>
        );
      })}
    </div>
  );
};

/** Today's top three first solves, with the player's own place under them when they are lower. */
const TopSolvers = ({
  leaders,
  username,
  par,
}: {
  leaders: Leaders;
  username: string | null;
  par: number;
}) => {
  const mineShown = leaders.top.some((row) => row.name === username);
  return (
    <ol className="leaders" aria-label="Top solvers today">
      {leaders.top.map((row, i) => (
        <li
          key={row.name}
          className={`leader${row.name === username ? ' mine' : ''}`}
        >
          <span className="leader-rank">{i + 1}</span>
          <span className="leader-name">u/{row.name}</span>
          <span className={`leader-moves${row.moves <= par ? ' at-par' : ''}`}>
            {row.moves}
          </span>
          <span className="leader-crown">
            {row.crown ? <span aria-label="Crown">👑</span> : null}
          </span>
        </li>
      ))}
      {!mineShown && leaders.myRank !== null ? (
        <li className="leader mine you">
          You are #{leaders.myRank} of {leaders.total}
        </li>
      ) : null}
    </ol>
  );
};

export type CommentState = 'idle' | 'posting' | 'posted' | 'failed';
export type JoinState = 'idle' | 'joining' | 'joined' | 'hidden';

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
  /** The player's first solve, which is what the daily stats count. */
  first: ResultInfo | null;
  community: Community;
  leaders: Leaders;
  streak: StreakInfo;
  stats: DayStats;
  loggedIn: boolean;
  isToday: boolean;
  /** Puzzle number for the current UTC day. */
  today: number;
  saveError: boolean;
  username: string | null;
  /** A friend's score from the share link this post was opened with. */
  challenge: Challenge | null;
  comment: CommentState;
  join: JoinState;
  subredditName: string;
  /** Feathers drawn behind the card, so they never cover its text. */
  celebration: ReactNode;
  onClose: () => void;
  onWatch: () => void;
  onComment: () => void;
  /** Subscribes to the subreddit. Its own button, never combined with another action. */
  onJoin: () => void;
  /** Opens today's post. Null on today's post, or when its link is unknown. */
  onToday: (() => void) | null;
};

const HEADLINE: Record<ResultInfo['rating'], string> = {
  Perfect: 'Perfect!',
  Excellent: 'Excellent!',
  Good: 'Nicely done',
  Completed: 'Solved',
};

const COMMENT_LABEL: Record<CommentState, string> = {
  idle: '💬 Post to comments',
  posting: 'Posting…',
  posted: '✓ Posted to comments',
  failed: '💬 Try posting again',
};

export const ResultCard = ({
  day,
  result,
  best,
  bestCrown,
  crownPar,
  first,
  community,
  leaders,
  streak,
  stats,
  loggedIn,
  isToday,
  today,
  saveError,
  username,
  challenge,
  comment,
  join,
  subredditName,
  celebration,
  onClose,
  onWatch,
  onComment,
  onJoin,
  onToday,
}: ResultCardProps) => {
  const hasLeaders = leaders.top.length > 0;
  const [view, setView] = useState<'top' | 'spread'>('top');
  const sender = challenge?.by ? `u/${challenge.by}` : 'your friend';
  const share = resultText({
    day,
    moves: best.moves,
    par: best.par,
    streak: isToday ? streak.current : 0,
    crownPar,
    crownMoves: bestCrown?.moves ?? null,
  });
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
  // When the first solve differs, say so, so "Perfect" next to "0% hit par" never looks wrong.
  const showFirst =
    first !== null && (first.moves !== result.moves || first.moves !== best.moves);

  const communityLine = [
    `${stats.solved} solved`,
    community.beat !== null ? `better than ${community.beat}%` : null,
    crownPar !== null && stats.crowned > 0 ? `👑 ${stats.crowned} crowned` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const copyFallback = () =>
    void copyText(
      `${share}\n\nSolution: ${solutionSpoiler(best.moveList)}`,
      'Result copied. Paste it in the comments; the solution stays hidden as a spoiler.'
    );

  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Result"
    >
      {celebration}
      <div className="card result-card">
        <button
          type="button"
          className="close-btn"
          aria-label="Close and see the board"
          title="See the board"
          onClick={onClose}
        >
          ✕
        </button>
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
        {challenge ? (
          <p className="best-line">
            {best.moves < challenge.moves
              ? `You beat ${sender}!`
              : best.moves === challenge.moves
                ? `You tied ${sender}!`
                : `${sender} still leads with ${challenge.moves} moves.`}
          </p>
        ) : null}

        {stats.solved > 0 ? (
          <div className="community">
            {hasLeaders ? (
              <div className="tabs" role="tablist" aria-label="Today">
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'top'}
                  className={`tab${view === 'top' ? ' on' : ''}`}
                  onClick={() => setView('top')}
                >
                  🏆 Top solvers
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'spread'}
                  className={`tab${view === 'spread' ? ' on' : ''}`}
                  onClick={() => setView('spread')}
                >
                  📊 Spread
                </button>
              </div>
            ) : null}
            {hasLeaders && view === 'top' ? (
              <div className="view-top">
                <TopSolvers
                  leaders={leaders}
                  username={username}
                  par={result.par}
                />
              </div>
            ) : null}
            <div
              className={`view-spread${hasLeaders && view === 'top' ? ' off' : ''}`}
            >
              <MoveChart
                community={community}
                par={result.par}
                mine={first?.moves ?? null}
              />
            </div>
            <p className="muted">{communityLine}</p>
            {showFirst && first ? (
              <p className="muted first-line">
                Today&apos;s stats use your first solve: {first.moves} moves.
              </p>
            ) : null}
          </div>
        ) : null}

        {isToday ? (
          <p className="streak-line">
            {loggedIn && streak.current > 0 ? (
              <span>🔥 {streak.current} day streak</span>
            ) : null}
            <NextPuzzle />
          </p>
        ) : onToday ? (
          <button type="button" className="today-pill" onClick={onToday}>
            Old puzzle · Play today&apos;s Flock #{today} →
          </button>
        ) : (
          <p className="muted">
            Practice puzzle, so your streak is unchanged. Today&apos;s puzzle is
            Flock #{today}.
          </p>
        )}
        {saveError ? (
          <p className="muted">
            Could not save this result. Check your connection.
          </p>
        ) : null}

        <div className="preview" aria-label="What gets posted">
          {share.split('\n').map((line) => (
            <div key={line}>{line}</div>
          ))}
          <div className="preview-spoiler">
            Solution: <span>hidden as a spoiler</span>
          </div>
        </div>

        {loggedIn ? (
          <button
            type="button"
            className="btn primary"
            onClick={onComment}
            disabled={comment === 'posting' || comment === 'posted'}
          >
            {COMMENT_LABEL[comment]}
          </button>
        ) : (
          <button type="button" className="btn primary" onClick={copyFallback}>
            Copy result for the comments
          </button>
        )}
        {comment === 'failed' ? (
          <button
            type="button"
            className="link-btn solution-link"
            onClick={copyFallback}
          >
            Or copy it and paste it yourself
          </button>
        ) : null}
        <div className="row">
          <button
            type="button"
            className="btn"
            aria-label="Share a challenge link"
            onClick={() =>
              void shareResult(
                `Flock #${day}`,
                `${share}\nCan you beat it?`,
                encodeChallenge({ day, moves: best.moves, by: username })
              )
            }
          >
            <span className="lbl-long">Share challenge</span>
            <span className="lbl-short">Share</span>
          </button>
          <button
            type="button"
            className="btn"
            onClick={onWatch}
            aria-label="Watch my solve"
          >
            <span className="lbl-long">Watch my solve</span>
            <span className="lbl-short">Replay</span>
          </button>
        </div>
        {loggedIn && join !== 'hidden' ? (
          <button
            type="button"
            className="join-pill"
            onClick={onJoin}
            disabled={join !== 'idle'}
          >
            {join === 'joined' ? (
              `✓ Joined r/${subredditName}`
            ) : (
              <>
                🔔 Join r/{subredditName}
                <span className="lbl-long"> for tomorrow&apos;s puzzle</span>
              </>
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
};
