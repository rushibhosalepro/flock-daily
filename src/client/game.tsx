import './index.css';
import {
  StrictMode,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react';
import { createRoot } from 'react-dom/client';
import { parseChallenge, ratingFor } from '../shared/engine/share.ts';
import type { Dir } from '../shared/engine/types.ts';
import type { GameState } from './hooks/useGame.ts';
import { Celebrate } from './components/Celebrate.tsx';
import { readShareData } from './share.ts';
import { navigateTo, showToast } from '@devvit/web/client';
import type {
  DayStats,
  InitResponse,
  ResultInfo,
  StreakInfo,
} from '../shared/api.ts';
import { fetchInit, markTutorialDone, submitMoves } from './api.ts';
import { Board } from './components/Board.tsx';
import { ResultCard } from './components/Overlays.tsx';
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
  streak: StreakInfo;
  stats: DayStats;
  recorded: boolean;
  saveError: boolean;
};

const ARROWS: ReadonlyArray<{
  dir: Dir;
  glyph: string;
  label: string;
  cls: string;
}> = [
  { dir: 'U', glyph: '↑', label: 'Move up', cls: 'up' },
  { dir: 'L', glyph: '←', label: 'Move left', cls: 'left' },
  { dir: 'D', glyph: '↓', label: 'Move down', cls: 'down' },
  { dir: 'R', glyph: '→', label: 'Move right', cls: 'right' },
];

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
  const [card, setCard] = useState<CardData | null>(() =>
    init.best
      ? {
          result: init.best,
          best: init.best,
          streak: init.streak,
          stats: init.stats,
          recorded: true,
          saveError: false,
        }
      : null
  );
  const [cardOpen, setCardOpen] = useState(init.best !== null);
  const [burst, setBurst] = useState(0);
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
        setBest(outcome.best);
        setCard({
          result: outcome.result,
          best: outcome.best,
          streak: outcome.streak,
          stats: outcome.stats,
          recorded: outcome.recorded,
          saveError: false,
        });
      } else {
        // Offline: keep the best of what this browser has seen.
        const round: ResultInfo = {
          moves: moves.length,
          par: puzzle.par,
          rating: ratingFor(moves.length, puzzle.par),
          moveList: moves,
        };
        setBest((prev) => {
          const next = prev && prev.moves <= round.moves ? prev : round;
          setCard({
            result: round,
            best: next,
            streak: init.streak,
            stats: init.stats,
            recorded: false,
            saveError: true,
          });
          return next;
        });
      }
      setCardOpen(true);
      setBurst((n) => n + 1);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [state.status, state.moves, puzzle.par, init.streak, init.stats]);

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
            <span>Old puzzle. Today is Flock #{init.today}.</span>
            <button type="button" className="btn primary" onClick={goToday}>
              Play today →
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

        <div className="scoreline">
          <div className={`score${over ? ' over' : ''}`}>
            <div className="label">Moves</div>
            <div className="value">{moves}</div>
          </div>
          <div className="score">
            <div className="label">Par</div>
            <div className="value">{puzzle.par}</div>
          </div>
          <div
            className={`score best${best && best.moves <= puzzle.par ? ' at-par' : ''}`}
          >
            <div className="label">Best</div>
            <div className="value">{best ? best.moves : '–'}</div>
          </div>
        </div>

        <div className="board-wrap">
          <Board
            level={puzzle.level}
            state={frame.current}
            facing={frame.facing}
            blockedTick={replay ? 0 : state.blocked}
            won={frame.status === 'won'}
            {...swipe}
          />
        </div>

        <div className="controls">
          <div className="dpad" role="group" aria-label="Directions">
            {ARROWS.map((arrow) => (
              <button
                key={arrow.dir}
                type="button"
                className={arrow.cls}
                aria-label={arrow.label}
                disabled={locked && state.status === 'won'}
                onClick={() => onMove(arrow.dir)}
              >
                {arrow.glyph}
              </button>
            ))}
          </div>
          <div className="side-actions">
            <button
              type="button"
              className="btn"
              onClick={onUndo}
              disabled={state.history.length === 0 || state.status === 'won'}
            >
              Undo
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => dispatch({ type: 'restart' })}
              disabled={moves === 0}
            >
              Restart
            </button>
          </div>
        </div>
      </div>

      <div className="sr-only" aria-live="polite">
        {status}
      </div>

      {helpOpen ? <Tutorial twist={puzzle.twist} onClose={closeHelp} /> : null}
      {cardOpen && card && !helpOpen ? (
        <ResultCard
          day={puzzle.day}
          result={card.result}
          best={card.best}
          streak={card.streak}
          stats={card.stats}
          recorded={card.recorded}
          loggedIn={init.username !== null}
          isToday={init.isToday}
          today={init.today}
          saveError={card.saveError}
          username={init.username}
          challenge={challenge}
          onClose={() => setCardOpen(false)}
          onReplay={() => {
            setCardOpen(false);
            dispatch({ type: 'restart' });
          }}
          onWatch={startReplay}
          onToday={todayUrl ? goToday : null}
        />
      ) : null}
      <Celebrate burst={burst} big={card?.result.rating === 'Perfect'} />
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
