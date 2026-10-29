import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { calculatePackageAdjustment } from "../docs/modules/package-value.js";
import { buildRankBoard, filterRankRows } from "../docs/modules/ranks.js";
import { mulberry32 } from "../docs/modules/season.js";
import { draftVerdictModel } from "../docs/modules/trade-draft.js";
import { valueCalcVerdict } from "../docs/modules/value-calc.js";
import { getAssetValue, PICK_YEAR_DISCOUNT, tepLevel } from "../docs/modules/values.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const snapshot = JSON.parse(readFileSync(join(root, "docs/data/player_values.json"), "utf8"));

function rngInts(rng, count, low, high) {
  const span = high - low + 1;
  const values = [];
  for (let index = 0; index < count; index += 1) {
    values.push(low + Math.floor(rng() * span));
  }
  return values;
}

function pickTable(values) {
  const table = new Map();
  for (const [assetId, value] of Object.entries(values)) {
    const parts = String(assetId).split(":");
    if (parts[0] !== "pick" || parts.length < 4) continue;
    const season = Number(parts[1]);
    const round = Number(String(parts[2]).replace(/^r/i, ""));
    const bucket = parts[3];
    if (!Number.isFinite(season) || !Number.isFinite(round) || !Number.isFinite(value)) continue;
    if (!table.has(season)) table.set(season, new Map());
    table.get(season).set(`${round}:${bucket}`, value);
  }
  return table;
}

function mirrorLabel(label) {
  return String(label)
    .replaceAll("Get", "\u0001")
    .replaceAll("Give", "Get")
    .replaceAll("\u0001", "Give");
}

test("published picks stay in slot, tier, round, and year order", () => {
  for (const format of ["sf", "oneQb"]) {
    const table = pickTable(snapshot[format]);
    const years = [...table.keys()].sort((a, b) => a - b);
    assert.ok(years.length >= 4, `${format} catalog is missing years`);
    for (const year of years) {
      const cell = (round, bucket) => table.get(year).get(`${round}:${bucket}`);
      const early = cell(1, "early");
      const mid = cell(1, "mid");
      const late = cell(1, "late");
      const any = cell(1, "any");
      assert.ok(early >= mid && mid >= late, `${format} ${year} tiers ${early} ${mid} ${late}`);
      assert.ok(early >= any && any >= late, `${format} ${year} any ${any} sits outside early/late`);
      const rounds = [1, 2, 3, 4, 5].map((round) => cell(round, "any"));
      for (let index = 0; index < rounds.length - 1; index += 1) {
        assert.ok(rounds[index] >= rounds[index + 1], `${format} ${year} round ${index + 1} < next: ${rounds}`);
      }
      const tops = [early, cell(2, "any"), cell(3, "any"), cell(4, "any"), cell(5, "any")];
      for (let index = 0; index < tops.length - 1; index += 1) {
        assert.ok(tops[index] >= tops[index + 1], `${format} ${year} top of round ${index + 1} < next round`);
      }
    }
    for (let index = 0; index < years.length - 1; index += 1) {
      const now = table.get(years[index]);
      const later = table.get(years[index + 1]);
      for (const key of now.keys()) {
        if (!later.has(key)) continue;
        const current = now.get(key);
        const next = later.get(key);
        assert.ok(next <= current, `${format} ${key} rose from ${years[index]} ${current} to ${next}`);
        if (current > 20) {
          const ratio = next / current;
          assert.ok(ratio <= 1);
          assert.ok(Math.abs(ratio - PICK_YEAR_DISCOUNT) < 0.03, `${format} ${key} ratio ${ratio}`);
        }
      }
    }
  }
});

test("published prices are finite, non-negative, and on one ruler", () => {
  for (const format of ["sf", "oneQb"]) {
    for (const [assetId, value] of Object.entries(snapshot[format])) {
      assert.equal(Number.isInteger(value), true, assetId);
      assert.ok(value >= 0 && value <= 20000, `${format} ${assetId} ${value}`);
    }
  }
  let qbPremium = 0;
  for (const assetId of Object.keys(snapshot.sf)) {
    if (!assetId.startsWith("player:")) continue;
    const position = snapshot.players[assetId]?.position;
    const sf = snapshot.sf[assetId];
    const oneQb = snapshot.oneQb[assetId];
    if (position === "QB") {
      if (sf > 0 || oneQb > 0) {
        assert.ok(sf >= oneQb, `${snapshot.names[assetId]} SF ${sf} < 1QB ${oneQb}`);
        if (sf > oneQb) qbPremium += 1;
      }
    } else if (position === "RB" || position === "WR" || position === "TE") {
      assert.equal(sf, oneQb, `${snapshot.names[assetId]} ${position} changed with format`);
    }
  }
  assert.ok(qbPremium >= 20, "superflex should lift a real set of quarterbacks");
});

