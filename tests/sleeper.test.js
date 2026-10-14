import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createSleeperClient,
  fetchUserLeagues,
  dedupeLeagues,
  preferLatestLeagues,
  mapInChunks,
  slimPlayersMap,
  playersCacheIsFresh,
  savePlayersCacheEntry,
  loadPlayersCacheEntry,
} from "../docs/modules/sleeper.js";

const appSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../docs/app.js"), "utf8");

function jsonResponse(payload, status = 200, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return headers[String(name).toLowerCase()] ?? null;
      },
    },
    async json() {
      return payload;
    },
  };
}

test("sleeper client throttles concurrent calls", async () => {
  let inflight = 0;
  let maxInflight = 0;
  const starts = [];
  const client = createSleeperClient({
    maxConcurrent: 2,
    minIntervalMs: 15,
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    fetchImpl: async (url) => {
      inflight += 1;
      maxInflight = Math.max(maxInflight, inflight);
      starts.push(Date.now());
      await new Promise((resolve) => setTimeout(resolve, 20));
      inflight -= 1;
      return jsonResponse({ url });
    },
  });

  await Promise.all([
    client.apiGet("/a"),
    client.apiGet("/b"),
    client.apiGet("/c"),
    client.apiGet("/d"),
  ]);

  assert.ok(maxInflight <= 2, `expected <=2 concurrent, got ${maxInflight}`);
  assert.equal(starts.length, 4);
});

test("sleeper client retries 429", async () => {
  let calls = 0;
  const client = createSleeperClient({
    minIntervalMs: 0,
    sleep: async () => {},
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return jsonResponse({}, 429, { "retry-after": "0" });
      return jsonResponse({ ok: true });
    },
  });
  const payload = await client.apiGetWithRetry("/x", { retries: 2 });
  assert.equal(payload.ok, true);
  assert.equal(calls, 2);
});

test("fetchUserLeagues loads current and previous seasons and drops dupes", async () => {
  const client = createSleeperClient({
    minIntervalMs: 0,
    sleep: async () => {},
    fetchImpl: async (url) => {
      if (url.endsWith("/user/Niko")) return jsonResponse({ user_id: "u1", display_name: "Niko" });
      if (url.includes("/leagues/nfl/2026")) {
        return jsonResponse([{ league_id: "1", name: "Now", season: "2026" }]);
      }
      if (url.includes("/leagues/nfl/2025")) {
        return jsonResponse([
          { league_id: "1", name: "Now-dup", season: "2026" },
          { league_id: "2", name: "Then", season: "2025" },
        ]);
      }
      return jsonResponse([], 404);
    },
  });
  const result = await fetchUserLeagues(client, "Niko", ["2026", "2025"]);
  assert.equal(result.user.user_id, "u1");
  assert.deepEqual(result.leagues.map((league) => league.league_id), ["1", "2"]);
});

test("dedupeLeagues keeps first id", () => {
  assert.equal(dedupeLeagues([{ league_id: "1" }, { league_id: "1" }, { league_id: "2" }]).length, 2);
});

test("preferLatestLeagues hides last year's desk when this year rolled over", () => {
  const latest = preferLatestLeagues([
    { league_id: "2026-a", name: "Try Hard or Die Hard", season: "2026", previous_league_id: "2025-a" },
    { league_id: "2026-b", name: "Steven's Angels", season: "2026", previous_league_id: "2025-b" },
    { league_id: "2025-a", name: "Try Hard or Die Hard", season: "2025", previous_league_id: "2024-a" },
    { league_id: "2025-b", name: "Steven's Angels", season: "2025", previous_league_id: "2024-b" },
    { league_id: "2025-c", name: "One-and-done", season: "2025", previous_league_id: "2024-c" },
  ]);
  assert.deepEqual(latest.map((league) => league.league_id), ["2026-a", "2026-b", "2025-c"]);
});

