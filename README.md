# Flock

A daily puzzle where one swipe moves three birds at once. Get every bird onto the nest of its own color in as few moves as you can.

**▶ Play today's puzzle: [r/FlockDaily](https://www.reddit.com/r/FlockDaily/)**

![Flock gameplay: a two-swipe tutorial, then the daily puzzle solved at par, ending on the result card](https://raw.githubusercontent.com/rushibhosalepro/flock-daily/main/docs/flock-demo.gif)

[Watch it played on Reddit](https://github.com/rushibhosalepro/flock-daily/raw/main/docs/flock-reddit-demo.mp4) · [Source code on GitHub](https://github.com/rushibhosalepro/flock-daily)

## How to play

- **One swipe moves every bird** one step in that direction. Use arrow keys or the on-screen arrows on a computer.
- **Hedges, the edge and other birds stop a bird.** The others keep flying.
- **Get each bird onto its own nest.** Par is the fewest moves possible. Match it for a Perfect.
- **Twist days:** the yellow bird flies the opposite way.
- **Golden Feather:** most days hide a feather on the board. Bring every bird home *and* land one on the feather within Crown par to earn a 👑 Crown. The shortest route never passes the feather, so you choose between speed and the Crown.

New players get a two-swipe tutorial that takes about 10 seconds.

## Every day

- A new puzzle is posted at midnight UTC as **Flock #N**. Everyone in the community plays the same board.
- The week ramps up: Easy, Easy, Medium, Medium, Twist, Hard, Twist+.
- Every puzzle is checked by a solver, so it is always solvable and par is exact.
- Your streak and the daily stats count your first solve. Replays can still improve your best and earn the Crown.

## With your community

- **Post to comments:** one tap adds your result under the post's pinned results comment, posted as you, with your solution hidden as a spoiler.
- **Top solvers today:** the day's top three by first-solve moves, with 👑 for Crown earners and your own place.
- **Today's spread:** see how first solves split (at par, 1–2 over, 3+ over) and how many players you beat.
- **Share challenge:** send a friend your score to beat. They see the score, never your moves.
- **Join:** an optional button to join the community for tomorrow's puzzle.
- **Older posts** still play as practice and link to today's puzzle.

## For moderators

Install Flock on your subreddit. It posts a new puzzle every day on its own. To post today's puzzle by hand, use **Create today's Flock post** in the subreddit menu.

---

## For developers

Built with Devvit Web, React, TypeScript, Hono and Redis. The rules engine in `src/shared/engine/` is pure TypeScript, shared by the client, the server and the tests. The server replays every submitted move list and never trusts a client move count.

- `npm run test:unit` runs the rules engine tests
- `npm run type-check` and `npm run lint`
- `npm run build` builds client and server into `dist/`
- `npm run login` then `npm run dev` starts a Reddit playtest
- `node --experimental-strip-types --no-warnings=ExperimentalWarning scripts/level-report.ts 28` prints par and difficulty for the first 28 puzzles
- `node --experimental-strip-types --no-warnings=ExperimentalWarning scripts/preview-server.ts` serves the built client with a mock API at http://localhost:4173/game.html?day=3

Layout: `src/shared/engine/` (rules, solver, generator, daily plan), `src/server/` (routes, Redis, daily post), `src/client/` (React UI, played inline in the post), `docs/` (demo media).
