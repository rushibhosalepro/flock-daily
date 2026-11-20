# Flock

A daily puzzle for Reddit. One swipe moves three birds at once. Put each bird on the nest of its own color in as few moves as you can. Built with Devvit Web for Reddit's Game of the Day Hackathon 2026.

Specs: `../.kiro/specs/flock/`. Project rules: `../.kiro/steering/flock.md`.

## Commands

- `npm run test:unit` runs the rules engine tests
- `npm run type-check` checks types
- `npm run lint` runs ESLint
- `npm run build` builds client and server into `dist/`
- `npm run login` then `npm run dev` starts a Reddit playtest
- `node --experimental-strip-types --no-warnings=ExperimentalWarning scripts/depth-test.ts` measures puzzle depth
- `node --experimental-strip-types --no-warnings=ExperimentalWarning scripts/preview-server.ts` serves the built client with a mock API at http://localhost:4173/game.html?day=3 (day 5 and 7 are twist days)

## Layout

- `src/shared/engine/` pure rules, solver, generator, daily plan, share text
- `src/server/` Hono routes, Redis results and streaks, daily post
- `src/client/` React UI (`splash.tsx` in the feed, `game.tsx` expanded)
