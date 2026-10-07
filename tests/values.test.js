import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCsvValues,
  leagueHasSuperflex,
  tepLevel,
  selectValueFormat,
  getAssetValue,
  isEstimatedAsset,
  parsePickAssetId,
  resolvePickAssetValue,
  tradablePickSeason,
  upcomingDraftSeason,
  fetchValuationBundles,
  valuationUpdatedAt,
  pickValueBundle,
  crowdShiftsFromVotes,
  applyCrowdShift,
  findPickCatalogValue,
  findMarketValueByPlayerName,
  getGlobalMaxPlayerValue,
  CROWD_MAX_ABS_SHIFT,
} from "../docs/modules/values.js";

test("valuation stamp prefers meta.updatedAt, then asOf", () => {
  assert.equal(valuationUpdatedAt(null), "");
  assert.equal(valuationUpdatedAt({ asOf: "2026-09-28T21:49:04+00:00" }), "2026-09-28");
  assert.equal(
    valuationUpdatedAt({ asOf: "2026-09-28T21:49:04+00:00", meta: { updatedAt: "2026-10-02T00:00:00Z" } }),
    "2026-10-02",
  );
  assert.equal(valuationUpdatedAt({ meta: { updatedAt: "not-a-date" } }), "not-a-date");
});

test("only picks after the NFL draft stay tradable", () => {
  assert.equal(upcomingDraftSeason(new Date("2026-04-25T12:00:00Z")), 2026);
  assert.equal(upcomingDraftSeason(new Date("2026-04-26T12:00:00Z")), 2027);
  assert.equal(upcomingDraftSeason(new Date("2026-09-26T12:00:00Z")), 2027);
  assert.equal(upcomingDraftSeason(new Date("2027-02-01T12:00:00Z")), 2027);
  assert.equal(
    tradablePickSeason({ league_season: "2026", season_type: "regular" }, new Date("2026-09-26T12:00:00Z")),
    2027,
  );
  assert.equal(
    tradablePickSeason({ season: "2026", season_type: "off" }, new Date("2026-02-01T12:00:00Z")),
    2026,
  );
  assert.equal(
    tradablePickSeason({ season: "2026", season_type: "off" }, new Date("2026-05-10T12:00:00Z")),
    2027,
  );
});

test("an older pick season is not marked up from a later catalog row", () => {
  const values = { "pick:2026:r1:any": 5000 };
  assert.equal(findPickCatalogValue({ season: "2024", round: 1, bucket: "any" }, values), 5000);
  const future = findPickCatalogValue({ season: "2028", round: 1, bucket: "any" }, values);
  assert.ok(future < 5000);
  assert.equal(future, Math.round(5000 * (0.85 ** 2)));
});

test("global max follows players, not a pricey pick", () => {
  const values = {
    "player:star": 8000,
    "pick:2027:r1:early": 14000,
  };
  assert.equal(getGlobalMaxPlayerValue(values), 8000);
  assert.equal(getGlobalMaxPlayerValue({ "player:star": 11000, "pick:2027:r1:early": 14000 }), 11000);
  assert.equal(getGlobalMaxPlayerValue(values, 10500), 10500);
});

test("parseCsvValues reads asset rows", () => {
  const parsed = parseCsvValues("asset_id,value,name\nplayer:1,8000,Star\npick:2026:r1:any,5000,2026 1st\n");
  assert.equal(parsed.values["player:1"], 8000);
  assert.equal(parsed.nameMap["pick:2026:r1:any"], "2026 1st");
});

test("superflex vs 1QB format pick", () => {
  assert.equal(selectValueFormat({ roster_positions: ["QB", "RB", "SUPER_FLEX"] }), "sf");
  assert.equal(selectValueFormat({ roster_positions: ["QB", "RB", "WR", "TE", "FLEX"] }), "oneQb");
  assert.equal(leagueHasSuperflex({ roster_positions: ["QB", "QB", "RB"] }), true);
});

test("league scoring metadata never reprices the canonical player value", () => {
  const league = { scoring_settings: { bonus_rec_te: 1 } };
  assert.equal(tepLevel(league), 2);
  const te = { assetId: "player:te", assetType: "player", raw: { position: "TE" } };
  const wr = { assetId: "player:wr", assetType: "player", raw: { position: "WR" } };
  const values = { "player:te": 4000, "player:wr": 4000 };
  assert.equal(getAssetValue(te, values, { league }), 4000);
  assert.equal(getAssetValue(wr, values, { league }), 4000);
});

