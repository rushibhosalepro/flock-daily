import type { BirdIndex } from '../../shared/engine/types.ts';
import { BIRD_COLORS, BIRD_DARK, INK } from '../constants.ts';

/** Each bird has its own shape marker so color is never the only cue. */
const Symbol = ({
  index,
  cx,
  cy,
  size,
  fill,
  stroke,
}: {
  index: BirdIndex;
  cx: number;
  cy: number;
  size: number;
  fill: string;
  stroke: string;
}) => {
  if (index === 0) {
    const h = size;
    const points = `${cx},${cy - h} ${cx + h},${cy + h * 0.8} ${cx - h},${cy + h * 0.8}`;
    return (
      <polygon points={points} fill={fill} stroke={stroke} strokeWidth="2.5" />
    );
  }
  if (index === 1) {
    return (
      <rect
        x={cx - size * 0.9}
        y={cy - size * 0.9}
        width={size * 1.8}
        height={size * 1.8}
        rx="2"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.5"
      />
    );
  }
  return (
    <circle
      cx={cx}
      cy={cy}
      r={size}
      fill={fill}
      stroke={stroke}
      strokeWidth="2.5"
    />
  );
};

export const BirdArt = ({
  index,
  contrary,
}: {
  index: BirdIndex;
  contrary: boolean;
}) => {
  const color = BIRD_COLORS[index] ?? '#999';
  const dark = BIRD_DARK[index] ?? '#666';
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <ellipse cx="50" cy="90" rx="26" ry="6" fill="rgba(43,45,66,0.18)" />
      <path
        d="M24 58 L5 44 L9 68 Z"
        fill={dark}
        stroke={INK}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <circle
        cx="50"
        cy="54"
        r="31"
        fill={color}
        stroke={INK}
        strokeWidth="4"
      />
      <ellipse cx="53" cy="66" rx="19" ry="14" fill="rgba(255,255,255,0.55)" />
      <path
        d="M27 52 Q40 36 58 54 Q44 72 27 52 Z"
        fill={dark}
        stroke={INK}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <circle cx="64" cy="42" r="8" fill="#fff" stroke={INK} strokeWidth="3" />
      <circle cx="66" cy="42" r="3.6" fill={INK} />
      <path
        d="M78 46 L96 53 L78 60 Z"
        fill="#ff9f1c"
        stroke={INK}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <Symbol index={index} cx={52} cy={68} size={7} fill="#fff" stroke={INK} />
      {contrary ? (
        <g transform="translate(79 21)">
          <circle r="15" fill="#fff" stroke={INK} strokeWidth="3.5" />
          <path
            d="M-9 -5 H9 M4 -10 L9 -5 L4 0 M9 6 H-9 M-4 1 L-9 6 L-4 11"
            fill="none"
            stroke={INK}
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ) : null}
    </svg>
  );
};

export const NestArt = ({ index }: { index: BirdIndex }) => {
  const color = BIRD_COLORS[index] ?? '#999';
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle
        cx="50"
        cy="52"
        r="35"
        fill={color}
        fillOpacity="0.28"
        stroke="#8b5e34"
        strokeWidth="9"
        strokeDasharray="13 6"
        strokeLinecap="round"
      />
      <circle
        className="nest-glow"
        cx="50"
        cy="52"
        r="43"
        fill="none"
        stroke={color}
        strokeWidth="5"
      />
      <Symbol
        index={index}
        cx={50}
        cy={53}
        size={12}
        fill={color}
        stroke={INK}
      />
    </svg>
  );
};

export const WallArt = () => (
  <svg viewBox="0 0 100 100" aria-hidden="true">
    <rect
      x="6"
      y="6"
      width="88"
      height="88"
      rx="14"
      fill="#8d90a6"
      stroke={INK}
      strokeWidth="4"
    />
    <path
      d="M6 38 H94 M6 66 H94 M40 6 V38 M66 38 V66 M30 66 V94"
      stroke={INK}
      strokeOpacity="0.35"
      strokeWidth="3"
      fill="none"
    />
    <rect
      x="12"
      y="12"
      width="30"
      height="8"
      rx="4"
      fill="#fff"
      fillOpacity="0.3"
    />
  </svg>
);
