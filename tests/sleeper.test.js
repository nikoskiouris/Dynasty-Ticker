import test from "node:test";
import assert from "node:assert/strict";
import { createSleeperClient, fetchUserLeagues, autoloadLeagueId, dedupeLeagues, preferLatestLeagues, mapInChunks } from "../docs/modules/sleeper.js";

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

test("a failed current season is reported and does not autoload last year", async () => {
  const client = createSleeperClient({
    minIntervalMs: 0,
    sleep: async () => {},
    fetchImpl: async (url) => {
      if (url.endsWith("/user/Niko")) return jsonResponse({ user_id: "u1", display_name: "Niko" });
      if (url.includes("/leagues/nfl/2026")) return jsonResponse({ message: "nope" }, 500);
      if (url.includes("/leagues/nfl/2025")) {
        return jsonResponse([{ league_id: "old", name: "Try Hard", season: "2025" }]);
      }
      return jsonResponse([], 404);
    },
  });
  const result = await fetchUserLeagues(client, "Niko", ["2026", "2025"]);
  assert.deepEqual(result.failedSeasons, ["2026"]);
  assert.equal(result.leagues[0].league_id, "old");
  assert.equal(autoloadLeagueId(result.leagues, { currentSeason: "2026", failedSeasons: result.failedSeasons }), "");
  assert.equal(autoloadLeagueId(
    [{ league_id: "now", season: "2026" }],
    { currentSeason: "2026", failedSeasons: [] }
  ), "now");
});

test("invalidate drops queued Sleeper work and lets the next generation run", async () => {
  let releaseFirst;
  let calls = 0;
  const client = createSleeperClient({
    maxConcurrent: 1,
    minIntervalMs: 0,
    sleep: async () => {},
    fetchImpl: () => new Promise((resolve) => {
      calls += 1;
      if (calls === 1) {
        releaseFirst = resolve;
        return;
      }
      resolve(jsonResponse({ n: calls }));
    }),
  });
  const first = client.apiGet("/a");
  await new Promise((resolve) => setTimeout(resolve, 0));
  const queued = client.apiGet("/b");
  const generation = client.invalidate();
  const next = client.apiGet("/c");
  releaseFirst(jsonResponse({ n: 1 }));
  assert.equal((await first).n, 1);
  await assert.rejects(queued, (err) => err.cancelled === true);
  assert.equal((await next).n, 2);
  assert.equal(client.generation, generation);
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
