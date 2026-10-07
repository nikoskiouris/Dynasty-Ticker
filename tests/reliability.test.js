import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const app = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../docs/app.js"), "utf8");

test("league loads stamp an epoch and live scores refuse a stale league", () => {
  assert.match(app, /function bumpLeagueDataEpoch/);
  assert.match(app, /sleeper\.invalidate\(\)/);
  assert.match(app, /capturedEpoch !== leagueDataEpoch/);
  assert.match(app, /liveUpdateMatchesLeague\(leagueId, state\.leagueId\)/);
  assert.match(app, /function leagueWriteCurrent/);
});

test("player names retry and a failed season search does not autoload", () => {
  assert.match(app, /apiGetWithRetry\(`\/players\/nfl`/);
  assert.match(app, /autoloadLeagueId\(/);
  assert.match(app, /failedSeasons/);
  assert.match(app, /Nothing was opened/);
});

test("standings name a missing week and the sim runs in slices", () => {
  assert.match(app, /formatMissingWeeks\(model\.missingScoredWeeks\)/);
  assert.match(app, /createSeasonSimRun\(/);
  assert.match(app, /run\.step\(80\)/);
  assert.match(app, /document\.hidden/);
});
