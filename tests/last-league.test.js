import test from "node:test";
import assert from "node:assert/strict";
import {
  LAST_LEAGUE_KEY,
  forgetLastLeague,
  lastLeagueHref,
  lastLeagueMarkup,
  readLastLeague,
  writeLastLeague,
} from "../docs/modules/last-league.js";

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    map,
  };
}

test("the last league round-trips, opens its team, and forgets", () => {
  const storage = memoryStorage();
  assert.equal(readLastLeague(storage), null);
  assert.equal(writeLastLeague({ leagueId: "1180000000000000", leagueName: " Try  Hard ", rosterId: 4, managerName: "NikoSkiouris" }, storage), true);
  const row = readLastLeague(storage);
  assert.deepEqual(row, { leagueId: "1180000000000000", leagueName: "Try Hard", rosterId: 4, managerName: "NikoSkiouris" });
  assert.equal(lastLeagueHref(row), "/l/1180000000000000/team?me=4");
  assert.match(lastLeagueMarkup(row), /Open Try Hard/);
  assert.match(lastLeagueMarkup(row), /As NikoSkiouris\./);
  assert.match(lastLeagueMarkup(row), /Forget this league/);
  forgetLastLeague(storage);
  assert.equal(readLastLeague(storage), null);
  assert.equal(lastLeagueMarkup(null), "");
});

test("bad rows are ignored and names are escaped", () => {
  const storage = memoryStorage();
  storage.setItem(LAST_LEAGUE_KEY, "{not json");
  assert.equal(readLastLeague(storage), null);
  assert.equal(writeLastLeague({ leagueId: "abc" }, storage), false);
  assert.equal(writeLastLeague({ leagueId: "0" }, storage), false);
  writeLastLeague({ leagueId: "123", leagueName: "<img src=x onerror=alert(1)>", rosterId: -2 }, storage);
  const row = readLastLeague(storage);
  assert.equal(row.rosterId, null);
  assert.equal(lastLeagueHref(row), "/l/123/team");
  assert.doesNotMatch(lastLeagueMarkup(row), /<img/);
});

test("blocked storage never throws", () => {
  const blocked = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); }, removeItem() { throw new Error("denied"); } };
  assert.equal(readLastLeague(blocked), null);
  assert.equal(writeLastLeague({ leagueId: "123" }, blocked), false);
  assert.doesNotThrow(() => forgetLastLeague(blocked));
  assert.equal(readLastLeague(undefined), null);
});
