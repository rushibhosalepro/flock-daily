import './index.css';
import {
  StrictMode,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import type { CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import { parseChallenge, ratingFor } from '../shared/engine/share.ts';
import type { Dir } from '../shared/engine/types.ts';
import type { GameState } from './hooks/useGame.ts';
import { Celebrate } from './components/Celebrate.tsx';
import { readShareData } from './share.ts';
import { navigateTo, showToast } from '@devvit/web/client';
import type {
  Community,
  Leaders,
  DayStats,
  InitResponse,
  ResultInfo,
  StreakInfo,
} from '../shared/api.ts';
import {
  fetchInit,
  markTutorialDone,
  joinSubreddit,
  postComment,
  submitMoves,
} from './api.ts';
import { Board } from './components/Board.tsx';
import { ArrowIcon, RestartIcon, UndoIcon } from './components/Icons.tsx';
import { BIRD_COLORS } from './constants.ts';
import { ResultCard } from './components/Overlays.tsx';
import type { CommentState, JoinState } from './components/Overlays.tsx';
import { Tutorial } from './components/Tutorial.tsx';
import { createGame, gameReducer } from './hooks/useGame.ts';
import { useKeys, useSwipe } from './hooks/useInput.ts';

const HELP_KEY = 'flock-howto-seen';

const hasSeenHelp = (): boolean => {
  try {
    return localStorage.getItem(HELP_KEY) === '1';
  } catch {
    return false;
  }
};

const markHelpSeen = (): void => {
  try {
    localStorage.setItem(HELP_KEY, '1');
  } catch {
    // Storage can be blocked inside the webview. The overlay then shows again, which is harmless.
  }
};

type CardData = {
  /** The round just played, or the best solve when the card opens on load. */
  result: ResultInfo;
  best: ResultInfo;
  bestCrown: ResultInfo | null;
  first: ResultInfo | null;
  community: Community;
  leaders: Leaders;
  streak: StreakInfo;
  stats: DayStats;
  saveError: boolean;
};

const ARROWS: ReadonlyArray<{
  dir: Dir;
  glyph: string;
  label: string;
  cls: string;
}> = [
  { dir: 'L', glyph: '←', label: 'Move left', cls: 'left' },
  { dir: 'U', glyph: '↑', label: 'Move up', cls: 'up' },
  { dir: 'D', glyph: '↓', label: 'Move down', cls: 'down' },
  { dir: 'R', glyph: '→', label: 'Move right', cls: 'right' },
];

/** Gives a pip its bird color through a CSS variable. */
const pipStyle = (color: string): CSSProperties => {
  const vars: Record<string, string> = { '--pip': color };
  return vars;
};

const REPLAY_STEP_MS = 420;
const REPLAY_END_MS = 900;

/** Every board state of a solve, from the start, using the same reducer as live play. */
const framesFor = (
  level: GameState['level'],
  moves: readonly Dir[]
): GameState[] => {
  const frames: GameState[] = [createGame(level)];
  for (const dir of moves) {
    const last = frames[frames.length - 1] ?? createGame(level);
    frames.push(gameReducer(last, { type: 'move', dir }));
  }
  return frames;
};

const pause = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const Game = ({ init }: { init: InitResponse }) => {
  const { puzzle } = init;
  const [state, dispatch] = useReducer(gameReducer, puzzle.level, createGame);
  // The tutorial opens once per player. Redis remembers it for logged-in players;
  // localStorage covers logged-out visitors.
  const [helpOpen, setHelpOpen] = useState(
    () => !init.tutorialDone && !hasSeenHelp()
  );
  const [best, setBest] = useState<ResultInfo | null>(init.best);
  const [bestCrown, setBestCrown] = useState<ResultInfo | null>(init.bestCrown);
  // Latest bests, read by the solve handler without re-running it.
  const bests = useRef<{ best: ResultInfo | null; crown: ResultInfo | null }>({
    best: init.best,
    crown: init.bestCrown,
  });
  const featherRun = state.feather;
  const [card, setCard] = useState<CardData | null>(() =>
    init.best
      ? {
          result: init.best,
          best: init.best,
          bestCrown: init.bestCrown,
          first: init.first,
          community: init.community,
          leaders: init.leaders,
          streak: init.streak,
          stats: init.stats,
          saveError: false,
        }
      : null
  );
  const [cardOpen, setCardOpen] = useState(init.best !== null);
  const [burst, setBurst] = useState(0);
  const [comment, setComment] = useState<CommentState>(
    init.commented ? 'posted' : 'idle'
  );
  const sendComment = async () => {
    setComment('posting');
    try {
      const response = await postComment();
      setComment('posted');
      showToast(
        response.outcome === 'posted'
          ? 'Posted to the comments'
          : 'You already posted your result here'
      );
    } catch {
      setComment('failed');
      showToast('Could not post the comment. You can copy it instead.');
    }
  };
  // Players who joined before never see the button again; a fresh join shows a check.
  const [join, setJoin] = useState<JoinState>(init.joined ? 'hidden' : 'idle');
  const sendJoin = async () => {
    setJoin('joining');
    try {
      await joinSubreddit();
      setJoin('joined');
      showToast(`Joined r/${init.subredditName}`);
    } catch {
      setJoin('idle');
      showToast('Could not join right now');
    }
  };
  const [replay, setReplay] = useState<{
    frames: GameState[];
    index: number;
  } | null>(null);
  // A friend's score, from the share link this post was opened with.
  const challenge = useMemo(() => {
    const c = parseChallenge(readShareData());
    return c && c.day === puzzle.day ? c : null;
  }, [puzzle.day]);

  const startReplay = useCallback(() => {
    const moves = card?.best.moveList ?? best?.moveList;
    if (!moves || moves.length === 0) return;
    setCardOpen(false);
    setReplay({ frames: framesFor(puzzle.level, moves), index: 0 });
  }, [card, best, puzzle.level]);

  const stopReplay = useCallback(() => {
    setReplay(null);
    setCardOpen(true);
  }, []);

  // Advance the replay one move at a time, then reopen the card.
  useEffect(() => {
    if (!replay) return;
    const last = replay.index >= replay.frames.length - 1;
    const id = setTimeout(
      () => {
        if (last) stopReplay();
        else setReplay({ ...replay, index: replay.index + 1 });
      },
      last ? REPLAY_END_MS : REPLAY_STEP_MS
    );
    return () => clearTimeout(id);
  }, [replay, stopReplay]);

  const onMove = useCallback((dir: Dir) => {
    dispatch({ type: 'move', dir });
  }, []);
  const onUndo = useCallback(() => {
    dispatch({ type: 'undo' });
  }, []);

  const locked =
    helpOpen || cardOpen || replay !== null || state.status === 'won';
  useKeys({ onMove, onUndo, locked });
  const swipe = useSwipe(onMove, locked);

  // When the puzzle is solved, let the last flight finish, then ask the server to record it.
  useEffect(() => {
    if (state.status !== 'won') return;
    let cancelled = false;
    const moves = state.moves;
    const run = async () => {
      const [outcome] = await Promise.all([
        submitMoves(moves).then(
          (response) => response,
          () => null
        ),
        pause(650),
      ]);
      if (cancelled) return;
      if (outcome) {
        bests.current = { best: outcome.best, crown: outcome.bestCrown };
        setBest(outcome.best);
        setBestCrown(outcome.bestCrown);
        setCard({
          result: outcome.result,
          best: outcome.best,
          bestCrown: outcome.bestCrown,
          first: outcome.first,
          community: outcome.community,
          leaders: outcome.leaders,
          streak: outcome.streak,
          stats: outcome.stats,
          saveError: false,
        });
      } else {
        // Offline: keep the best of what this browser has seen.
        const round: ResultInfo = {
          moves: moves.length,
          par: puzzle.par,
          rating: ratingFor(moves.length, puzzle.par),
          moveList: moves,
          feather: featherRun,
        };
        const prev = bests.current;
        const nextBest =
          prev.best && prev.best.moves <= round.moves ? prev.best : round;
        const nextCrown =
          !round.feather || puzzle.crownPar === null
            ? prev.crown
            : prev.crown && prev.crown.moves <= round.moves
              ? prev.crown
              : round;
        bests.current = { best: nextBest, crown: nextCrown };
        setBest(nextBest);
        setBestCrown(nextCrown);
        setCard({
          result: round,
          best: nextBest,
          bestCrown: nextCrown,
          first: init.first,
          community: init.community,
          leaders: init.leaders,
          streak: init.streak,
          stats: init.stats,
          saveError: true,
        });
      }
      setCardOpen(true);
      setBurst((n) => n + 1);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [
    state.status,
    state.moves,
    featherRun,
    puzzle.par,
    puzzle.crownPar,
    init.streak,
    init.stats,
    init.first,
    init.community,
    init.leaders,
  ]);

  const closeHelp = () => {
    markHelpSeen();
    if (!init.tutorialDone) void markTutorialDone();
    setHelpOpen(false);
  };

  // While a replay runs, the board and move counter show the replay instead of live play.
  const frame = replay ? (replay.frames[replay.index] ?? state) : state;
  const moves = frame.moves.length;
  const over = moves > puzzle.par;
  const showChallenge =
    challenge !== null && best === null && state.status !== 'won';
  const sender = challenge?.by ? `u/${challenge.by}` : 'A friend';
  const todayUrl = init.isToday ? null : init.todayUrl;
  const goToday = () => {
    if (!todayUrl) return;
    try {
      navigateTo(todayUrl);
    } catch {
      showToast(`Find Flock #${init.today} in the subreddit's newest posts.`);
    }
  };
  const hasBanner =
    replay !== null || todayUrl !== null || showChallenge || puzzle.twist;
  const homeFlags = [0, 1, 2].map(
    (i) => frame.current[i] === puzzle.level.nests[i]
  );
  const homeCount = homeFlags.filter(Boolean).length;
  const crowned =
    puzzle.crownPar !== null &&
    bestCrown !== null &&
    bestCrown.moves <= puzzle.crownPar;
  const status =
    state.status === 'won'
      ? `Solved in ${moves} moves. Par is ${puzzle.par}.`
      : `${moves} moves. Par is ${puzzle.par}.`;

  return (
    <main className="app">
      <div className={`stage${hasBanner ? ' has-twist' : ''}`}>
        <header className="topbar">
          <div className="title">
            Flock #{puzzle.day}
            <span className={`pill${puzzle.twist ? ' twist' : ''}`}>
              {init.isToday ? puzzle.label : 'Practice'}
            </span>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="How to play"
            onClick={() => setHelpOpen(true)}
          >
            ?
          </button>
        </header>

        {replay ? (
          <div className="replay-bar" aria-live="polite">
            <span>
              Your solve · move {replay.index} of {replay.frames.length - 1}
            </span>
            <button type="button" className="btn" onClick={stopReplay}>
              Skip
            </button>
          </div>
        ) : todayUrl ? (
          <div className="replay-bar today-bar">
            <span>
              <span className="today-long">
                Old puzzle. Today is Flock #{init.today}.
              </span>
              <span className="today-short">Older puzzle</span>
            </span>
            <button type="button" className="btn primary" onClick={goToday}>
              Play #{init.today} →
            </button>
          </div>
        ) : showChallenge && challenge ? (
          <div className="twist-banner challenge-banner">
            {sender} did this in {challenge.moves} moves. Can you match it?
          </div>
        ) : puzzle.twist ? (
          <div className="twist-banner">
            Twist: the yellow bird flies the other way ⇄
          </div>
        ) : null}

        <div className="hud">
          <div
            className="home-count"
            aria-label={`${homeCount} of 3 birds home`}
          >
            <span className="pips" aria-hidden="true">
              {BIRD_COLORS.map((color, i) => (
                <span
                  key={color}
                  className={`pip${homeFlags[i] ? ' on' : ''}`}
                  style={pipStyle(color)}
                />
              ))}
            </span>
            {moves === 0 && homeCount === 0 ? (
              <span className="home-text goal-long">
                Get each bird to its nest
              </span>
            ) : null}
            <span
              className={`home-text${moves === 0 && homeCount === 0 ? ' goal-short' : ''}`}
            >
              {homeCount}/3<span className="home-word"> home</span>
            </span>
          </div>
          <div className="hud-stats">
            <span className={`stat${over ? ' over' : ''}`}>
              <span className="k">Moves</span>
              <b className="v">{moves}</b>
            </span>
            <span className="stat">
              <span className="k">Par</span>
              <b className="v">{puzzle.par}</b>
            </span>
            <span
              className={`stat best${best && best.moves <= puzzle.par ? ' at-par' : ''}`}
            >
              <span className="k">Best</span>
              <b className="v">{best ? best.moves : '–'}</b>
            </span>
            {puzzle.crownPar !== null ? (
              <span
                className={`stat crown${frame.feather ? ' got' : ''}${crowned ? ' done' : ''}`}
                title={`Crown: every bird home with the golden feather in ${puzzle.crownPar} moves`}
              >
                <span className="k">
                  <span aria-hidden="true">👑 </span>Crown
                </span>
                <b className="v">
                  {puzzle.crownPar}
                  {crowned ? <span className="crown-check"> ✓</span> : null}
                </b>
              </span>
            ) : null}
          </div>
        </div>

        <div className="board-wrap">
          <Board
            level={puzzle.level}
            state={frame.current}
            facing={frame.facing}
            blockedTick={replay ? 0 : state.blocked}
            won={frame.status === 'won'}
            bumped={frame.bumped}
            swipes={frame.swipes}
            lastDir={frame.lastDir}
            featherTaken={frame.feather}
            {...swipe}
          />
        </div>

        {state.status === 'won' ? (
          // After a solve the arrows do nothing, so the row offers the two useful actions.
          <div className="controls done">
            <button
              type="button"
              className="ctl wide result"
              onClick={() => setCardOpen(true)}
              disabled={replay !== null || card === null}
            >
              See result
            </button>
            <button
              type="button"
              className="ctl wide-alt restart"
              onClick={() => {
                setCardOpen(false);
                dispatch({ type: 'restart' });
              }}
              disabled={replay !== null}
            >
              <RestartIcon />
              <span>Play again</span>
            </button>
          </div>
        ) : (
          <div className="controls">
            <button
              type="button"
              className="ctl undo"
              aria-label="Undo"
              title="Undo"
              onClick={onUndo}
              disabled={state.history.length === 0 || locked}
            >
              <UndoIcon />
            </button>
            <div className="dpad" role="group" aria-label="Directions">
              {ARROWS.map((arrow) => (
                <button
                  key={arrow.dir}
                  type="button"
                  className={`ctl arrow ${arrow.cls}`}
                  aria-label={arrow.label}
                  disabled={locked}
                  onClick={() => onMove(arrow.dir)}
                >
                  <ArrowIcon dir={arrow.dir} />
                </button>
              ))}
            </div>
            <button
              type="button"
              className="ctl restart"
              aria-label="Restart"
              title="Restart"
              onClick={() => dispatch({ type: 'restart' })}
              disabled={moves === 0 || locked}
            >
              <RestartIcon />
            </button>
          </div>
        )}
      </div>

      <div className="sr-only" aria-live="polite">
        {status}
      </div>

      {helpOpen ? (
        <Tutorial
          twist={puzzle.twist}
          crown={puzzle.crownPar !== null}
          onClose={closeHelp}
        />
      ) : null}
      {cardOpen && card && !helpOpen ? (
        <ResultCard
          day={puzzle.day}
          result={card.result}
          best={card.best}
          bestCrown={card.bestCrown}
          crownPar={puzzle.crownPar}
          streak={card.streak}
          stats={card.stats}
          first={card.first}
          community={card.community}
          leaders={card.leaders}
          loggedIn={init.username !== null}
          isToday={init.isToday}
          today={init.today}
          saveError={card.saveError}
          username={init.username}
          challenge={challenge}
          comment={comment}
          join={join}
          subredditName={init.subredditName}
          celebration={
            <Celebrate
              burst={burst}
              big={
                card.result.rating === 'Perfect' ||
                (card.result.feather &&
                  puzzle.crownPar !== null &&
                  card.result.moves <= puzzle.crownPar)
              }
            />
          }
          onClose={() => setCardOpen(false)}
          onWatch={startReplay}
          onComment={() => void sendComment()}
          onJoin={() => void sendJoin()}
          onToday={todayUrl ? goToday : null}
        />
      ) : null}
    </main>
  );
};

const App = () => {
  const [init, setInit] = useState<InitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchInit().then(
      (data) => {
        if (!cancelled) setInit(data);
      },
      (err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Something went wrong');
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <div className="loading">{error}</div>;
  if (!init) return <div className="loading">Loading today's flock…</div>;
  return <Game init={init} />;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
