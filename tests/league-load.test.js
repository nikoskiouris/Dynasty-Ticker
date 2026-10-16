import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createLeagueLoader, shouldBlankDeskForLeagueSwitch } from "../docs/modules/league-load.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = readFileSync(join(root, "docs/app.js"), "utf8");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test("a second league request is not dropped", async () => {
  const loader = createLeagueLoader();
  const loaded = [];
  const gates = { a: deferred(), b: deferred() };

  const first = loader.run("league-a", async (id) => {
    loaded.push(`start:${id}`);
    await gates.a.promise;
    loaded.push(`done:${id}`);
  });
  const second = loader.run("league-b", async (id) => {
    loaded.push(`start:${id}`);
    await gates.b.promise;
    loaded.push(`done:${id}`);
  });

  assert.notEqual(first, second);
  gates.a.resolve();
  await first;
  assert.deepEqual(loaded, ["start:league-a", "done:league-a", "start:league-b"]);
  gates.b.resolve();
  await second;
  assert.deepEqual(loaded, ["start:league-a", "done:league-a", "start:league-b", "done:league-b"]);
});

test("the same league joins the load already running", async () => {
  const loader = createLeagueLoader();
  let runs = 0;
  const gate = deferred();
  const load = () => loader.run("league-a", async () => {
    runs += 1;
    await gate.promise;
  });

  const first = load();
  const second = load();
  assert.equal(first, second);
  gate.resolve();
  await first;
  assert.equal(runs, 1);
});

test("a request squeezed between two others never loads", async () => {
  const loader = createLeagueLoader();
  const loaded = [];
  const gates = { a: deferred(), c: deferred() };

  const first = loader.run("league-a", async (id, token) => {
    await gates.a.promise;
    if (!loader.isCurrent(token)) return;
    loaded.push(id);
  });
  const middle = loader.run("league-b", async (id, token) => {
    if (!loader.isCurrent(token)) return;
    loaded.push(id);
  });
  const last = loader.run("league-c", async (id, token) => {
    await gates.c.promise;
    if (!loader.isCurrent(token)) return;
    loaded.push(id);
  });

  gates.a.resolve();
  await first;
  await middle;
  gates.c.resolve();
  await last;
  assert.deepEqual(loaded, ["league-c"]);
});

test("a failed load does not block the next league", async () => {
  const loader = createLeagueLoader();
  const loaded = [];
  await loader.run("league-a", async () => {
    throw new Error("sleeper down");
  }).catch(() => {});
  await loader.run("league-b", async (id) => {
    loaded.push(id);
  });
  assert.deepEqual(loaded, ["league-b"]);
});

test("a different league blanks the desk immediately and the same league does not", () => {
  assert.equal(shouldBlankDeskForLeagueSwitch("league-a", "league-b"), true);
  assert.equal(shouldBlankDeskForLeagueSwitch("league-a", "league-a"), false);
  assert.equal(shouldBlankDeskForLeagueSwitch("", "league-b"), false);
  assert.equal(shouldBlankDeskForLeagueSwitch("league-a", ""), false);
});

