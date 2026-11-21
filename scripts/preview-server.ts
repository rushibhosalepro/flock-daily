/**
 * Local preview of the built client with a mock API, for checking the UI outside Reddit.
 * Build first, then run:
 *   node --experimental-strip-types --no-warnings=ExperimentalWarning scripts/preview-server.ts [port]
 * Open http://localhost:4173/game.html?day=3 (or splash.html). Add &twist=1 style days by picking day 5 or 7.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { puzzleForDay } from '../src/shared/engine/daily.ts';
import { ratingFor } from '../src/shared/engine/share.ts';
import { replay } from '../src/shared/engine/step.ts';
import type { Dir } from '../src/shared/engine/types.ts';

const PORT = Number(process.argv[2] ?? 4173);
const ROOT = join(process.cwd(), 'dist', 'client');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json',
  '.png': 'image/png',
};

type Saved = { first: string; best: string; crown: string | null };
const saved = new Map<number, Saved>();
let streak = 0;
let tutorialDone = false;

const json = (body: unknown, status = 200) => ({
  status,
  type: 'application/json',
  body: JSON.stringify(body),
});

type Info = ReturnType<typeof info>;

const asResult = (moves: string, puzzle: Info) => ({
  moves: moves.length,
  par: puzzle.par,
  rating: ratingFor(moves.length, puzzle.par),
  moveList: [...moves],
  feather: replay(puzzle.level, [...moves].filter(isDir))?.feather ?? false,
});

const isDir = (c: string): c is Dir =>
  c === 'U' || c === 'D' || c === 'L' || c === 'R';

const dayOf = (url: URL): number => {
  const n = Number(url.searchParams.get('day') ?? 3);
  return Number.isInteger(n) && n >= 1 ? n : 3;
};

const info = (day: number) => {
  const p = puzzleForDay(day);
  return {
    day,
    label: p.label,
    twist: p.twist,
    level: p.level,
    par: p.solution.par,
    crownPar: p.crown?.crownPar ?? null,
  };
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  try {
    if (url.pathname === '/api/tutorial-done' && req.method === 'POST') {
      tutorialDone = true;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ type: 'tutorial-done', saved: true }));
      return;
    }
    if (url.pathname === '/__reset') {
      saved.clear();
      streak = 0;
      tutorialDone = false;
      res.writeHead(200).end('reset');
      return;
    }
    if (url.pathname === '/api/init') {
      const pageUrl = new URL(req.headers.referer ?? url.href);
      const day = dayOf(pageUrl);
      // ?today=N pretends the calendar has moved on, so this post is an old puzzle.
      const todayParam = Number(pageUrl.searchParams.get('today'));
      const today =
        Number.isInteger(todayParam) && todayParam > day ? todayParam : day;
      const puzzle = info(day);
      const prior = saved.get(day);
      const out = json({
        type: 'init',
        puzzle,
        today,
        isToday: today === day,
        todayUrl:
          today === day
            ? null
            : `http://localhost:${PORT}/game.html?day=${today}`,
        username: 'preview',
        tutorialDone,
        best: prior ? asResult(prior.best, puzzle) : null,
        bestCrown: prior?.crown ? asResult(prior.crown, puzzle) : null,
        streak: { current: streak, best: streak },
        stats: { solved: 41, atPar: 17, crowned: 5 },
      });
      res.writeHead(out.status, { 'Content-Type': out.type });
      res.end(out.body);
      return;
    }
    if (url.pathname === '/api/submit' && req.method === 'POST') {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const parsed = JSON.parse(raw);
      const day = dayOf(new URL(req.headers.referer ?? url.href));
      const puzzle = info(day);
      const outcome = replay(puzzle.level, parsed.moves);
      if (!outcome?.solved) {
        const bad = json({ status: 'error', message: 'Not a solution' }, 400);
        res.writeHead(bad.status, { 'Content-Type': bad.type });
        res.end(bad.body);
        return;
      }
      const round: string = parsed.moves.join('');
      const prior = saved.get(day);
      const first = !prior;
      if (first) streak += 1;
      const best =
        prior && prior.best.length <= round.length ? prior.best : round;
      let crown = prior?.crown ?? null;
      if (outcome.feather && puzzle.crownPar !== null) {
        if (crown === null || round.length < crown.length) crown = round;
      }
      saved.set(day, { first: prior?.first ?? round, best, crown });
      const out = json({
        type: 'submit',
        recorded: first,
        result: asResult(round, puzzle),
        best: asResult(best, puzzle),
        bestCrown: crown ? asResult(crown, puzzle) : null,
        streak: { current: streak, best: streak },
        stats: { solved: 42, atPar: 17, crowned: 6 },
      });
      res.writeHead(out.status, { 'Content-Type': out.type });
      res.end(out.body);
      return;
    }
    const rel = url.pathname === '/' ? '/game.html' : url.pathname;
    const file = normalize(join(ROOT, rel));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end();
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    });
    res.end(data);
  } catch {
    res.writeHead(404).end('not found');
  }
});

server.listen(PORT, () => {
  console.log(`preview on http://localhost:${PORT}/game.html`);
});
