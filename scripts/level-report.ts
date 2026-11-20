/**
 * Quality report for the generated daily puzzles.
 * Run: node --experimental-strip-types --no-warnings=ExperimentalWarning scripts/level-report.ts [days]
 *
 * walk  = the largest walking distance from a bird to its nest, ignoring walls and other birds.
 *         Par can never be lower than this.
 * extra = par - walk. Zero means every bird just walks home: no trick is needed.
 * ways  = number of different shortest solutions. Lower means a sharper puzzle.
 */
import { puzzleForDay } from '../src/shared/engine/daily.ts';
import type { Level } from '../src/shared/engine/types.ts';

const days = Number(process.argv[2] ?? 14);

const walkBound = (level: Level): number => {
  let worst = 0;
  for (let i = 0; i < 3; i++) {
    const a = level.starts[i] ?? 0;
    const b = level.nests[i] ?? 0;
    const d =
      Math.abs(Math.floor(a / level.size) - Math.floor(b / level.size)) +
      Math.abs((a % level.size) - (b % level.size));
    worst = Math.max(worst, d);
  }
  return worst;
};

console.log('day  label   par  walk  extra  ways  walls');
let flat = 0;
for (let day = 1; day <= days; day++) {
  const p = puzzleForDay(day);
  const walk = walkBound(p.level);
  const extra = p.solution.par - walk;
  if (extra === 0) flat += 1;
  console.log(
    `${String(day).padStart(3)}  ${p.label.padEnd(7)} ${String(p.solution.par).padStart(3)}  ${String(walk).padStart(4)}  ${String(extra).padStart(5)}  ${String(p.solution.optimalSolutions).padStart(4)}  ${String(p.level.walls.length).padStart(5)}`
  );
}
console.log(`\n${flat} of ${days} puzzles need no trick (extra = 0)`);
