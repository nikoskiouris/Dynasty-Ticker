import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsvValues, pickValueBundle } from "../docs/modules/values.js";
import { composeValuationBundles } from "../docs/modules/trade-market.js";
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
  const mixed = listValueCalcAssets(values, names, { query: "2027 1st" });
  assert.deepEqual(mixed.map((row) => row.assetId).sort(), [
    "pick:2027:r1:early",
    "pick:2027:r1:late",
    "pick:2027:r1:mid",
  ]);
  assert.equal(mixed.some((row) => row.assetId === "pick:2027:r2:early"), false);
  assert.equal(mixed.some((row) => row.assetId === "pick:2027:r1:any"), false);

  const middle = listValueCalcAssets(values, names, { query: "middle 1st" });
  assert.deepEqual(middle.map((row) => row.assetId), ["pick:2027:r1:mid"]);

  const playerHit = listValueCalcAssets(values, names, { query: "bijan" });
  assert.equal(playerHit.length, 1);
  assert.equal(playerHit[0].assetType, "player");

  const ranked = listValueCalcAssets(values, names, { query: "early" });
  assert.ok(ranked[0].value >= ranked[ranked.length - 1].value);
  assert.ok(ranked.every((row) => row.assetType === "pick"));
});

test("generic picks stay early middle late, not a specific team's pick", () => {
  const picks = listGenericPicks(values, names);
  assert.deepEqual(picks.map((pick) => pick.bucket), ["early", "early", "mid", "late", "early"]);
  assert.equal(picks.some((pick) => pick.bucket === "any"), false);
});

test("blank calculator adds, sums, and grades both sides", () => {
  let state = emptyValueCalcState();
  state = addValueCalcItem(state, "left", { assetId: "player:1", name: "Bijan Robinson", value: 9000 });
  state = addValueCalcItem(state, "right", { assetId: "pick:2027:r1:early", name: "2027 Early 1st", value: 7000 });
  state = addValueCalcItem(state, "right", { assetId: "player:2", name: "Some Bench", value: 4100 });
  assert.equal(sumValueCalcSide(state.left), 9000);
  assert.equal(sumValueCalcSide(state.right), 11100);
  const verdict = valueCalcVerdict(9000, 11100);
  assert.match(verdict.label, /Get/);
  state = removeValueCalcItem(state, "right", state.right[0].uid);
  assert.equal(state.right.length, 1);
  state = clearValueCalcSides(state);
  assert.deepEqual(state.left, []);
  assert.deepEqual(state.right, []);
});

test("searching Brian finds Brian Thomas and Brian Robinson", () => {
  const csv = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../docs/data/ktc_values_sf.csv"), "utf8");
  const { values: marketValues, nameMap } = parseCsvValues(csv);
  const rows = listValueCalcAssets(marketValues, nameMap, { query: "Brian" });
  assert.ok(rows.some((row) => row.name === "Brian Thomas"));
  assert.ok(rows.some((row) => row.name === "Brian Robinson"));
});

test("market file search finds 2026 firsts and named players together", () => {
  const csv = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../docs/data/ktc_values_sf.csv"), "utf8");
  const { values: marketValues, nameMap } = parseCsvValues(csv);
  const firsts = listValueCalcAssets(marketValues, nameMap, { query: "2026 1st", limit: 20 });
  assert.ok(firsts.length >= 3);
  assert.ok(firsts.every((row) => row.assetType === "pick" && row.season === "2026" && row.round === 1));
  assert.ok(firsts.some((row) => row.bucket === "early"));
  assert.ok(firsts.some((row) => row.bucket === "mid"));
  assert.ok(firsts.some((row) => row.bucket === "late"));

  const bijan = listValueCalcAssets(marketValues, nameMap, { query: "bijan", limit: 5 });
  assert.equal(bijan[0].assetType, "player");
  assert.match(bijan[0].name, /Bijan/i);
});

test("player directory names fill a blank name map so search still works", () => {
  const names = withPlayerDirectoryNames({}, { 9509: { full_name: "Bijan Robinson" } });
  const rows = listValueCalcAssets({ "player:9509": 9996 }, names, { query: "bijan" });
  assert.equal(rows[0].name, "Bijan Robinson");
});

test("live ktc json names survive an empty format nameMap", () => {
  const json = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../docs/data/ktc_values.json"), "utf8"));
  const composed = composeValuationBundles(
    {
      sf: { values: json.sf, nameMap: {} },
      oneQb: { values: json.oneQb, nameMap: {} },
      names: json.names,
    },
    { sf: { values: {}, counts: {} }, oneQb: { values: {}, counts: {} }, names: {} }
  );
  const bundle = pickValueBundle(composed, "sf");
  const bijan = listValueCalcAssets(bundle.values, bundle.nameMap, { query: "bijan", limit: 5 });
  assert.match(bijan[0].name, /Bijan/i);
  const firsts = listValueCalcAssets(bundle.values, bundle.nameMap, { query: "2026 1st", limit: 8 });
  assert.ok(firsts.some((row) => row.assetType === "pick"));
});
