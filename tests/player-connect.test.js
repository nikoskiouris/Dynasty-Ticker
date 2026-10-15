import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

test("a cold player card puts Find at the top and one submit opens the league list", () => {
  const ranks = readFileSync(join(root, "../docs/modules/ranks.js"), "utf8");
  assert.match(ranks, /export function renderPlayerConnect\(/);
  const connectFn = ranks.slice(ranks.indexOf("export function renderPlayerConnect"), ranks.indexOf("export function renderRanksToolbar"));
  assert.match(connectFn, /data-player-connect/);
  assert.match(connectFn, /data-player-league-list/);
  assert.match(connectFn, /Find my leagues/);
  const card = ranks.slice(ranks.indexOf("function renderRankCard"), ranks.indexOf("function renderRankNeighbor"));
  assert.doesNotMatch(card, /data-player-connect|find-my-leagues/);

  const app = readFileSync(join(root, "../docs/app.js"), "utf8");
  assert.match(app, /#ranks-section, #public-ranks/);
  assert.match(app, /anchor\.prepend\(slot\)/);
  assert.match(app, /async function openPlayerLeagueList\(form\)/);
  assert.match(app, /\[data-player-connect\]/);
  assert.match(app, /\[data-player-league-list\]/);
  const opener = app.slice(app.indexOf("async function openPlayerLeagueList"), app.indexOf("function isPrimaryPointer"));
  assert.match(opener, /await requestFindLeagues\(\)/);
  assert.match(opener, /landingLeaguePicker\.innerHTML/);
  assert.match(opener, /host\.hidden = !show/);

  const css = readFileSync(join(root, "../docs/styles.css"), "utf8");
  assert.match(css, /\.player-connect input \{[^}]*min-height:\s*44px/);
});
