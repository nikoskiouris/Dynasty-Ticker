import test from "node:test";
import assert from "node:assert/strict";
import { buildBuySellLists, seasonScoring } from "../docs/modules/buy-sell.js";

// 8 WRs on two rosters. Values rank them 1..8; points rank them in reverse.
function league({ ages = {} } = {}) {
  const wr = (n, rosterId) => ({ assetId: `player:${n}`, assetType: "player", name: `WR ${n}`, rosterId });
  const rosters = [
    { rosterId: 1, manager: { displayName: "me" }, assets: [1, 2, 3, 4].map((n) => wr(n, 1)) },
    { rosterId: 2, manager: { displayName: "kendall_w" }, assets: [5, 6, 7, 8].map((n) => wr(n, 2)) },
  ];
  const weekRows = new Map();
  for (let week = 1; week <= 5; week += 1) {
    const points = {};
    for (let n = 1; n <= 8; n += 1) points[String(n)] = n * 3; // WR8 scores most
    weekRows.set(week, [{ roster_id: 1, players_points: points }]);
  }
  return {
    rosters,
    weekRows,
    meRosterId: 1,
    valueOf: (asset) => 10000 - Number(asset.assetId.split(":")[1]) * 1000,
    positionOf: () => "WR",
    ageOf: (asset) => ages[asset.assetId] ?? 24,
    minGames: 4,
  };
}

test("season scoring counts only weeks a player scored", () => {
  const rows = new Map([[1, [{ players_points: { 9: 10, 10: 0 } }]], [2, [{ players_points: { 9: 20 } }]]]);
  const scoring = seasonScoring(rows);
  assert.deepEqual(scoring.get("9"), { points: 30, games: 2 });
  assert.equal(scoring.has("10"), false);
});

test("buy low is on other rosters, sell high is on mine, each with a why", () => {
  const lists = buildBuySellLists(league());
  assert.ok(lists.buy.length > 0);
  assert.ok(lists.sell.length > 0);
  assert.ok(lists.buy.every((row) => row.rosterId === 2 && row.owner === "kendall_w"));
  assert.ok(lists.sell.every((row) => row.rosterId === 1));
  assert.equal(lists.buy[0].name, "WR 8");
  assert.match(lists.buy[0].why, /^Scoring like WR1 \(24\.0 a game over 5\), priced as WR8\.$/);
  assert.equal(lists.sell[0].name, "WR 1");
  assert.match(lists.sell[0].why, /^Priced as WR1, scoring like WR8 /);
});

test("the lists follow the window call", () => {
  const ages = { "player:8": 30, "player:7": 30, "player:1": 23, "player:2": 23 };
  const rebuild = buildBuySellLists({ ...league({ ages }), teamState: "rebuilding" });
  assert.ok(rebuild.buy.every((row) => row.age <= 26), "a rebuild does not buy a 30-year-old");
  const contend = buildBuySellLists({ ...league({ ages }), teamState: "contending" });
  assert.ok(contend.sell.every((row) => row.age >= 27), "a contender does not sell young players");
});

test("no games or too few players: empty lists, not filler", () => {
  const empty = buildBuySellLists({ ...league(), weekRows: new Map() });
  assert.deepEqual([empty.buy, empty.sell], [[], []]);
  const short = buildBuySellLists({ ...league(), minGames: 9 });
  assert.deepEqual([short.buy, short.sell], [[], []]);
});