test("fetchUserLeagues drops rolled-over previous seasons", async () => {
  const client = createSleeperClient({
    minIntervalMs: 0,
    sleep: async () => {},
    fetchImpl: async (url) => {
      if (url.endsWith("/user/Niko")) return jsonResponse({ user_id: "u1", display_name: "Niko" });
      if (url.includes("/leagues/nfl/2026")) {
        return jsonResponse([{ league_id: "now", name: "Try Hard", season: "2026", previous_league_id: "then" }]);
      }
      if (url.includes("/leagues/nfl/2025")) {
        return jsonResponse([{ league_id: "then", name: "Try Hard", season: "2025", previous_league_id: "older" }]);
      }
      return jsonResponse([], 404);
    },
  });
  const result = await fetchUserLeagues(client, "Niko", ["2026", "2025"]);
  assert.deepEqual(result.leagues.map((league) => league.league_id), ["now"]);
});

test("sleeper client does not retry a definitive 404", async () => {
  let calls = 0;
  const client = createSleeperClient({
    minIntervalMs: 0,
    sleep: async () => {},
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({}, 404);
    },
  });
  await assert.rejects(() => client.apiGetWithRetry("/missing", { retries: 3 }), /404/);
  assert.equal(calls, 1);
});

test("sleeper client can allow the HTTP cache for a large GET", async () => {
  let cacheMode = "";
  const client = createSleeperClient({
    minIntervalMs: 0,
    sleep: async () => {},
    fetchImpl: async (_url, init) => {
      cacheMode = init?.cache;
      return jsonResponse({ ok: true });
    },
  });
  await client.apiGet("/players/nfl", { cache: "default" });
  assert.equal(cacheMode, "default");
  await client.apiGet("/state/nfl");
  assert.equal(cacheMode, "no-store");
});

test("fetchUserLeagues reports a failed season instead of hiding it", async () => {
  const calls = [];
  const client = createSleeperClient({
    minIntervalMs: 0,
    sleep: async () => {},
    fetchImpl: async (url) => {
      calls.push(url);
      if (url.endsWith("/user/Niko")) return jsonResponse({ user_id: "u1", display_name: "Niko" });
      if (url.includes("/leagues/nfl/2026")) return jsonResponse({}, 500);
      if (url.includes("/leagues/nfl/2025")) {
        return jsonResponse([{ league_id: "old", name: "Last Year", season: "2025" }]);
      }
      return jsonResponse([], 404);
    },
  });
  const result = await fetchUserLeagues(client, "Niko", ["2026", "2025"]);
  assert.deepEqual(result.failedSeasons, ["2026"]);
  assert.deepEqual(result.leagues.map((league) => league.league_id), ["old"]);
  assert.equal(calls.filter((url) => url.includes("/leagues/nfl/2026")).length, 2);
});

test("fetchUserLeagues keeps both seasons when only the older one fails", async () => {
  const client = createSleeperClient({
    minIntervalMs: 0,
    sleep: async () => {},
    fetchImpl: async (url) => {
      if (url.endsWith("/user/Niko")) return jsonResponse({ user_id: "u1", display_name: "Niko" });
      if (url.includes("/leagues/nfl/2026")) {
        return jsonResponse([{ league_id: "now", name: "Now", season: "2026", previous_league_id: "then" }]);
      }
      if (url.includes("/leagues/nfl/2025")) return jsonResponse({}, 503);
      return jsonResponse([], 404);
    },
  });
  const result = await fetchUserLeagues(client, "Niko", ["2026", "2025"]);
  assert.deepEqual(result.failedSeasons, ["2025"]);
  assert.deepEqual(result.leagues.map((league) => league.league_id), ["now"]);
});

test("username league search paints before a players body parse", async () => {
  let parseStartedAt = 0;
  const client = createSleeperClient({
    maxConcurrent: 3,
    minIntervalMs: 110,
    fetchImpl: (url) => {
      const href = String(url);
      if (href.includes("/players/nfl")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json() {
            parseStartedAt = Date.now();
            const start = Date.now();
            while (Date.now() - start < 600) {}
            return Promise.resolve({ "11": { full_name: "Amon-Ra" } });
          },
        });
      }
      const payload = href.endsWith("/user/Niko")
        ? { user_id: "u1", display_name: "Niko" }
        : [{ league_id: "1", name: "Now", season: "2026" }];
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        async json() {
          return payload;
        },
      });
    },
  });

  const boot = client.apiGet("/players/nfl");
  const started = Date.now();
  const result = await fetchUserLeagues(client, "Niko", ["2026", "2025"]);
  const elapsed = Date.now() - started;
  assert.equal(result.user.user_id, "u1");
  assert.deepEqual(result.leagues.map((league) => league.league_id), ["1"]);
  assert.equal(result.failedSeasons.length, 0);
  assert.equal(parseStartedAt, 0, "players parse must not start before the picker can paint");
  assert.ok(elapsed < 450, `search took ${elapsed}ms; league status waited on the players parse`);
  await boot;
  assert.ok(parseStartedAt > 0);
});

