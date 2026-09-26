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

test("rather valuations follow the active SF or 1QB format", () => {
  const start = app.indexOf("function ratherMarketValues");
  const end = app.indexOf("function crowdVoteSource", start);
  const block = app.slice(start, end);
  assert.match(block, /state\.valueFormat === "oneQb"/);
  assert.match(block, /state\.valueBundles\?\.\[format\]/);
});

test("vote UI distinguishes saving, saved, and failed persistence", () => {
  const start = app.indexOf("async function chooseRatherPlayer");
  const end = app.indexOf("function handleLandingRatherClick", start);
  const block = app.slice(start, end);
  assert.match(block, /Saving vote/);
  assert.match(block, /Vote not saved/);
  assert.match(block, /Saved\./);
  assert.ok(block.indexOf("submitRatherCrowdVote") < block.indexOf("recordRatherVote"));
});

test("open clients refresh shared crowd evidence", () => {
  assert.match(app, /ensureCrowdRefreshTimer/);
  assert.match(app, /60_000/);
  assert.match(app, /fetchRatherCrowdVotes/);
});

test("valuation-dependent caches key off a valuation revision instead of map size", () => {
  assert.match(app, /function valuationCacheVersion/);
  const uses = app.match(/valuationCacheVersion\(\)/g) || [];
  assert.ok(uses.length >= 4);
  const simStart = app.indexOf("function simSignature");
  const simEnd = app.indexOf("function stopLivePolling", simStart);
  assert.doesNotMatch(app.slice(simStart, simEnd), /Object\.keys\(state\.values\)\.length/);
});
