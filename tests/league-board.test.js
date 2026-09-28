import test from "node:test";
import assert from "node:assert/strict";
import {
  ageBucketForAsset,
  boomBustScore,
  buildLeagueBoard,
  emptyLeagueBoard,
  isBoomBustAsset,
  packagesFromTransaction,
  readApplyLeagueBoard,
  renderLeagueBoardMarkup,
  selectNotableBiases,
  shouldShowLeagueAlt,
  writeApplyLeagueBoard,
} from "../docs/modules/league-board.js";
import { getAssetValue } from "../docs/modules/values.js";

const NOW = 1_700_000_000_000;

function parker() {
  return {
    assetId: "player:pw",
    assetType: "player",
    name: "Parker Washington",
    raw: { position: "WR", age: 23, years_exp: 2 },
  };
}

function vetBack() {
  return {
    assetId: "player:vet",
    assetType: "player",
    name: "Veteran Back",
    raw: { position: "RB", age: 30, years_exp: 8 },
  };
}

function tradeFor(leftIds, rightIds, created = NOW) {
  const adds = {};
  leftIds.forEach((id) => { adds[id] = 1; });
  rightIds.forEach((id) => { adds[id] = 2; });
  return {
    type: "trade",
    status: "complete",
    roster_ids: [1, 2],
    adds,
    draft_picks: [],
    created,
    status_updated: created,
  };
}

function resolveFromCatalog(catalog) {
  return (token) => {
    const row = catalog[token.assetId];
    if (!row) return null;
    return {
      ...token,
      asset: row.asset,
      name: row.asset.name,
      marketValue: row.marketValue,
      position: row.asset.raw.position,
      ageBucket: ageBucketForAsset(row.asset),
      boomBust: isBoomBustAsset(row.asset, row.marketValue),
    };
  };
}

test("Parker Washington is a boom-bust skill player", () => {
  const asset = parker();
  assert.ok(boomBustScore(asset, 5000) >= 0.55);
  assert.equal(isBoomBustAsset(asset, 5000), true);
  assert.equal(isBoomBustAsset(vetBack(), 5000), false);
  assert.equal(ageBucketForAsset(asset), "youth");
});

test("league board pays up for boom-bust guys this room keeps buying", () => {
  const catalog = {
    "player:pw": { asset: parker(), marketValue: 5000 },
    "player:vet": { asset: vetBack(), marketValue: 6200 },
  };
  const trades = Array.from({ length: 8 }, (_, index) => tradeFor(["pw"], ["vet"], NOW - index * 86400000));
  const board = buildLeagueBoard({
    trades,
    resolveAsset: resolveFromCatalog(catalog),
    now: NOW,
  });
  assert.equal(board.ready, true);
  assert.ok(board.shifts["player:pw"] > 0);
  assert.ok(board.shifts["player:vet"] < 0);
  const market = getAssetValue(parker(), { "player:pw": 4200 });
  const canonical = getAssetValue(parker(), { "player:pw": 4200 }, {
    leagueShifts: board.shifts,
    applyLeagueBoard: true,
  });
  assert.equal(market, 4200);
  assert.equal(canonical, 4200);
  assert.equal(shouldShowLeagueAlt(market, Math.round(market * (1 + board.shifts["player:pw"]))), true);
  assert.ok(board.biases.some((bias) => bias.id === "boom" && bias.shift > 0));
});

test("league evidence stays informational, and too few trades stay empty", () => {
  const catalog = {
    "player:pw": { asset: parker(), marketValue: 5000 },
    "player:vet": { asset: vetBack(), marketValue: 6200 },
  };
  const thin = buildLeagueBoard({
    trades: [tradeFor(["pw"], ["vet"])],
    resolveAsset: resolveFromCatalog(catalog),
    now: NOW,
  });
  assert.equal(thin.ready, false);
  assert.deepEqual(thin.shifts, emptyLeagueBoard().shifts);

  const board = buildLeagueBoard({
    trades: Array.from({ length: 6 }, () => tradeFor(["pw"], ["vet"])),
    resolveAsset: resolveFromCatalog(catalog),
    now: NOW,
  });
  const asset = parker();
  const values = { "player:pw": 4200 };
  const off = getAssetValue(asset, values, { leagueShifts: board.shifts, applyLeagueBoard: false });
  const on = getAssetValue(asset, values, { leagueShifts: board.shifts, applyLeagueBoard: true });
  assert.equal(off, 4200);
  assert.equal(on, 4200);
});

