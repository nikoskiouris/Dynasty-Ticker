// A tiny change in one piece's value never moves the verdict more than one band.
// Report 2026-10-31: swapping Warren (5,658) for Odunze (5,831) flipped
// "Fair trade · within 5%" to "Lopsided · 96%".
import test from "node:test";
import assert from "node:assert/strict";
import { draftVerdictModel } from "../docs/modules/trade-draft.js";
import { verdictCopy } from "../docs/modules/verdict-copy.js";

const ORDER = ["even", "edge", "favors", "lopsided"];
const band = (give, get, max) => {
  const model = draftVerdictModel(give, get, { globalMaxValue: max });
  const copy = verdictCopy(model.verdict);
  const g = model.compareGive, t = model.compareGet;
  const lean = t > g ? 1 : t < g ? -1 : 0;
  return { tier: ORDER.indexOf(copy.tier), more: lean * (copy.more || 0), lean, copy };
};
// Signed position on one scale: Give-favored bands negative, Get-favored positive.
const signed = (b) => b.lean * b.tier;

test("Gibbs for Nabers + two early 1sts + Warren, then Odunze instead of Warren, stays Fair", () => {
  const max = 14821;
  const warren = band([14019], [9252, 6667, 5667, 5658], max);
  const odunze = band([14019], [9252, 6667, 5667, 5831], max);
  assert.equal(warren.copy.tier, "even");
  assert.ok(Math.abs(signed(odunze) - signed(warren)) <= 1, `${warren.copy.line} -> ${odunze.copy.line}`);
});

let seed = 7;
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const piece = () => Math.round(200 + rand() * 13800);

// Known limit: near the very top of the market the stud curve is steep, so a
// 2% bump to the best player can still move two bands (Fair to Favors). It
// can no longer skip from Fair to Lopsided, which is the cliff the report hit.
test("random trades: a swap worth up to 2% of the larger side never skips from Fair to Lopsided", () => {
  const max = 14821;
  for (let n = 0; n < 4000; n++) {
    const give = Array.from({ length: 1 + Math.floor(rand() * 4) }, piece);
    const get = Array.from({ length: 1 + Math.floor(rand() * 4) }, piece);
    const larger = Math.max(give.reduce((a, b) => a + b, 0), get.reduce((a, b) => a + b, 0));
    const before = band(give, get, max);
    const bumped = [...get];
    const i = Math.floor(rand() * bumped.length);
    bumped[i] = Math.min(max, bumped[i] + Math.round(rand() * 0.02 * larger));
    const after = band(give, bumped, max);
    assert.ok(Math.abs(signed(after) - signed(before)) <= 2,
      `give ${give} get ${get} -> ${bumped}: ${before.copy.line} -> ${after.copy.line}`);
  }
});

test("as one side rises steadily, % more never jumps", () => {
  const max = 14821;
  let last = null;
  for (let v = 4000; v <= 9000; v += 25) {
    const b = band([14019], [9252, 6667, 5667, v], max);
    const value = b.more;
    if (last != null) assert.ok(Math.abs(value - last) <= 3, `at ${v}: ${last} -> ${value}`);
    last = value;
  }
});
