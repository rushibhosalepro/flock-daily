import type { CSSProperties, PointerEventHandler, Ref } from 'react';
import { BIRDS } from '../../shared/engine/step.ts';
import type { Level, State } from '../../shared/engine/types.ts';
import { BIRD_LABELS } from '../constants.ts';
import { BirdArt, NestArt, WallArt } from './Art.tsx';

type Facing = readonly [boolean, boolean, boolean];

type BoardProps = {
  level: Level;
  state: State;
  /** True per bird when it last flew left. */
  facing?: Facing;
  /** Increases by one each time a swipe is blocked. */
  blockedTick?: number;
  won?: boolean;
  boardRef?: Ref<HTMLDivElement>;
  onPointerDown?: PointerEventHandler<HTMLDivElement>;
  onPointerUp?: PointerEventHandler<HTMLDivElement>;
  onPointerCancel?: PointerEventHandler<HTMLDivElement>;
};

const pos = (cell: number, size: number): CSSProperties => {
  const vars: Record<string, number> = {
    '--r': Math.floor(cell / size),
    '--c': cell % size,
  };
  return vars;
};

const NO_FACING: Facing = [false, false, false];

export const Board = ({
  level,
  state,
  facing = NO_FACING,
  blockedTick = 0,
  won = false,
  boardRef,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
}: BoardProps) => {
  const { size } = level;
  const cells: number[] = [];
  for (let i = 0; i < size * size; i++) cells.push(i);

  // Two identical keyframes alternate so every blocked swipe replays the shake.
  const shakeStyle: CSSProperties =
    blockedTick > 0
      ? {
          animationName: blockedTick % 2 === 0 ? 'shake-a' : 'shake-b',
          animationDuration: '150ms',
        }
      : {};

  return (
    <div
      ref={boardRef}
      className={`board${won ? ' won' : ''}`}
      style={shakeStyle}
      role="application"
      aria-label="Flock board. Swipe or use the arrow keys to move all birds."
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {cells.map((cell) => {
        const r = Math.floor(cell / size);
        const c = cell % size;
        return (
          <div
            key={cell}
            className={`cell ${(r + c) % 2 === 0 ? 'tile-a' : 'tile-b'}`}
            style={pos(cell, size)}
          />
        );
      })}
      {level.walls.map((cell) => (
        <div key={`w${cell}`} className="piece" style={pos(cell, size)}>
          <WallArt />
        </div>
      ))}
      {BIRDS.map((i) => {
        const lit = state[i] === level.nests[i];
        return (
          <div
            key={`n${i}`}
            className={`piece nest${lit ? ' lit' : ''}`}
            style={pos(level.nests[i], size)}
          >
            <NestArt index={i} />
          </div>
        );
      })}
      {BIRDS.map((i) => {
        const home = state[i] === level.nests[i];
        const label = `${BIRD_LABELS[i]}${home ? ', on its nest' : ''}`;
        return (
          <div
            key={`b${i}`}
            className={`piece bird${home ? ' home' : ''}`}
            style={pos(state[i], size)}
            role="img"
            aria-label={label}
          >
            <div className={`bird-flip${facing[i] ? ' left' : ''}`}>
              <BirdArt index={i} contrary={level.kinds[i] === 'contrary'} />
            </div>
          </div>
        );
      })}
    </div>
  );
};
