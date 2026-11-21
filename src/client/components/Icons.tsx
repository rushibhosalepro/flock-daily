import type { Dir } from '../../shared/engine/types.ts';

const ROTATE: Record<Dir, number> = { U: 0, R: 90, D: 180, L: 270 };

/** A chunky rounded arrow, rotated to point in the swipe direction. */
export const ArrowIcon = ({ dir }: { dir: Dir }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
    <path
      transform={`rotate(${ROTATE[dir]} 12 12)`}
      d="M12 4 L19 12 H15 V20 H9 V12 H5 Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
);

export const UndoIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
    <path
      d="M9 7 L4 11.5 L9 16 M4.5 11.5 H14 a5.5 5.5 0 0 1 0 11 H11"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      transform="translate(0 -3)"
    />
  </svg>
);

export const RestartIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
    <path
      d="M19.5 12 a7.5 7.5 0 1 1 -2.2 -5.3 M18.5 3.5 V7.5 H14.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
