import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRankBoard,
  filterRankRows,
  foldRankQuery,
  isRankAssetId,
  marketTape,
  ownerLine,
  pickEqualLine,
  rankView,
  renderRanksMarkup,
  sameMoney,
} from "../docs/modules/ranks.js";

const values = {
  "player:1": 9000,
  "player:2": 7000,
  "player:3": 1800,
  "player:4": 400,
  "player:5": 5000,
  "player:9": 3000,
  "pick:2027:r1:any": 5600,
  "pick:2027:r1:early": 7000,
  "pick:2027:r1:mid": 5600,
  "pick:2027:r1:late": 5000,
  "pick:2027:r2:any": 3400,
};
const names = {
  "player:1": "Jahmyr Gibbs",
  "player:2": "Ja'Marr Chase",
  "player:3": "Backup Back",
  "player:4": "Scrub Guy",
  "player:5": "Even Guy",
  "player:9": "<script>Bad</script>",
};
const nflPlayers = {
  1: { full_name: "Jahmyr Gibbs", position: "RB", team: "DET", age: 23, active: true },
  2: { full_name: "Ja'Marr Chase", position: "WR", team: "CIN", age: 25, active: true },
  3: { full_name: "Backup Back", position: "RB", team: "FA", age: 26, active: true },
  4: { full_name: "Scrub Guy", position: "WR", team: "DAL", age: 24, active: true },
  5: { full_name: "Even Guy", position: "TE", team: "KC", age: 27, active: true },
  8: { full_name: "Old Retired", position: "WR", team: "FA", age: 34, status: "retired" },
  9: { position: "DEF", team: "DAL", active: true },
};
values["player:8"] = 8000;

test("board ranks players and drops retired, defense, and unnamed scrubs", () => {
  const rows = buildRankBoard({
    values,
    names,
    nflPlayers,
    ktcValues: { "player:1": 8000, "player:2": 7600 },
    tradeValues: { "player:1": 9800, "player:2": 6400 },
    tradeCounts: { "player:1": 2, "player:2": 1.4 },
    owners: { "player:1": { name: "Niko", mine: true } },
  });
  const ids = rows.map((row) => row.assetId);
  assert.equal(ids.includes("player:8"), false);
  assert.equal(ids.includes("player:9"), false);
  assert.equal(rows[0].assetId, "player:1");
  assert.equal(rows[0].boardRank, "RB1");
  assert.equal(rows[0].overallRank, 1);
  assert.equal(rows[0].owner.mine, true);
  assert.equal(rows[0].tape.tone, "up");
  assert.equal(rows[0].pickLine, "Worth more than a 2027 early 1st.");
  const chase = rows.find((row) => row.assetId === "player:2");
  assert.equal(chase.pickLine, "Worth about a 2027 early 1st.");
  assert.equal(chase.boardRank, "WR1");
  assert.equal(chase.tape.tone, "down");
  const even = rows.find((row) => row.assetId === "player:5");
  assert.equal(even.pickLine, "Worth about a 2027 late 1st.");
  assert.equal(even.pickEqual.value, 5000);
  const first = rows.find((row) => row.assetId === "pick:2027:r1:any");
  assert.equal(first.kind, "pick");
  assert.equal(first.name, "2027 1st");
  assert.equal(first.spread.length, 3);
  assert.ok(rows.findIndex((row) => row.assetId === "pick:2027:r1:any") < rows.findIndex((row) => row.assetId === "player:5"));
});

test("pick line and tape stay one sentence", () => {
  assert.equal(
    pickEqualLine(9000, { phrase: "2027 early 1st", value: 7000 }, { phrase: "2027 early 1st", value: 7000 }),
    "Worth more than a 2027 early 1st.",
  );
  assert.equal(pickEqualLine(1000, { phrase: "2027 1st", value: 1000 }), "Worth about a 2027 1st.");
  assert.equal(pickEqualLine(1300, { phrase: "2027 1st", value: 1000 }), "A step above a 2027 1st.");
  assert.equal(pickEqualLine(800, { phrase: "2027 1st", value: 1000 }), "A step under a 2027 1st.");
  assert.equal(pickEqualLine(4000, { phrase: "2028 3rd", value: 1000 }), "Closest pick is a 2028 3rd.");
  assert.equal(marketTape({ ktcValue: 1000, tradeValue: 1000, tradeCount: 2 }).line, "Sleeper trades and the crowd agree.");
  assert.match(marketTape({ ktcValue: 1000, tradeCount: 0 }).line, /Not enough Sleeper trades/);
  assert.equal(ownerLine({ mine: true }, { leagueOpen: true }), "You have him.");
  assert.equal(ownerLine({ name: "Demetri" }, { leagueOpen: true }), "Demetri has him.");
  assert.equal(ownerLine(null, { leagueOpen: true }), "Nobody in this league has him.");
  assert.equal(ownerLine({ name: "Demetri" }, { leagueOpen: false }), "");
});

test("filters keep the tradable board and search finds the cheap name", () => {
  const rows = buildRankBoard({ values, names, nflPlayers });
  const all = filterRankRows(rows, { position: "ALL" });
  assert.equal(all.some((row) => row.assetId === "player:4"), false);
  assert.equal(all.some((row) => row.assetId === "player:3"), true);
  assert.equal(all[0].listRank, 1);
  const rbs = filterRankRows(rows, { position: "RB" });
  assert.ok(rbs.every((row) => row.position === "RB"));
  assert.equal(rbs[0].boardRank, "RB1");
  const found = filterRankRows(rows, { query: "jamarr" });
  assert.equal(found.length, 1);
  assert.equal(found[0].name, "Ja'Marr Chase");
  assert.equal(foldRankQuery("Ja'Marr"), "jamarr");
  const picks = filterRankRows(rows, { position: "PICK" });
  assert.ok(picks.every((row) => row.kind === "pick"));
  assert.equal(picks.some((row) => row.assetId === "pick:2027:r1:early"), false);
  const money = sameMoney(rows, "player:2");
  assert.equal(money.some((row) => row.assetId === "player:2"), false);
  assert.ok(money.length >= 2);
});

test("markup escapes names and opens the selected card", () => {
  const rows = buildRankBoard({
    values: { ...values, "player:7": 2200 },
    names: { ...names, "player:7": "<script>Bad</script>" },
    nflPlayers: {
      ...nflPlayers,
      7: { position: "WR", team: "DAL", age: 24, active: true },
    },
  });
  const view = rankView({
    rows,
    position: "ALL",
    format: "sf",
    selectedId: "player:7",
    leagueOpen: true,
  });
  const html = renderRanksMarkup(view);
  assert.match(html, /data-ranks-root/);
  assert.match(html, /data-action="rank-open"/);
  assert.match(html, /Worth about a|A step|Closest pick/);
  assert.match(html, /Add to calculator/);
  assert.match(html, /Same money/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.equal(isRankAssetId("player:12"), true);
  assert.equal(isRankAssetId("pick:2027:r1:any"), true);
  assert.equal(isRankAssetId("pick:2027:r1:nope"), false);
  const loading = renderRanksMarkup({ loading: true });
  assert.match(loading, /Loading player values/);
});