test("plain PPR Superflex is not tight end premium", () => {
  const league = {
    scoring_settings: {
      rec: 1,
      rec_yd: 0.1,
      rec_td: 6,
      fum_rec: 2,
      st_td: 6,
      def_st_td: 6,
    },
  };
  assert.equal(tepLevel(league), 0);
  assert.equal(tepLevel({ scoring_settings: { rec: 1, rec_te: 0, bonus_rec_te: 0 } }), 0);
  const te = { assetId: "player:te", assetType: "player", raw: { position: "TE" } };
  assert.equal(getAssetValue(te, { "player:te": 4000 }, { league }), 4000);
});

test("missing model numbers are unavailable instead of invented", () => {
  const asset = { assetId: "player:unknown", assetType: "player", raw: { position: "WR", age: 24 } };
  assert.equal(isEstimatedAsset(asset, {}), true);
  assert.equal(getAssetValue(asset, {}), 0);
  const known = { assetId: "player:1", assetType: "player", raw: { position: "WR" } };
  assert.equal(isEstimatedAsset(known, { "player:1": 3333 }), false);
  assert.equal(getAssetValue(known, { "player:1": 3333 }), 3333);
});


test("missing sleeper id still uses the market name", () => {
  const jayden = {
    assetId: "player:stale",
    assetType: "player",
    name: "Jayden Daniels",
    raw: { position: "QB", age: 25, full_name: "Jayden Daniels" },
  };
  const values = { "player:11566": 7008 };
  const names = { "player:11566": "Jayden Daniels" };
  assert.equal(isEstimatedAsset(jayden, values, { valueNameMap: names }), false);
  assert.equal(getAssetValue(jayden, values, { valueNameMap: names }), 7008);
});

test("name fallback ignores punctuation, skips picks and dead rows, and refuses a two-way tie", () => {
  const names = {
    "player:1": "D.J. Moore",
    "player:2": "Josh Allen",
    "player:3": "Josh Allen",
    "player:4": "Retired Guy",
    "pick:2027:r1:any": "Josh Allen",
  };
  const values = { "player:1": 4100, "player:2": 8800, "player:3": 900, "player:4": 0, "pick:2027:r1:any": 5000 };
  assert.equal(findMarketValueByPlayerName("D J Moore", values, names), 4100);
  assert.equal(findMarketValueByPlayerName("  d.j.  moore ", values, names), 4100);
  assert.equal(findMarketValueByPlayerName("Josh Allen", values, names), null);
  assert.equal(findMarketValueByPlayerName("Josh Allen", { ...values, "player:3": 0 }, names), 8800);
  assert.equal(findMarketValueByPlayerName("Retired Guy", values, names), null);
  assert.equal(findMarketValueByPlayerName("Nobody", values, names), null);
  assert.equal(findMarketValueByPlayerName("", values, names), null);
  assert.equal(findMarketValueByPlayerName("D J Moore", values, null), null);
});

test("value lookups that miss by id stay cheap on a full market board", () => {
  const values = {};
  const names = {};
  for (let index = 0; index < 3000; index += 1) {
    values[`player:${index}`] = 1000 + index;
    names[`player:${index}`] = `Player Number ${index} Jr.`;
  }
  const misses = Array.from({ length: 400 }, (_, index) => ({
    assetId: `pick:2027:${(index % 4) + 1}:${index}`,
    assetType: "pick",
    name: `2027 Round ${(index % 4) + 1}`,
    raw: { season: 2027, round: (index % 4) + 1 },
  }));
  const started = Date.now();
  for (let pass = 0; pass < 50; pass += 1) {
    misses.forEach((asset) => getAssetValue(asset, values, { valueNameMap: names }));
  }
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 400, `20,000 missed lookups took ${elapsed}ms`);
});


