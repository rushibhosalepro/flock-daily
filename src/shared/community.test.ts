import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flairFor, recapText } from './community.ts';

test('no flair before a 3-day streak or a Crown', () => {
  assert.equal(flairFor(0, 0), null);
  assert.equal(flairFor(2, 0), null);
});

test('streak flair appears at 3 days and changes colour at 7 and 30', () => {
  const three = flairFor(3, 0);
  const seven = flairFor(7, 0);
  const thirty = flairFor(31, 0);
  assert.equal(three?.text, '🔥 3-day streak');
  assert.equal(seven?.text, '🔥 7-day streak');
  assert.equal(thirty?.text, '🔥 31-day streak');
  assert.notEqual(three?.backgroundColor, seven?.backgroundColor);
  assert.notEqual(seven?.backgroundColor, thirty?.backgroundColor);
  assert.equal(thirty?.textColor, 'light');
});

test('Crowns show alone or next to the streak', () => {
  assert.equal(flairFor(1, 1)?.text, '👑 1 Crown');
  assert.equal(flairFor(0, 4)?.text, '👑 4 Crowns');
  assert.equal(flairFor(8, 2)?.text, '🔥 8-day streak · 👑 2');
});

test('flair text stays within Reddit\'s 64-character limit', () => {
  assert.ok((flairFor(9999, 9999)?.text.length ?? 0) <= 64);
});

test('recap sums up the day without pinging anyone', () => {
  const text = recapText({
    day: 4,
    par: 7,
    solved: 12,
    atPar: 5,
    crowned: 3,
    top: [
      { name: 'quiet_heron', moves: 7, crown: true },
      { name: 'meadowlark', moves: 7, crown: false },
    ],
  });
  assert.equal(
    text,
    "**Yesterday's Flock #4:** 12 solved · 5 at par (7 moves) · 👑 3 crowned. Top solvers: **quiet\\_heron** 7 👑, **meadowlark** 7."
  );
  assert.ok(!text?.includes('u/'));
});

test('no recap for a day nobody solved', () => {
  assert.equal(
    recapText({ day: 2, par: 6, solved: 0, atPar: 0, crowned: 0, top: [] }),
    null
  );
});
