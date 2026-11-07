import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { calculatePackageAdjustment } from "../docs/modules/package-value.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = readFileSync(join(root, "docs/app.js"), "utf8");

test("a stud package costs more than the same total in lesser pieces", () => {
  const swap = calculatePackageAdjustment({ myValues: [10321], theirValues: [9996], globalMaxValue: 10321 });
  assert.equal(swap.packageAdjustment, 0);
  assert.equal(swap.myAdjustedValue, 10321);
  assert.equal(swap.theirAdjustedValue, 9996);

  const studAndJunk = calculatePackageAdjustment({ myValues: [9000, 1000], theirValues: [5000, 5000], globalMaxValue: 10321 });
  assert.equal(studAndJunk.packageAdjustmentSide, "my");
  assert.ok(studAndJunk.packageAdjustment > 2000);

  const twoLateFirstsForStud = calculatePackageAdjustment({
    myValues: [7055, 5023],
    theirValues: [11735, 1305],
    globalMaxValue: 14000,
  });
  assert.equal(twoLateFirstsForStud.packageAdjustmentSide, "their");
  assert.ok(twoLateFirstsForStud.packageAdjustment > 4000);
  const apart = Math.abs(twoLateFirstsForStud.myAdjustedValue - twoLateFirstsForStud.theirAdjustedValue)
    / Math.max(twoLateFirstsForStud.myAdjustedValue, twoLateFirstsForStud.theirAdjustedValue);
  assert.ok(apart > 0.25);

  const oneForTwo = calculatePackageAdjustment({ myValues: [10321], theirValues: [7700, 7300], globalMaxValue: 10321 });
  assert.equal(oneForTwo.packageAdjustmentSide, "my");
  assert.ok(oneForTwo.packageAdjustment > 0);
  assert.match(app, /from "\.\/modules\/package-value\.js"/);
});

test("valuation-dependent caches key off a valuation revision instead of map size", () => {
  assert.match(app, /function valuationCacheVersion/);
  const uses = app.match(/valuationCacheVersion\(\)/g) || [];
  assert.ok(uses.length >= 4);
  const simStart = app.indexOf("function simSignature");
  const simEnd = app.indexOf("function stopLivePolling", simStart);
  assert.doesNotMatch(app.slice(simStart, simEnd), /Object\.keys\(state\.values\)\.length/);
});

test("a throw-in never makes the side that receives it look worse", () => {
  const lead = (mine, theirs) => {
    const r = calculatePackageAdjustment({ myValues: mine, theirValues: theirs, globalMaxValue: 15000 });
    return r.myAdjustedValue - r.theirAdjustedValue;
  };
  // Bijan for Nabers is a straight swap at listed prices. A late 2nd for me
  // used to switch the stud curve on and grow my overpay from 28% to 58%.
  const swap = lead([11487], [8979]);
  assert.equal(swap, 11487 - 8979);
  let before = swap;
  for (const extra of [100, 500, 1000, 1745, 3000, 5000, 6667, 8000, 11000]) {
    const now = lead([11487], [8979, extra]);
    assert.ok(now <= before, `adding ${extra} to their side raised my lead ${before} -> ${now}`);
    before = now;
  }
  // The same holds when I add the throw-in to my own side.
  const base = lead([8979], [11487]);
  for (const extra of [100, 500, 1745, 5000]) {
    assert.ok(lead([8979, extra], [11487]) >= base, `adding ${extra} to my side lowered my lead`);
  }
  // Mirrors stay mirrors.
  for (const [a, b] of [[[11487], [8979, 500]], [[9000, 1000], [5000, 5000]], [[7055, 5023], [11735, 1305]]]) {
    assert.equal(lead(a, b), -lead(b, a));
  }
  // A random walk of throw-ins never moves the verdict the wrong way.
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 300; k++) {
    const mine = Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => Math.round(500 + rnd() * 12000));
    const theirs = Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => Math.round(500 + rnd() * 12000));
    const extra = Math.round(50 + rnd() * Math.min(...theirs));
    assert.ok(lead(mine, [...theirs, extra]) <= lead(mine, theirs) + 1, JSON.stringify({ mine, theirs, extra }));
  }
});
