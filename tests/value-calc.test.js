import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pickValueBundle } from "../docs/modules/values.js";
import {
  addValueCalcItem,
  clearValueCalcSides,
  emptyValueCalcState,
  listGenericPicks,
  listValueCalcAssets,
  listValueCalcPlayers,
  removeValueCalcItem,
  sumValueCalcSide,
  valueCalcVerdict,
  withPlayerDirectoryNames,
} from "../docs/modules/value-calc.js";

function publishedBundle() {
  const json = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../docs/data/player_values.json"), "utf8"));
  return pickValueBundle({
    sf: { values: json.sf, nameMap: json.names || {} },
    oneQb: { values: json.oneQb, nameMap: json.names || {} },
    names: json.names || {},
  }, "sf");
}

const values = {
  "player:1": 9000,
  "player:2": 4100,
  "pick:2027:r1:early": 7000,
  "pick:2027:r1:mid": 6200,
  "pick:2027:r1:late": 5400,
  "pick:2027:r1:any": 6100,
  "pick:2027:r2:early": 3200,
  "pick:2026:r1:early": 6800,
};
const names = {
  "player:1": "Bijan Robinson",
  "player:2": "Some Bench",
  "pick:2027:r1:early": "2027 Early 1st Pick",
  "pick:2027:r1:mid": "2027 Mid 1st Pick",
  "pick:2027:r1:late": "2027 Late 1st Pick",
  "pick:2027:r2:early": "2027 Early 2nd Pick",
  "pick:2026:r1:early": "2026 Early 1st Pick",
};

test("blank calculator searches any player, not a roster", () => {
  const rows = listValueCalcPlayers(values, names, { query: "bij", limit: 10 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "Bijan Robinson");
});

test("blank calculator searches players and generic picks in one list", () => {
  const mixed = listValueCalcAssets(values, names, { query: "2027 1st", minSeason: 2027 });
  assert.deepEqual(mixed.map((row) => row.assetId).sort(), [
    "pick:2027:r1:early",
    "pick:2027:r1:late",
    "pick:2027:r1:mid",
  ]);
  assert.equal(mixed.some((row) => row.assetId === "pick:2027:r2:early"), false);
  assert.equal(mixed.some((row) => row.assetId === "pick:2027:r1:any"), false);

  const middle = listValueCalcAssets(values, names, { query: "middle 1st", minSeason: 2027 });
  assert.deepEqual(middle.map((row) => row.assetId), ["pick:2027:r1:mid"]);

  const firsts = listValueCalcAssets(values, names, { query: "2027 early 1st", minSeason: 2027 });
  assert.deepEqual(firsts.map((row) => row.assetId), ["pick:2027:r1:early"]);

  const playerHit = listValueCalcAssets(values, names, { query: "bijan" });
  assert.equal(playerHit.length, 1);
  assert.equal(playerHit[0].assetType, "player");

  const ranked = listValueCalcAssets(values, names, { query: "early", minSeason: 2027 });
  assert.ok(ranked[0].value >= ranked[ranked.length - 1].value);
  assert.ok(ranked.every((row) => row.assetType === "pick"));
});

test("generic picks stay early middle late, not a specific team's pick", () => {
  const picks = listGenericPicks(values, names, { minSeason: 2027 });
  assert.deepEqual(picks.map((pick) => pick.assetId), [
    "pick:2027:r1:early",
    "pick:2027:r1:mid",
    "pick:2027:r1:late",
    "pick:2027:r2:early",
  ]);
  assert.equal(picks.some((pick) => pick.bucket === "any"), false);
  assert.equal(picks.some((pick) => pick.season === "2026"), false);
});

test("blank calculator adds, sums, and grades both sides", () => {
  let state = emptyValueCalcState();
  state = addValueCalcItem(state, "left", { assetId: "player:1", name: "Bijan Robinson" });
  state = addValueCalcItem(state, "right", { assetId: "pick:2027:r1:early", name: "2027 Early 1st" });
  state = addValueCalcItem(state, "right", { assetId: "player:2", name: "Some Bench" });
  const priceOf = (item) => values[item.assetId];
  assert.equal(sumValueCalcSide(state.left, priceOf), 9000);
  assert.equal(sumValueCalcSide(state.right, priceOf), 11100);
  const verdict = valueCalcVerdict(9000, 11100);
  assert.match(verdict.label, /Get/);
  state = removeValueCalcItem(state, "right", state.right[0].uid);
  assert.equal(state.right.length, 1);
  state = clearValueCalcSides(state);
  assert.deepEqual(state.left, []);
  assert.deepEqual(state.right, []);
});

test("published model search finds Brian Thomas and Brian Robinson", () => {
  const bundle = publishedBundle();
  const rows = listValueCalcAssets(bundle.values, bundle.nameMap, { query: "Brian" });
  assert.ok(rows.some((row) => row.name === "Brian Thomas"));
  assert.ok(rows.some((row) => row.name === "Brian Robinson"));
});

test("published model search finds future firsts and named players together", () => {
  const bundle = publishedBundle();
  const firsts = listValueCalcAssets(bundle.values, bundle.nameMap, { query: "2027 1st", limit: 20, minSeason: 2027 });
  assert.ok(firsts.length >= 3);
  assert.ok(firsts.every((row) => row.assetType === "pick" && row.season === "2027" && row.round === 1));
  assert.ok(firsts.some((row) => row.bucket === "early"));
  assert.ok(firsts.some((row) => row.bucket === "mid"));
  assert.ok(firsts.some((row) => row.bucket === "late"));
  const drafted = listValueCalcAssets(bundle.values, bundle.nameMap, { query: "2026 1st", limit: 20, minSeason: 2027 });
  assert.equal(drafted.length, 0);

  const bijan = listValueCalcAssets(bundle.values, bundle.nameMap, { query: "bijan", limit: 5 });
  assert.equal(bijan[0].assetType, "player");
  assert.match(bijan[0].name, /Bijan/i);
});

test("player directory names fill a blank name map so search still works", () => {
  const names = withPlayerDirectoryNames({}, { 9509: { full_name: "Bijan Robinson" } });
  const rows = listValueCalcAssets({ "player:9509": 9996 }, names, { query: "bijan" });
  assert.equal(rows[0].name, "Bijan Robinson");
});

test("published snapshot names survive the format wrapper", () => {
  const bundle = publishedBundle();
  const bijan = listValueCalcAssets(bundle.values, bundle.nameMap, { query: "bijan", limit: 5 });
  assert.match(bijan[0].name, /Bijan/i);
  const firsts = listValueCalcAssets(bundle.values, bundle.nameMap, { query: "2027 1st", limit: 8, minSeason: 2027 });
  assert.ok(firsts.some((row) => row.assetType === "pick" && row.season === "2027"));
});