test("rank order is deterministic and a filter keeps the overall rank", () => {
  const nflPlayers = {};
  for (const [assetId, info] of Object.entries(snapshot.players)) {
    nflPlayers[assetId.slice("player:".length)] = {
      full_name: snapshot.names[assetId],
      position: info.position,
      team: info.team || "DAL",
      age: info.age,
      active: true,
    };
  }
  const forward = buildRankBoard({
    values: snapshot.sf,
    names: snapshot.names,
    nflPlayers,
    minPickSeason: 2027,
  });
  const reversedValues = {};
  for (const key of Object.keys(snapshot.sf).reverse()) reversedValues[key] = snapshot.sf[key];
  const backward = buildRankBoard({
    values: reversedValues,
    names: snapshot.names,
    nflPlayers,
    minPickSeason: 2027,
  });
  assert.deepEqual(forward.map((row) => row.assetId), backward.map((row) => row.assetId));
  assert.deepEqual(forward.map((row) => row.overallRank), backward.map((row) => row.overallRank));
  const leaderPosition = snapshot.players[forward[0].assetId]?.position;
  const chaser = forward.find((row) => snapshot.players[row.assetId]?.position && snapshot.players[row.assetId].position !== leaderPosition);
  const wrs = filterRankRows(forward, { position: snapshot.players[chaser.assetId].position });
  assert.ok(wrs.length > 5);
  assert.ok(wrs[0].overallRank > 1, "the filtered position's No. 1 is not the overall No. 1");
  assert.equal(wrs[0].listRank, 1);
  assert.equal(wrs[0].overallRank, forward.find((row) => row.assetId === wrs[0].assetId).overallRank);
  const tied = buildRankBoard({
    values: { "player:1": 5000, "player:2": 5000, "player:3": 5000 },
    names: { "player:1": "Zed", "player:2": "Amy", "player:3": "Mo" },
    nflPlayers: {
      1: { full_name: "Zed", position: "WR", age: 24, active: true },
      2: { full_name: "Amy", position: "WR", age: 24, active: true },
      3: { full_name: "Mo", position: "RB", age: 24, active: true },
    },
    minPickSeason: 2027,
  });
  assert.deepEqual(tied.map((row) => row.name), ["Amy", "Mo", "Zed"]);
});

test("trade verdicts mirror, and empty or odd packages stay finite", () => {
  const rng = mulberry32(20261014);
  for (let trial = 0; trial < 80; trial += 1) {
    const giveCount = 1 + Math.floor(rng() * 4);
    const getCount = trial % 7 === 0 ? 0 : 1 + Math.floor(rng() * 4);
    const give = rngInts(rng, giveCount, 0, 12000);
    const get = rngInts(rng, getCount, 0, 12000);
    const max = 15000;
    const forward = draftVerdictModel(give, get, { globalMaxValue: max });
    const backward = draftVerdictModel(get, give, { globalMaxValue: max });
    assert.equal(forward.verdict.gap, -backward.verdict.gap);
    assert.equal(mirrorLabel(forward.verdict.label), backward.verdict.label);
    assert.equal(Number.isFinite(forward.verdict.pct), true);
    assert.equal(Number.isFinite(forward.give) && forward.give >= 0, true);
    assert.equal(Number.isFinite(forward.get) && forward.get >= 0, true);
    const mine = calculatePackageAdjustment({ myValues: give, theirValues: get, globalMaxValue: max });
    const theirs = calculatePackageAdjustment({ myValues: get, theirValues: give, globalMaxValue: max });
    assert.equal(mine.packageAdjustment, theirs.packageAdjustment);
    assert.equal(Number.isFinite(mine.evenValue) && mine.evenValue >= 0, true);
    const sideOk = (!mine.packageAdjustmentSide && !theirs.packageAdjustmentSide)
      || (mine.packageAdjustmentSide === "my" && theirs.packageAdjustmentSide === "their")
      || (mine.packageAdjustmentSide === "their" && theirs.packageAdjustmentSide === "my");
    assert.equal(sideOk, true);
  }
  const empty = calculatePackageAdjustment({ myValues: [], theirValues: [], globalMaxValue: 1000 });
  assert.equal(empty.packageAdjustment, 0);
  const odd = draftVerdictModel([100], [10, 10, 10, 10, 10, 10, 10], { globalMaxValue: 1000 });
  assert.equal(Number.isFinite(odd.verdict.pct), true);
  assert.equal(valueCalcVerdict(0, 0).label, "Add players to both sides");
});

test("TE premium, half-PPR, and a missing IDP price do not invent a number", () => {
  const te = { assetId: "player:te", assetType: "player", raw: { position: "TE" } };
  const lb = { assetId: "player:lb", assetType: "player", raw: { position: "LB", fantasy_positions: ["LB"] } };
  const values = { "player:te": 4200 };
  const tep = { scoring_settings: { rec: 0.5, bonus_rec_te: 1 } };
  assert.equal(tepLevel(tep), 2);
  assert.equal(getAssetValue(te, values, { league: tep }), 4200);
  assert.equal(getAssetValue(lb, values, { league: tep }), 0);
  assert.equal(getAssetValue({ assetId: "player:k", assetType: "player", raw: { position: "K" } }, values), 0);
});
