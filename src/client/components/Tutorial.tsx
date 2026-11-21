import { useCallback, useReducer } from 'react';
import { TUTORIAL, TUTORIAL_HINT } from '../../shared/engine/tutorial.ts';
import type { Dir } from '../../shared/engine/types.ts';
import { createGame, gameReducer } from '../hooks/useGame.ts';
import { useKeys, useSwipe } from '../hooks/useInput.ts';
import { useBoardSounds } from '../hooks/useBoardSounds.ts';
import { Board } from './Board.tsx';

type TutorialProps = {
  /** Today's puzzle has the twist bird, so mention it on the last step. */
  twist: boolean;
  /** Today's puzzle has a golden feather. */
  crown: boolean;
  onClose: () => void;
};

const ARROWS: ReadonlyArray<{ dir: Dir; glyph: string; label: string }> = [
  { dir: 'L', glyph: '←', label: 'Move left' },
  { dir: 'U', glyph: '↑', label: 'Move up' },
  { dir: 'D', glyph: '↓', label: 'Move down' },
  { dir: 'R', glyph: '→', label: 'Move right' },
];

/**
 * A two-swipe practice board. The player learns by doing: the first swipe moves
 * every bird, the second shows a wall stopping one bird while the others fly on.
 */
export const Tutorial = ({ twist, crown, onClose }: TutorialProps) => {
  const [state, dispatch] = useReducer(gameReducer, TUTORIAL, createGame);
  // Every tutorial finish gets the full tune.
  useBoardSounds(state, Number.POSITIVE_INFINITY, null);
  const done = state.status === 'won';

  const onMove = useCallback((dir: Dir) => dispatch({ type: 'move', dir }), []);
  const onUndo = useCallback(() => dispatch({ type: 'undo' }), []);
  useKeys({ onMove, onUndo, locked: done });
  const swipe = useSwipe(onMove, done);

  const redHome = state.current[0] === TUTORIAL.nests[0];
  const line = done
    ? 'The wall held red while the others flew. Everyone is home!'
    : state.moves.length === 0
      ? TUTORIAL_HINT
      : redHome
        ? 'Red is home. Swipe right again. The wall will hold red.'
        : 'Get each bird onto its own nest. Try swiping right.';

  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-label="How to play"
    >
      <div className="card tutorial">
        <div className="tutorial-head">
          <h2>How to play</h2>
          {done ? null : (
            <button type="button" className="link-btn" onClick={onClose}>
              Skip
            </button>
          )}
        </div>
        <p className="tutorial-line" aria-live="polite">
          {line}
        </p>
        <div className="tutorial-board">
          <Board
            level={state.level}
            state={state.current}
            facing={state.facing}
            blockedTick={state.blocked}
            won={done}
            {...swipe}
          />
        </div>
        {done ? (
          <>
            <p className="muted">
              Each day: get every bird home in as few moves as you can. Match
              par for a Perfect.
              {crown
                ? ' Bonus: land a bird on the golden feather for a 👑.'
                : ''}
              {twist ? ' Today the yellow bird flies the other way.' : ''}
            </p>
            <button type="button" className="btn primary" onClick={onClose}>
              Play today&apos;s puzzle
            </button>
          </>
        ) : (
          <div className="tutorial-arrows" role="group" aria-label="Directions">
            {ARROWS.map((arrow) => (
              <button
                key={arrow.dir}
                type="button"
                className={`arrow-btn${arrow.dir === 'R' ? ' nudge' : ''}`}
                aria-label={arrow.label}
                onClick={() => onMove(arrow.dir)}
              >
                {arrow.glyph}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
