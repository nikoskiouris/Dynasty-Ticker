import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCsvValues,
  leagueHasSuperflex,
  tepLevel,
  tepMultiplier,
  selectValueFormat,
  getAssetValue,
  isEstimatedAsset,
  parsePickAssetId,
  resolvePickAssetValue,
  fetchValuationBundles,
  pickValueBundle,
  crowdShiftsFromVotes,
  applyCrowdShift,
  applyElitePlayerValuePremium,
  findPickCatalogValue,
  getGlobalMaxPlayerValue,
  KTC_GLOBAL_MAX_FALLBACK,
  CROWD_MAX_ABS_SHIFT,
} from "../docs/modules/values.js";

test("an older pick season is not marked up from a later catalog row", () => {
  const values = { "pick:2026:r1:any": 5000 };
  assert.equal(findPickCatalogValue({ season: "2024", round: 1, bucket: "any" }, values), 5000);
  const future = findPickCatalogValue({ season: "2028", round: 1, bucket: "any" }, values);
  assert.ok(future < 5000);
  assert.equal(future, Math.round(5000 * (0.88 ** 2)));
});

test("global max follows players, not a pricey pick", () => {
  const values = {
    "player:star": 8000,
    "pick:2027:r1:early": 14000,
  };
  assert.equal(getGlobalMaxPlayerValue(values), KTC_GLOBAL_MAX_FALLBACK);
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

test("TEP bump applies only to tight ends", () => {
  const league = { scoring_settings: { bonus_rec_te: 1 } };
  assert.equal(tepLevel(league), 2);
  assert.equal(tepMultiplier(2), 1.12);
  const te = { assetId: "player:te", assetType: "player", raw: { position: "TE" } };
  const wr = { assetId: "player:wr", assetType: "player", raw: { position: "WR" } };
  const values = { "player:te": 4000, "player:wr": 4000 };
  assert.equal(getAssetValue(te, values, { league }), Math.round(4000 * 1.12));
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

test("missing market numbers are estimated and labeled", () => {
  const asset = { assetId: "player:unknown", assetType: "player", raw: { position: "WR", age: 24 } };
  assert.equal(isEstimatedAsset(asset, {}), true);
  assert.ok(getAssetValue(asset, {}) > 1000);
  assert.ok(getAssetValue(asset, {}) < 2000);
  const known = { assetId: "player:1", assetType: "player", raw: { position: "WR" } };
  assert.equal(isEstimatedAsset(known, { "player:1": 3333 }), false);
});

test("a missing RB is not priced like a starter over a missing QB", () => {
  const kaleb = { assetId: "player:missing-rb", assetType: "player", raw: { position: "RB", age: 23 } };
  const jayden = { assetId: "player:missing-qb", assetType: "player", raw: { position: "QB", age: 25 } };
  const kalebVal = getAssetValue(kaleb, {});
  const jaydenVal = getAssetValue(jayden, {});
  assert.ok(kalebVal < 2000);
  assert.ok(jaydenVal > kalebVal);
});

test("missing sleeper id still uses the KeepTradeCut name", () => {
  const jayden = {
    assetId: "player:stale",
    assetType: "player",
    name: "Jayden Daniels",
    raw: { position: "QB", age: 25, full_name: "Jayden Daniels" },
  };
  const values = { "player:11566": 7008 };
  const names = { "player:11566": "Jayden Daniels" };
  assert.equal(isEstimatedAsset(jayden, values, { valueNameMap: names }), false);
  assert.ok(getAssetValue(jayden, values, { valueNameMap: names }) > 7008);
});

test("elite premium is smooth instead of jumping at tier boundaries", () => {
  const star = { assetId: "player:gibbs", assetType: "player", raw: { position: "RB" } };
  assert.equal(getAssetValue(star, { "player:gibbs": 9000 }), Math.round(9000 * 1.32));
  const below = applyElitePlayerValuePremium(star, 4999);
  const at = applyElitePlayerValuePremium(star, 5000);
  assert.ok(at > below);
  assert.ok(at - below < 10);
});

test("pick lookup time-discounts a nearest-year fallback", () => {
  const pick = { assetId: "pick:2026:r1:late", assetType: "pick", raw: { season: 2026, round: 1, ktcBucket: "late" } };
  const values = { "pick:2026:r1:late": 6100, "pick:2026:r1:any": 5300 };
  assert.equal(resolvePickAssetValue(pick, values), 6100);
  const future = { assetId: "pick:2029:r2:any", assetType: "pick", raw: { season: 2029, round: 2 } };
  const catalogValues = { "pick:2027:r2:any": 3200 };
  assert.equal(resolvePickAssetValue(future, catalogValues), 2478);
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

test("fetchValuationBundles falls back from JSON to SF then sample CSV", async () => {
  const files = {
    "./data/ktc_values.json": { sf: { "player:1": 8000 }, oneQb: { "player:1": 5000 }, names: { "player:1": "Star" } },
  };
  const fetchImpl = async (path) => {
    if (!(path in files)) return { ok: false, status: 404, text: async () => "", json: async () => null };
    const body = files[path];
    return {
      ok: true,
      status: 200,
      json: async () => body,
      text: async () => String(body),
    };
  };
  const bundle = await fetchValuationBundles(fetchImpl);
  assert.equal(bundle.sf.values["player:1"], 8000);
  assert.equal(bundle.oneQb.values["player:1"], 5000);
  assert.equal(bundle.sf.nameMap["player:1"], "Star");
  assert.equal(pickValueBundle(bundle, "sf").nameMap["player:1"], "Star");

  const csvFetch = async (path) => {
    if (path === "./data/ktc_values_sf.csv") {
      return { ok: true, text: async () => "asset_id,value,name\nplayer:9,1111,Nine\n" };
    }
    if (path === "./data/ktc_values_sample.csv") {
      return { ok: true, text: async () => "asset_id,value,name\nplayer:9,2222,Sample\n" };
    }
    return { ok: false, text: async () => "", json: async () => null };
  };
  const csvBundle = await fetchValuationBundles(csvFetch);
  assert.equal(csvBundle.sf.values["player:9"], 1111);
  assert.deepEqual(csvBundle.oneQb.values, {});
});

test("fetchValuationBundles keeps a null 1QB JSON map empty", async () => {
  const fetchImpl = async (path) => {
    if (path !== "./data/ktc_values.json") return { ok: false, json: async () => null, text: async () => "" };
    return {
      ok: true,
      json: async () => ({ sf: { "player:1": 8000 }, oneQb: null, names: { "player:1": "Star" } }),
      text: async () => "",
    };
  };
  const bundle = await fetchValuationBundles(fetchImpl);
  assert.equal(bundle.sf.values["player:1"], 8000);
  assert.deepEqual(bundle.oneQb.values, {});
  assert.equal(pickValueBundle(bundle, "oneQb").values["player:1"], undefined);
});

function evenVote(winnerId, loserId, at = 1_700_000_000_000, format = "PPR 12-man Superflex", eventId = "") {
  return { winnerId, loserId, format, at, eventId };
}

test("crowd votes slightly move a player without replacing the market prior", () => {
  const market = { "player:a": 8000, "player:b": 7900, "player:c": 5000 };
  const star = { assetId: "player:a", assetType: "player", raw: { position: "WR" } };
  const other = { assetId: "player:b", assetType: "player", raw: { position: "WR" } };
  const baseA = getAssetValue(star, market);
  const baseB = getAssetValue(other, market);

  const shifts = crowdShiftsFromVotes([evenVote("player:a", "player:b")], market, { now: 1_700_000_000_000 });
  const nudgedA = getAssetValue(star, market, { crowdShifts: shifts });
  const nudgedB = getAssetValue(other, market, { crowdShifts: shifts });

  assert.ok(nudgedA > baseA);
  assert.ok(nudgedB < baseB);
  assert.ok(nudgedA - baseA < baseA * 0.03);
  assert.ok(baseB - nudgedB < baseB * 0.03);
  assert.ok(Math.abs(shifts["player:a"]) <= CROWD_MAX_ABS_SHIFT);
});

test("market updates re-anchor the board; votes remain a bounded residual", () => {
  const votes = [evenVote("player:a", "player:b")];
  const oldMarket = { "player:a": 8000, "player:b": 7900 };
  const newMarket = { "player:a": 5100, "player:b": 7900 };
  const star = { assetId: "player:a", assetType: "player", raw: { position: "WR" } };

  const oldShifts = crowdShiftsFromVotes(votes, oldMarket, { now: 1_700_000_000_000 });
  const newShifts = crowdShiftsFromVotes(votes, newMarket, { now: 1_700_000_000_000 });
  const oldValue = getAssetValue(star, oldMarket, { crowdShifts: oldShifts });
  const newBase = getAssetValue(star, newMarket);
  const newValue = getAssetValue(star, newMarket, { crowdShifts: newShifts });

  assert.ok(oldValue > getAssetValue(star, oldMarket));
  assert.ok(newValue < oldValue * 0.75);
  assert.ok(newValue > newBase);
  assert.ok(newValue < newBase * (1 + CROWD_MAX_ABS_SHIFT + 0.001));
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

test("crowd nudge happens after the elite premium, not instead of it", () => {
  const star = { assetId: "player:gibbs", assetType: "player", raw: { position: "RB" } };
  const market = { "player:gibbs": 9000, "player:other": 8800 };
  const elite = getAssetValue(star, market);
  assert.equal(elite, Math.round(9000 * 1.32));
  const shifts = crowdShiftsFromVotes([evenVote("player:gibbs", "player:other")], market, { now: 1_700_000_000_000 });
  const nudged = getAssetValue(star, market, { crowdShifts: shifts });
  assert.ok(nudged > elite);
  assert.ok(nudged < elite * (1 + CROWD_MAX_ABS_SHIFT + 0.001));
});

test("league board overlay is opt-in and stacks after the crowd nudge", () => {
  const dart = { assetId: "player:pw", assetType: "player", raw: { position: "WR" } };
  const values = { "player:pw": 4200 };
  const base = getAssetValue(dart, values);
  const leagueOn = getAssetValue(dart, values, {
    leagueShifts: { "player:pw": 0.24 },
    applyLeagueBoard: true,
  });
  const leagueOff = getAssetValue(dart, values, {
    leagueShifts: { "player:pw": 0.24 },
    applyLeagueBoard: false,
  });
  assert.equal(base, 4200);
  assert.equal(leagueOff, 4200);
  assert.equal(leagueOn, Math.round(4200 * 1.24));
});