test("pick lookup time-discounts a nearest-year fallback", () => {
  const pick = { assetId: "pick:2026:r1:late", assetType: "pick", raw: { season: 2026, round: 1, ktcBucket: "late" } };
  const values = { "pick:2026:r1:late": 6100, "pick:2026:r1:any": 5300 };
  assert.equal(resolvePickAssetValue(pick, values), 6100);
  const future = { assetId: "pick:2029:r2:any", assetType: "pick", raw: { season: 2029, round: 2 } };
  const catalogValues = { "pick:2027:r2:any": 3200 };
  assert.equal(resolvePickAssetValue(future, catalogValues), Math.round(3200 * (0.85 ** 2)));
  assert.deepEqual(parsePickAssetId("pick:2028:r1:early"), { season: "2028", round: 1, bucket: "early" });
});

test("pickValueBundle prefers 1QB or Superflex maps", () => {
  const payload = {
    sf: { values: { "player:1": 9000 }, nameMap: { "player:1": "Star" } },
    oneQb: { values: { "player:1": 6100 }, nameMap: { "player:1": "Star" } },
  };
  assert.equal(pickValueBundle(payload, "sf").values["player:1"], 9000);
  assert.equal(pickValueBundle(payload, "oneQb").values["player:1"], 6100);
});

test("pickValueBundle does not copy Superflex prices into a missing 1QB board", () => {
  const payload = {
    sf: { values: { "player:1": 9000 }, nameMap: { "player:1": "Star" } },
    oneQb: null,
  };
  assert.deepEqual(pickValueBundle(payload, "oneQb").values, {});
  assert.equal(pickValueBundle(payload, "sf").values["player:1"], 9000);
});

test("pickValueBundle keeps top-level names when a format nameMap is empty", () => {
  const bundle = pickValueBundle({
    sf: { values: { "player:9509": 9996 }, nameMap: {} },
    names: { "player:9509": "Bijan Robinson" },
  }, "sf");
  assert.equal(bundle.values["player:9509"], 9996);
  assert.equal(bundle.nameMap["player:9509"], "Bijan Robinson");
});

test("fetchValuationBundles reads only the independent model snapshot", async () => {
  const files = {
    "./data/player_values.json": {
      modelVersion: "football-forecast-v1",
      asOf: "2026-09-28T00:00:00Z",
      sf: { "player:1": 8000, "player:wr": 7000 },
      oneQb: { "player:1": 5000, "player:wr": 7000 },
      names: { "player:1": "Quarterback", "player:wr": "Receiver" },
      players: { "player:1": { confidence: "established" } },
      meta: { scoring: "full PPR" },
    },
  };
  const fetchImpl = async (path) => ({
    ok: path in files,
    status: path in files ? 200 : 404,
    json: async () => files[path] || null,
    text: async () => "",
  });
  const bundle = await fetchValuationBundles(fetchImpl);
  assert.equal(bundle.sf.values["player:1"], 8000);
  assert.equal(bundle.oneQb.values["player:1"], 5000);
  assert.equal(bundle.sf.values["player:wr"], bundle.oneQb.values["player:wr"]);
  assert.equal(bundle.players["player:1"].confidence, "established");
  assert.equal(bundle.meta.scoring, "full PPR");
});

test("fetchValuationBundles rejects a legacy or missing model version", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ modelVersion: "market-v2", sf: { "player:1": 8000 }, oneQb: { "player:1": 5000 } }),
  });
  await assert.rejects(() => fetchValuationBundles(fetchImpl), /Unsupported player-value model/);
});

function evenVote(winnerId, loserId, at = 1_700_000_000_000, format = "PPR 12-man Superflex", eventId = "") {
  return { winnerId, loserId, format, at, eventId };
}

test("crowd votes remain preference evidence but never reprice players", () => {
  const market = { "player:a": 8000, "player:b": 7900 };
  const star = { assetId: "player:a", assetType: "player", raw: { position: "WR" } };
  const shifts = crowdShiftsFromVotes([evenVote("player:a", "player:b")], market, { now: 1_700_000_000_000 });
  assert.ok(shifts["player:a"] > 0);
  assert.equal(getAssetValue(star, market, { crowdShifts: shifts }), 8000);
});