test("desk uses the league loader and drops stale player refreshes", () => {
  assert.match(app, /createLeagueLoader/);
  assert.match(app, /leagueLoader\.run\(leagueId,/);
  assert.doesNotMatch(app, /if \(leagueLoadPromise\) return leagueLoadPromise/);
  assert.match(app, /if \(!leagueLoader\.isCurrent\(token\)\) return/);
  assert.match(app, /leagueLoader\.drop\(\)/);
  assert.match(app, /leagueLoader\.inFlightId/);
  assert.match(app, /invalidatePlayerLoads\(\)/);
  assert.match(app, /playersLoadStale\(playersEpoch, token, leagueId\)/);
  assert.match(app, /leagueId:\s*\(\)\s*=>\s*state\.leagueId/);
  assert.match(app, /cache:\s*"default"/);
  assert.match(app, /shouldBlankDeskForLeagueSwitch\(state\.leagueId, leagueId\)/);
  assert.match(app, /function blankDeskForLeagueSwitch\(\)/);
  assert.match(app, /state\.leagueSwitching = true/);
  assert.match(app, /if \(state\.leagueSwitching\)/);
});

test("drop abandons a league load that has not committed", async () => {
  const loader = createLeagueLoader();
  const gate = deferred();
  let committed = false;
  const job = loader.run("777", async (_id, token) => {
    await gate.promise;
    if (!loader.isCurrent(token)) return;
    committed = true;
  });
  assert.equal(loader.inFlightId(), "777");
  loader.drop();
  assert.equal(loader.inFlightId(), "");
  gate.resolve();
  await job;
  assert.equal(committed, false);
});

test("roster sheet paints while player metadata is still missing", () => {
  const start = app.indexOf("function renderRosterSheet()");
  assert.ok(start >= 0);
  const body = app.slice(start, app.indexOf("\nfunction ", start + 10));
  assert.match(body, /rosterGradeReady\(roster\)/);
  assert.match(body, /renderRosterDirectory\(roster\)/);
  assert.doesNotMatch(body, /Syncing player metadata/);

  const directory = app.slice(
    app.indexOf("function renderRosterDirectory("),
    app.indexOf("function renderPowerDashboard("),
  );
  assert.match(directory, /renderMetadataPlaceholder\(\)/);
  assert.match(directory, /Player metadata unavailable\. Rosters and trade search still work with fallback values\./);
  assert.match(directory, /sr-only">Loading player/);
  assert.match(directory, /sr-only">Player metadata unavailable/);
  assert.match(directory, /aria-busy="true"/);
  assert.match(directory, /renderPickVaultRow/);
  assert.doesNotMatch(directory, /Syncing player metadata/);
  assert.doesNotMatch(directory, /role="status"/);
  const placeholder = app.slice(
    app.indexOf("function renderMetadataPlaceholder("),
    app.indexOf("function renderRosterDirectory("),
  );
  assert.match(placeholder, /aria-hidden="true"/);
  assert.doesNotMatch(placeholder, /role="status"/);
  assert.doesNotMatch(placeholder, /title=/);

  const loadStart = app.indexOf("const playersEpoch = playerLoadEpoch");
  const success = app.slice(loadStart, app.indexOf(".catch(", loadStart));
  assert.match(success, /commitPlayerDirectory/);
  const commit = app.slice(
    app.indexOf("function commitPlayerDirectory("),
    app.indexOf("function loadSlimPlayersFile("),
  );
  assert.match(commit, /state\.playerMetadataLoaded = true/);
  assert.match(commit, /state\.playerMetadataFailed = false/);
  assert.match(app, /NFL_PLAYERS_SLIM_PATH/);
  assert.match(app, /playersCacheIsFresh\(fromCache, now, \{ ttlMs: PLAYERS_CACHE_TTL_MS \}\)/);
  assert.match(app, /if \(bootRoute\?\.leagueId\) void loadSlimPlayersFile\(\)/);
  assert.doesNotMatch(app, /bootFromUrl\(\);\nvoid loadSlimPlayersFile\(\)/);
  const fetchPlayers = app.slice(
    app.indexOf("async function fetchPlayersForCache("),
    app.indexOf("async function loadTrendingPlayers("),
  );
  assert.match(fetchPlayers, /if \(!state\.leagueId && !bootRoute\?\.leagueId\) return null/);
  const plain = app.slice(
    app.indexOf("function renderAssetValuePlain("),
    app.indexOf("function formatAssetSecondaryLabel("),
  );
  assert.match(plain, /Object\.keys\(values\)\.length === 0\) return "…"/);
  assert.match(plain, /Unavailable/);
  assert.doesNotMatch(app, /Syncing player metadata/);
  const index = readFileSync(join(root, "docs/index.html"), "utf8");
  assert.match(index, /<select id="me-select" aria-label="Team"><\/select>/);
});
