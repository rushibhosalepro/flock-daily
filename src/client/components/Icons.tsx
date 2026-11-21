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

const SPEAKER = 'M4 9.5 H7.5 L12 5.5 V18.5 L7.5 14.5 H4 Z';

export const SoundOnIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
    <path d={SPEAKER} fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path
      d="M15.5 9 a4 4 0 0 1 0 6 M18 6.5 a7.5 7.5 0 0 1 0 11"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  </svg>
);

export const SoundOffIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
    <path d={SPEAKER} fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path
      d="M15.5 9.5 L20.5 14.5 M20.5 9.5 L15.5 14.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
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
