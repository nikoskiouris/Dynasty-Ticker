import test from "node:test";
import assert from "node:assert/strict";
import {
  playerDisplayName,
  playersFallback,
  playersFromCache,
  trimPlayerRecord,
  trimPlayersDirectory,
} from "../docs/modules/players-cache.js";

test("player cache keeps names and drops nameless rows", () => {
  const trimmed = trimPlayersDirectory({
    1: {
      full_name: "Justin Jefferson",
      first_name: "Justin",
      last_name: "Jefferson",
      position: "WR",
      fantasy_positions: ["WR", "TE", "RB", "QB"],
      team: "MIN",
      age: 26,
      status: "Active",
      injury_status: "Questionable",
      years_exp: 6,
      metadata: { rookie_year: 2020, extra: "nope" },
      news: { huge: true },
    },
    2: { position: "RB", team: "FA" },
    3: { first_name: "Sam", last_name: "LaPorta", team: "DET" },
  });
  assert.equal(trimmed.named, 2);
  assert.equal(trimmed.dropped, 1);
  assert.equal(trimmed.players[1].full_name, "Justin Jefferson");
  assert.deepEqual(trimmed.players[1].fantasy_positions, ["WR", "TE", "RB"]);
  assert.deepEqual(trimmed.players[1].metadata, { rookie_year: 2020 });
  assert.equal(trimmed.players[1].news, undefined);
  assert.equal(playerDisplayName(trimmed.players[3]), "Sam LaPorta");
  assert.equal(trimPlayerRecord({ team: "KC" }), null);
});

test("fresh cache hits and stale directories still supply names", () => {
  const cached = {
    savedAt: 1_000,
    stateKey: "2026-2026-4",
    players: { 1: { full_name: "Justin Jefferson" } },
  };
  assert.equal(playersFromCache(cached, { stateKey: "2026-2026-4", now: 9_000, ttl: 100 })[1].full_name, "Justin Jefferson");
  assert.equal(playersFromCache(cached, { stateKey: "other", now: 1_050, ttl: 100 })[1].full_name, "Justin Jefferson");
  assert.equal(playersFromCache(cached, { stateKey: "other", now: 5_000, ttl: 100 }), null);
  assert.equal(playersFallback(cached)[1].full_name, "Justin Jefferson");
  assert.equal(playersFallback({ players: {} }), null);
});