test("independent votes on the same pair keep contributing and stay capped", () => {
  const market = { "player:a": 6000, "player:b": 5980 };
  const votes = Array.from({ length: 40 }, (_, i) => evenVote("player:a", "player:b", 1_700_000_000_000 + i, "sf", `v${i}`));
  const shifts = crowdShiftsFromVotes(votes, market, { now: 1_700_000_000_000 + 40 });
  const once = crowdShiftsFromVotes([evenVote("player:a", "player:b")], market, { now: 1_700_000_000_000 });
  assert.ok(shifts["player:a"] > once["player:a"]);
  assert.ok(shifts["player:a"] <= CROWD_MAX_ABS_SHIFT);
  const fortyTimes = applyCrowdShift("player:a", 6000, shifts);
  assert.ok(fortyTimes <= Math.round(6000 * (1 + CROWD_MAX_ABS_SHIFT)));
});

test("later independent consensus can reverse an early preference", () => {
  const market = { "player:a": 5000, "player:b": 5000 };
  const start = 1_700_000_000_000;
  const early = Array.from({ length: 10 }, (_, i) => evenVote("player:a", "player:b", start + i, "sf", `a${i}`));
  const later = Array.from({ length: 1000 }, (_, i) => evenVote("player:b", "player:a", start + 100 + i, "sf", `b${i}`));
  const shifts = crowdShiftsFromVotes([...early, ...later], market, { now: start + 1200 });
  assert.ok(shifts["player:b"] > 0);
  assert.ok(shifts["player:a"] < 0);
});

test("crowd aggregation is deterministic regardless of input order", () => {
  const market = { "player:a": 7200, "player:b": 7000, "player:c": 6900 };
  const votes = [
    evenVote("player:a", "player:b", 100, "sf", "one"),
    evenVote("player:c", "player:a", 200, "sf", "two"),
    evenVote("player:b", "player:c", 300, "sf", "three"),
  ];
  const forward = crowdShiftsFromVotes(votes, market, { now: 400 });
  const reverse = crowdShiftsFromVotes([...votes].reverse(), market, { now: 400 });
  for (const id of Object.keys(forward)) {
    assert.ok(Math.abs(forward[id] - reverse[id]) < 1e-12);
  }
});

test("Superflex votes do not leak into a 1QB board", () => {
  const market = { "player:qb": 8000, "player:wr": 7000 };
  const votes = [evenVote("player:qb", "player:wr", 1_700_000_000_000, "PPR 12-man Superflex", "sf-only")];
  const sf = crowdShiftsFromVotes(votes, market, { format: "sf", now: 1_700_000_000_000 });
  const oneQb = crowdShiftsFromVotes(votes, market, { format: "oneQb", now: 1_700_000_000_000 });
  assert.ok(sf["player:qb"] > 0);
  assert.deepEqual(Object.keys(oneQb), []);
});

test("upsets move more than chalk, junk votes are ignored", () => {
  const market = { "player:fav": 9000, "player:dog": 4000, "player:x": 5000 };
  const chalk = crowdShiftsFromVotes([evenVote("player:fav", "player:dog")], market, { now: 1_700_000_000_000 });
  const upset = crowdShiftsFromVotes([evenVote("player:dog", "player:fav")], market, { now: 1_700_000_000_000 });
  assert.ok(Math.abs(upset["player:dog"]) > Math.abs(chalk["player:fav"]));

  const junk = crowdShiftsFromVotes([
    { winnerId: "player:fav", loserId: "player:fav", at: 1, format: "sf" },
    { winnerId: "pick:2026:r1:any", loserId: "player:x", at: 1, format: "sf" },
    { winnerId: "", loserId: "player:x", at: 1, format: "sf" },
    evenVote("player:missing", "player:x"),
  ], market, { now: 1_700_000_000_000 });
  assert.deepEqual(Object.keys(junk), []);
});

test("crowd shift helpers cannot alter the canonical getAssetValue path", () => {
  const star = { assetId: "player:gibbs", assetType: "player", raw: { position: "RB" } };
  const market = { "player:gibbs": 9000, "player:other": 8800 };
  const shifts = crowdShiftsFromVotes([evenVote("player:gibbs", "player:other")], market, { now: 1_700_000_000_000 });
  assert.equal(getAssetValue(star, market, { crowdShifts: shifts }), 9000);
});

test("league board evidence never creates a second player price", () => {
  const asset = { assetId: "player:pw", assetType: "player", raw: { position: "WR" } };
  const values = { "player:pw": 4200 };
  assert.equal(getAssetValue(asset, values), 4200);
  assert.equal(getAssetValue(asset, values, {
    leagueShifts: { "player:pw": 0.24 },
    applyLeagueBoard: true,
  }), 4200);
});