test("username search does not autoload when the current season failed", () => {
  const search = appSource.match(/async function runUserLeagueSearch\(username\) \{[\s\S]*?\n\}/)?.[0] || "";
  const failedAt = search.indexOf("const currentFailed");
  const autoloadAt = search.indexOf("autoloadId = String");
  assert.ok(failedAt > 0, "search should notice a failed current season");
  assert.ok(autoloadAt > failedAt, "autoload must stay behind the current-season failure check");
  assert.match(search, /seasonSearchHardFailStatus\(season\)/);
  assert.match(search, /seasonSearchHardFailField\(season\)/);
  assert.match(search, /retry:\s*true/);
  assert.match(search, /missedLeagueSeasons/);
  assert.doesNotMatch(search, /Not opening a league/);
  assert.match(appSource, /function retryUserLeagueSearch\(/);
  assert.match(appSource, /leagueStatusRetry/);
  assert.match(appSource, /landingSearchRetry/);
});

test("picking a league keeps the list until the load commits", () => {
  const click = appSource.match(/function handleLeaguePickClick\(event\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(appSource, /function collapseLeaguePicker\(/);
  assert.doesNotMatch(click, /collapseLeaguePicker\(\)/);
  assert.match(click, /loadLeagueById\(leagueId\)/);
  const load = appSource.match(/async function runLeagueLoad\(leagueId, token[^)]*\) \{[\s\S]*?\n\}/)?.[0] || "";
  const opened = load.slice(0, load.indexOf("} catch (err)"));
  const failed = load.slice(load.indexOf("} catch (err)"));
  assert.match(opened, /state\.leagueSwitching = false;\s*collapseLeaguePicker\(\)/);
  assert.doesNotMatch(opened, /renderLeaguePicker\(/);
  assert.match(failed, /renderLeaguePicker\(state\.userLeagues/);
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../docs/styles.css"), "utf8");
  assert.doesNotMatch(css, /\.league-loading \.landing-search-row \{[^}]*pointer-events:\s*none/);
});

test("a retried search holds the players parse through the backoff and one frame", async () => {
  const events = [];
  let userCalls = 0;
  let releaseSleep;
  const sleepGate = new Promise((resolve) => {
    releaseSleep = resolve;
  });
  const releaseFrame = [];
  let client;
  let releaseState;
  const stateGate = new Promise((resolve) => {
    releaseState = resolve;
  });
  client = createSleeperClient({
    minIntervalMs: 0,
    maxConcurrent: 3,
    sleep: () => {
      events.push("sleep");
      return sleepGate;
    },
    yieldFrame: () => {
      events.push("frame");
      return new Promise((resolve) => {
        releaseFrame.push(resolve);
      });
    },
    fetchImpl: async (url) => {
      const href = String(url);
      if (href.includes("/players/nfl")) {
        events.push("players-headers");
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          json() {
            events.push("players-parse");
            return Promise.resolve({ ok: 1 });
          },
        };
      }
      if (href.includes("/state/nfl")) {
        events.push("state-headers");
        return stateGate.then(() => jsonResponse({ week: 1 }));
      }
      userCalls += 1;
      events.push(`user-${userCalls}`);
      if (userCalls === 1) return jsonResponse({}, 500);
      return jsonResponse({ user_id: "u1" });
    },
  });

  const players = client.apiGetWithRetry("/players/nfl", { retries: 0 });
  const search = client.apiGetWithRetry("/user/Niko", { retries: 1 });

  await waitFor(() => events.includes("sleep") && events.includes("players-headers"));
  assert.equal(events.includes("players-parse"), false, "parse ran during the retry sleep");
  releaseSleep();
  await waitFor(() => events.includes("frame"));
  assert.equal(events.includes("players-parse"), false, "parse ran before the frame");
  assert.equal(events.includes("user-2"), true);
  client.apiGet("/state/nfl");
  releaseFrame[0]();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(events.filter((event) => event === "frame").length, 1);
  assert.equal(events.includes("players-parse"), false, "parse ran while a new search read was still active");
  releaseState();
  await waitFor(() => events.filter((event) => event === "frame").length >= 2);
  assert.equal(events.includes("players-parse"), false, "parse ran before the second frame");
  releaseFrame[1]();
  await search;
  await players;
  assert.equal(events.includes("players-parse"), true);
  assert.ok(events.indexOf("players-parse") > events.lastIndexOf("frame"));
});

async function waitFor(fn) {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > 2000) throw new Error("timed out waiting");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

test("slim players cache drops fat fields and still names the player", () => {
  const slim = slimPlayersMap({
    "11": {
      player_id: "11",
      first_name: "Amon-Ra",
      last_name: "St. Brown",
      position: "WR",
      fantasy_positions: ["WR"],
      team: "DET",
      age: 25,
      injury_status: "Questionable",
      status: "Active",
      years_exp: 5,
      active: true,
      metadata: { rookie_year: 2021, news: "x".repeat(5000) },
      stats: { pts_ppr: 300 },
    },
  });
  assert.equal(slim["11"].full_name, "Amon-Ra St. Brown");
  assert.equal(slim["11"].injury_status, "Questionable");
  assert.equal(slim["11"].team, "DET");
  assert.equal(slim["11"].metadata.rookie_year, 2021);
  assert.equal(slim["11"].stats, undefined);
  assert.equal(slim["11"].metadata.news, undefined);
  assert.ok(JSON.stringify(slim["11"]).length < 400);
});

test("players cache expires on TTL even when the state key matches", () => {
  const entry = { savedAt: 1_000, stateKey: "2026-2026-6", players: { "11": { full_name: "Amon-Ra" } } };
  assert.equal(playersCacheIsFresh(entry, 1_000 + 60_000, { stateKey: "2026-2026-6", ttlMs: 120_000 }), true);
  assert.equal(playersCacheIsFresh(entry, 1_000 + 120_000, { stateKey: "2026-2026-6", ttlMs: 120_000 }), false);
  assert.equal(playersCacheIsFresh(entry, 1_000 + 1_000, { stateKey: "2026-2026-7", ttlMs: 120_000 }), false);
});

test("players cache falls back to IndexedDB when localStorage rejects the write", async () => {
  const idb = new Map();
  const local = {
    getItem() {
      throw new Error("quota");
    },
    setItem() {
      throw new Error("quota");
    },
    removeItem() {},
  };
  const saved = await savePlayersCacheEntry({
    savedAt: 50,
    stateKey: "2026-2026-6",
    players: { "11": { first_name: "Amon-Ra", last_name: "St. Brown", position: "WR", stats: { a: 1 } } },
  }, {
    localStorage: local,
    idb: {
      async set(key, value) { idb.set(key, value); },
      async get(key) { return idb.get(key) || null; },
    },
    key: "players",
  });
  assert.equal(saved.stored, "idb");
  assert.equal(saved.players["11"].stats, undefined);
  const loaded = await loadPlayersCacheEntry({
    localStorage: local,
    idb: { async get(key) { return idb.get(key) || null; } },
    key: "players",
  });
  assert.equal(loaded.players["11"].full_name, "Amon-Ra St. Brown");
});

test("players cache reports failure when localStorage and IndexedDB both fail", async () => {
  await assert.rejects(() => savePlayersCacheEntry({
    savedAt: 50,
    players: { "11": { full_name: "Amon-Ra" } },
  }, {
    localStorage: { setItem() { throw new Error("quota"); }, removeItem() {} },
    idb: { async set() { throw new Error("idb down"); } },
    key: "players",
  }), /localStorage and IndexedDB/);
});

test("mapInChunks preserves order and isolates failures", async () => {
  const settled = await mapInChunks([1, 2, 3, 4], 2, async (n) => {
    if (n === 3) throw new Error("boom");
    return n * 10;
  });
  assert.equal(settled.length, 4);
  assert.equal(settled[0].status, "fulfilled");
  assert.equal(settled[0].value, 10);
  assert.equal(settled[2].status, "rejected");
});
