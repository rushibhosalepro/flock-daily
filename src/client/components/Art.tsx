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
      <g className="bird-eye">
        <circle
          cx="64"
          cy="42"
          r="8"
          fill="#fff"
          stroke={INK}
          strokeWidth="3"
        />
        <circle cx="66" cy="42" r="3.6" fill={INK} />
      </g>
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

/** Leaf balls that make up a hedge: [cx, cy, r]. */
const HEDGE: ReadonlyArray<readonly [number, number, number]> = [
  [30, 62, 24],
  [70, 62, 24],
  [50, 40, 26],
  [26, 40, 17],
  [74, 40, 17],
  [50, 70, 22],
];

/**
 * A hedge bush. Each leaf ball is drawn twice: first with a thick outline,
 * then filled on top, so only the outer edge of the cluster keeps its outline.
 */
export const WallArt = ({ variant = 0 }: { variant?: number }) => {
  const flip = variant % 2 === 1;
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <ellipse cx="50" cy="90" rx="38" ry="7" fill="rgba(43,45,66,0.2)" />
      <g transform={flip ? 'translate(100 0) scale(-1 1)' : undefined}>
        {HEDGE.map(([cx, cy, r]) => (
          <circle key={`o${cx}-${cy}`} cx={cx} cy={cy} r={r + 2} fill={INK} />
        ))}
        {HEDGE.map(([cx, cy, r]) => (
          <circle key={`f${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="#4f9d4a" />
        ))}
        <circle cx="50" cy="40" r="16" fill="#62b35b" />
        <circle cx="30" cy="60" r="13" fill="#62b35b" />
        <circle cx="70" cy="60" r="12" fill="#5aa954" />
        {/* Small leaves, placed unevenly so they never read as a face. */}
        <path
          d="M33 33 l5 -4 M58 26 l4 3 M20 56 l4 -4 M67 47 l5 2 M41 74 l4 -3 M76 66 l3 -4"
          stroke="#2f6b2c"
          strokeWidth="3.2"
          strokeLinecap="round"
          fill="none"
        />
        <ellipse cx="42" cy="28" rx="9" ry="4" fill="#fff" fillOpacity="0.35" />
        {variant % 3 === 0 ? (
          <>
            <circle
              cx="66"
              cy="34"
              r="4.5"
              fill="#e5484d"
              stroke={INK}
              strokeWidth="2"
            />
            <circle
              cx="73"
              cy="41"
              r="4"
              fill="#e5484d"
              stroke={INK}
              strokeWidth="2"
            />
          </>
        ) : null}
      </g>
    </svg>
  );
};
