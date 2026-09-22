import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chooseBestLineup } from "../docs/modules/lineup.js";

const appSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../docs/app.js"), "utf8");

function allowed(slot) {
  if (slot === "FLEX") return new Set(["RB", "WR", "TE"]);
  if (slot === "SUPER_FLEX") return new Set(["QB", "RB", "WR", "TE"]);
  return new Set([slot]);
}

function canFill(candidate, slot) {
  return allowed(slot).has(candidate.pos);
}

function referenceLineup(slotEntries, candidates) {
  const memo = new Map();
  const solve = (slotIndex, usedMask) => {
    const key = `${slotIndex}:${usedMask}`;
    if (memo.has(key)) return memo.get(key);
    if (slotIndex >= slotEntries.length) {
      const empty = { score: 0, picks: [] };
      memo.set(key, empty);
      return empty;
    }
    let best = { score: Number.NEGATIVE_INFINITY, picks: [] };
    const slot = slotEntries[slotIndex].slot;
    for (let index = 0; index < candidates.length; index += 1) {
      const bit = 1 << index;
      if (usedMask & bit) continue;
      if (!canFill(candidates[index], slot)) continue;
      const child = solve(slotIndex + 1, usedMask | bit);
      const total = candidates[index].value + child.score;
      if (total > best.score) best = { score: total, picks: [index, ...child.picks] };
    }
    const skip = solve(slotIndex + 1, usedMask);
    if (skip.score > best.score) best = { score: skip.score, picks: [null, ...skip.picks] };
    memo.set(key, best);
    return best;
  };
  return solve(0, 0);
}

test("exact lineup matches the old search on random rosters", () => {
  const pool = ["QB", "RB", "WR", "TE", "K"];
  for (let trial = 0; trial < 30; trial += 1) {
    const slotNames = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "SUPER_FLEX", "K"].slice(0, 6 + (trial % 4));
    const slots = slotNames.map((slot, index) => ({ slot, index }));
    const candidates = Array.from({ length: 8 + (trial % 5) }, (_, index) => ({
      pos: pool[(index * 3 + trial) % pool.length],
      value: ((trial * 17 + index * 13) % 9) * 100,
    }));
    const fast = chooseBestLineup(slots, candidates, canFill);
    const slow = referenceLineup(slots, candidates);
    assert.equal(fast.score, slow.score);
    assert.deepEqual(fast.picks, slow.picks);
  }
});

test("exact lineup matches the old search, including ties and open slots", () => {
  const slots = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "SUPER_FLEX", "K"].map((slot, index) => ({ slot, index }));
  const candidates = [
    { pos: "QB", value: 5000 },
    { pos: "QB", value: 5000 },
    { pos: "RB", value: 4200 },
    { pos: "WR", value: 0 },
    { pos: "TE", value: 1800 },
    { pos: "RB", value: 900 },
    { pos: "WR", value: 3000 },
    { pos: "WR", value: 3000 },
  ];
  const fast = chooseBestLineup(slots, candidates, canFill);
  const slow = referenceLineup(slots, candidates);
  assert.equal(fast.score, slow.score);
  assert.deepEqual(fast.picks, slow.picks);
  assert.equal(fast.picks[0], 0);
  assert.equal(fast.picks.at(-1), null);
});

test("exact lineup stays fast for a full league of deep rosters", () => {
  const slots = ["QB", "RB", "RB", "WR", "WR", "WR", "TE", "FLEX", "SUPER_FLEX", "FLEX", "WR"].map((slot, index) => ({ slot, index }));
  const positions = ["QB", "RB", "WR", "TE", "QB", "RB", "WR", "TE", "RB", "WR", "WR", "RB", "TE", "QB"];
  const started = Date.now();
  let total = 0;
  for (let roster = 0; roster < 24; roster += 1) {
    const candidates = positions.map((pos, index) => ({
      pos,
      value: 8000 - index * 250 + ((roster + index) % 5) * 15,
    }));
    total += chooseBestLineup(slots, candidates, canFill).score;
  }
  const elapsed = Date.now() - started;
  assert.ok(total > 0);
  assert.ok(elapsed < 800, `lineup solves took ${elapsed}ms`);
});

test("teams page reuses one power board and paints before the cold solve", () => {
  assert.match(appSource, /function buildPowerProfiles\(\) \{\s*return getLeaguePowerBoard\(\)\.profiles;/);
  assert.match(appSource, /function renderPowerDashboard\(\) \{[\s\S]*getLeaguePowerBoard\(\)/);
  assert.match(appSource, /await waitForNextPaint\(\)/);
  assert.match(appSource, /function finishTeamsPagePaint/);
  assert.doesNotMatch(
    appSource.slice(appSource.indexOf("function renderPowerDashboard"), appSource.indexOf("function getSeasonModel")),
    /buildLeaguePowerContext\(\{/
  );
});
