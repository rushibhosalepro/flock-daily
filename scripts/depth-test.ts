/**
 * Measures how deep the Flock mechanic is on random boards.
 * Run: node --experimental-strip-types --no-warnings=ExperimentalWarning scripts/depth-test.ts
 */
import { makeRng, randomLevel } from '../src/shared/engine/generator.ts';
import type { GenerateOptions } from '../src/shared/engine/generator.ts';
import { validateLevel } from '../src/shared/engine/step.ts';
import { solve } from '../src/shared/engine/solver.ts';
import type { BirdKind } from '../src/shared/engine/types.ts';

type Mode = {
  name: string;
  kinds: readonly [BirdKind, BirdKind, BirdKind];
};

const modes: Mode[] = [
  { name: 'all-normal', kinds: ['normal', 'normal', 'normal'] },
  { name: 'yellow-contrary', kinds: ['normal', 'normal', 'contrary'] },
];

const SAMPLES = 6000;

for (const mode of modes) {
  const options: GenerateOptions = {
    size: 5,
    minWalls: 4,
    maxWalls: 8,
    minPar: 0,
    maxPar: 99,
    maxOptimalSolutions: Infinity,
    kinds: mode.kinds,
  };
  const rng = makeRng(12345);
  let valid = 0;
  let solvable = 0;
  const parCount = new Map<number, number>();
  let unique = 0;
  let deep = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const level = randomLevel(rng, options);
    if (validateLevel(level) !== null) continue;
    valid += 1;
    const solution = solve(level);
    if (!solution) continue;
    solvable += 1;
    parCount.set(solution.par, (parCount.get(solution.par) ?? 0) + 1);
    if (solution.par >= 6 && solution.optimalSolutions <= 3) unique += 1;
    if (solution.par >= 6) deep += 1;
  }
  console.log(`\n== ${mode.name} ==`);
  console.log(`valid boards: ${valid}`);
  console.log(
    `solvable: ${solvable} (${((solvable / valid) * 100).toFixed(1)}%)`
  );
  console.log(
    `par >= 6: ${deep} (${((deep / valid) * 100).toFixed(1)}% of valid)`
  );
  console.log(
    `par >= 6 and <= 3 optimal solutions: ${unique} (${((unique / valid) * 100).toFixed(1)}% of valid)`
  );
  const keys = [...parCount.keys()].sort((a, b) => a - b);
  console.log('par distribution (par: count):');
  console.log(keys.map((k) => `${k}:${parCount.get(k)}`).join('  '));
}