test("league taste only calls out a real premium, not the whole roster", () => {
  const row = (id, label, shift) => ({
    id,
    label,
    shift,
    sentence: `${label} ${Math.round(shift * 100)}`,
  });
  const crowded = selectNotableBiases([
    row("pos:QB", "quarterbacks", 0.18),
    row("boom", "boom-or-bust skill players", 0.16),
    row("age:youth", "young players", 0.12),
    row("pos:RB", "running backs", 0.12),
    row("age:vet", "veterans", 0.12),
    row("pos:WR", "wide receivers", 0.10),
    row("pos:TE", "tight ends", 0.02),
    row("pick", "draft picks", 0.01),
  ]);
  assert.deepEqual(crowded.map((bias) => bias.id), ["pos:QB", "boom"]);

  const onePremium = selectNotableBiases([
    row("pos:WR", "wide receivers", 0.14),
    row("pos:RB", "running backs", 0.03),
    row("pos:QB", "quarterbacks", 0.02),
    row("pos:TE", "tight ends", 0.01),
    row("age:youth", "young players", 0.04),
    row("age:vet", "veterans", 0.02),
    row("boom", "boom-or-bust skill players", 0.03),
    row("pick", "draft picks", 0),
  ]);
  assert.deepEqual(onePremium.map((bias) => bias.id), ["pos:WR"]);

  const bothAges = selectNotableBiases([
    row("age:youth", "young players", 0.2),
    row("age:vet", "veterans", 0.18),
    row("pos:WR", "wide receivers", 0.02),
    row("pos:RB", "running backs", 0.01),
    row("pos:QB", "quarterbacks", 0),
    row("pos:TE", "tight ends", 0),
    row("boom", "boom-or-bust skill players", 0.02),
    row("pick", "draft picks", 0),
  ]);
  assert.deepEqual(bothAges.map((bias) => bias.id), []);
});

test("packagesFromTransaction ignores waivers and one-sided junk", () => {
  assert.equal(packagesFromTransaction({ type: "waiver", status: "complete", roster_ids: [1, 2], adds: { 1: 1 } }), null);
  const parsed = packagesFromTransaction(tradeFor(["11"], ["22"]));
  assert.deepEqual(parsed.rosterIds, ["1", "2"]);
  assert.equal(parsed.packages["1"][0].assetId, "player:11");
});

test("legacy apply flag can still be read, but league markup has no price toggle", () => {
  const memory = new Map();
  const storage = {
    getItem(key) { return memory.has(key) ? memory.get(key) : null; },
    setItem(key, value) { memory.set(key, String(value)); },
  };
  assert.equal(readApplyLeagueBoard(storage), false);
  writeApplyLeagueBoard(true, storage);
  assert.equal(readApplyLeagueBoard(storage), true);
  const html = renderLeagueBoardMarkup({
    ready: true,
    tradeCount: 8,
    summary: "This room pays up for boom-or-bust skill players.",
    biases: [{ sentence: "This league pays up for boom-or-bust skill players (+12%)." }],
    examples: [{ name: "Parker Washington", marketValue: 5000, leagueValue: 6200 }],
  }, { applied: false, formatNumber: String });
  assert.doesNotMatch(html, /Apply league board/);
  assert.match(html, /Parker Washington/);
  assert.doesNotMatch(html, /your league 6200/);
  assert.match(html, /model 5000/);
  assert.match(html, /not a second price/);
});
