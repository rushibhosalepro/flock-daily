/**
 * Quality report for the generated daily puzzles.
 * Run: node --experimental-strip-types --no-warnings=ExperimentalWarning scripts/level-report.ts [days]
 *
 * walk  = the largest walking distance from a bird to its nest, ignoring walls and other birds.
 *         Par can never be lower than this.
 * extra = par - walk. Zero means every bird just walks home: no trick is needed.
 * ways  = number of different shortest solutions. Lower means a sharper puzzle.
 * crown = fewest moves to get every bird home and collect the golden feather.
 * +     = crown - par, the detour the feather costs.
 */
import { puzzleForDay } from '../src/shared/engine/daily.ts';
import { walkBound } from '../src/shared/engine/solver.ts';

const days = Number(process.argv[2] ?? 14);

console.log('day  label   par  walk  extra  ways  walls  crown   +');
let flat = 0;
let noCrown = 0;
for (let day = 1; day <= days; day++) {
  const p = puzzleForDay(day);
  const walk = walkBound(p.level);
  const extra = p.solution.par - walk;
  if (extra === 0) flat += 1;
  if (!p.crown) noCrown += 1;
  const crown = p.crown ? String(p.crown.crownPar) : '-';
  const plus = p.crown ? String(p.crown.crownPar - p.solution.par) : '-';
  console.log(
    `${String(day).padStart(3)}  ${p.label.padEnd(7)} ${String(p.solution.par).padStart(3)}  ${String(walk).padStart(4)}  ${String(extra).padStart(5)}  ${String(p.solution.optimalSolutions).padStart(4)}  ${String(p.level.walls.length).padStart(5)}  ${crown.padStart(5)}  ${plus.padStart(2)}`
  );
}
console.log(`\n${flat} of ${days} puzzles need no trick (extra = 0)`);
console.log(`${noCrown} of ${days} puzzles have no feather`);
