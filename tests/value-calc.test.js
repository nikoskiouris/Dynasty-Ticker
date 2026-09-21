import test from "node:test";
import assert from "node:assert/strict";
import {
  addValueCalcItem,
  clearValueCalcSides,
  emptyValueCalcState,
  groupGenericPicks,
  listGenericPicks,
  listValueCalcPlayers,
  removeValueCalcItem,
  sumValueCalcSide,
  valueCalcVerdict,
} from "../docs/modules/value-calc.js";

const values = {
  "player:1": 9000,
  "player:2": 4100,
  "pick:2027:r1:early": 7000,
  "pick:2027:r1:mid": 6200,
  "pick:2027:r1:late": 5400,
  "pick:2027:r1:any": 6100,
  "pick:2027:r2:early": 3200,
};
const names = {
  "player:1": "Bijan Robinson",
  "player:2": "Some Bench",
  "pick:2027:r1:early": "2027 Early 1st",
};

test("blank calculator searches any player, not a roster", () => {
  const rows = listValueCalcPlayers(values, names, { query: "bij", limit: 10 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "Bijan Robinson");
});

test("generic picks are early middle late, not a specific team's pick", () => {
  const picks = listGenericPicks(values, names);
  assert.deepEqual(picks.map((pick) => pick.bucket), ["early", "mid", "late", "early"]);
  assert.equal(picks.some((pick) => pick.bucket === "any"), false);
  const grouped = groupGenericPicks(picks);
  assert.equal(grouped[0].season, "2027");
  assert.equal(grouped[0].rounds[0].round, 1);
  assert.equal(grouped[0].rounds[0].buckets.length, 3);
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
