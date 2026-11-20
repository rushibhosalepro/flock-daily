import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Dir } from '../../shared/engine/types.ts';

const KEY_MAP: Record<string, Dir> = {
  ArrowUp: 'U',
  ArrowDown: 'D',
  ArrowLeft: 'L',
  ArrowRight: 'R',
  w: 'U',
  s: 'D',
  a: 'L',
  d: 'R',
  W: 'U',
  S: 'D',
  A: 'L',
  D: 'R',
};

const SWIPE_MIN_PX = 24;

type Handlers = {
  onMove: (dir: Dir) => void;
  onUndo: () => void;
  /** When true, keyboard and swipe input is ignored (an overlay is open). */
  locked: boolean;
};

/** Keyboard input for the whole page. */
export const useKeys = ({ onMove, onUndo, locked }: Handlers): void => {
  useEffect(() => {
    if (locked) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const dir = KEY_MAP[event.key];
      if (dir) {
        event.preventDefault();
        onMove(dir);
        return;
      }
      if (event.key === 'z' || event.key === 'Z' || event.key === 'Backspace') {
        event.preventDefault();
        onUndo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onMove, onUndo, locked]);
};

/** Swipe handlers for the board. The dominant axis of the drag picks the direction. */
export const useSwipe = (onMove: (dir: Dir) => void, locked: boolean) => {
  const start = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (locked) return;
    start.current = { x: event.clientX, y: event.clientY };
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const from = start.current;
    start.current = null;
    if (!from || locked) return;
    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN_PX) return;
    if (Math.abs(dx) > Math.abs(dy)) onMove(dx > 0 ? 'R' : 'L');
    else onMove(dy > 0 ? 'D' : 'U');
  };

  const onPointerCancel = () => {
    start.current = null;
  };

  return { onPointerDown, onPointerUp, onPointerCancel };
};
