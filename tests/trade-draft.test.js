import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { siteMarkup } from "./site-markup.js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  addValueCalcItem,
  draftVerdictLabel,
  emptyValueCalcState,
  sumValueCalcSide,
  swapValueCalcSides,
  valueCalcVerdict,
} from "../docs/modules/value-calc.js";
import {
  TRADE_DRAFT_STORAGE_KEY,
  describeDraftItem,
  draftFromReview,
  draftMarketPrice,
  draftMeterValues,
  draftNoticeText,
  evenUpPickChoice,
  evenUpTradePick,
  draftSideForAsset,
  draftTeamSummary,
  draftVerdictModel,
  placeAfterConnect,
  readStoredDraft,
  resolveDraftContext,
  restoreDraft,
  reviewPayloadFor,
  serializeDraft,
  writeStoredDraft,
} from "../docs/modules/trade-draft.js";
import { calculatePackageAdjustment } from "../docs/modules/package-value.js";
import { getAssetValue } from "../docs/modules/values.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const ME = 3;
const rosters = [
  {
    rosterId: 3,
    manager: { displayName: "Niko" },
    assets: [
      { assetId: "player:9221", name: "Jahmyr Gibbs", assetType: "player", raw: { position: "RB" } },
      { assetId: "pick:2027:r1:5", name: "2027 1st from Zim", assetType: "pick", raw: { season: "2027", round: 1 } },
    ],
  },
  {
    rosterId: 7,
    manager: { displayName: "Chris" },
    assets: [
      { assetId: "player:9509", name: "Bijan Robinson", assetType: "player", raw: { position: "RB" } },
      { assetId: "pick:2027:r1:7", name: "2027 1st from Chris", assetType: "pick", raw: { season: "2027", round: 1 } },
    ],
  },
  {
    rosterId: 9,
    manager: { displayName: "Ben" },
    assets: [
      { assetId: "player:12508", name: "Tyler Warren", assetType: "player", raw: { position: "TE" } },
    ],
  },
];

function draftOf(left = [], right = []) {
  let draft = emptyValueCalcState();
  left.forEach((asset) => { draft = addValueCalcItem(draft, "left", asset); });
  right.forEach((asset) => { draft = addValueCalcItem(draft, "right", asset); });
  return draft;
}

const gibbs = { assetId: "player:9221", name: "Jahmyr Gibbs" };
const bijan = { assetId: "player:9509", name: "Bijan Robinson" };
const warren = { assetId: "player:12508", name: "Tyler Warren" };
const genericFirst = { assetId: "pick:2027:r1:early", name: "2027 Early 1st Pick" };

test("a draft names assets but stores no price, so a format change re-prices every piece", () => {
  const draft = draftOf([bijan], [gibbs, genericFirst]);
  for (const item of [...draft.left, ...draft.right]) {
    assert.equal("value" in item, false, `${item.name} carries a stored price`);
  }
  const superflex = { "player:9509": 9996, "player:9221": 10321, "pick:2027:r1:early": 7024 };
  const oneQb = { "player:9509": 9100, "player:9221": 9800, "pick:2027:r1:early": 6400 };
  const price = (map) => (item) => map[item.assetId];
  assert.equal(sumValueCalcSide(draft.right, price(superflex)), 17345);
  assert.equal(sumValueCalcSide(draft.right, price(oneQb)), 16200);
  assert.equal(sumValueCalcSide(draft.left, price(superflex)), 9996);
});

test("a player sits in the draft once; generic picks can repeat; league picks match by league", () => {
  let draft = draftOf([bijan], []);
  const again = addValueCalcItem(draft, "right", bijan);
  assert.equal(again, draft, "adding the same player again must be a no-op, not a second copy");
  draft = addValueCalcItem(draft, "right", genericFirst);
  draft = addValueCalcItem(draft, "right", genericFirst);
  assert.equal(draft.right.length, 2);
  draft = addValueCalcItem(draft, "left", { assetId: "pick:2027:r1:5", name: "A", leagueId: "L1" });
  draft = addValueCalcItem(draft, "left", { assetId: "pick:2027:r1:5", name: "A", leagueId: "L1" });
  draft = addValueCalcItem(draft, "left", { assetId: "pick:2027:r1:5", name: "B", leagueId: "L2" });
  assert.deepEqual(draft.left.map((item) => item.leagueId || ""), ["", "L1", "L2"]);
});

test("connecting reads ownership and never edits or trims the visitor's draft", () => {
  const draft = draftOf([bijan], [gibbs, genericFirst]);
  const before = JSON.stringify(draft);
  const context = resolveDraftContext({ draft, rosters, meRosterId: ME, leagueId: "L1" });
  assert.equal(JSON.stringify(draft), before);
  const status = (item) => context.items.get(item.uid).status;
  assert.equal(status(draft.left[0]), "not-yours");
  assert.equal(context.items.get(draft.left[0].uid).ownerRosterId, 7);
  assert.equal(status(draft.right[0]), "already-yours");
  assert.equal(status(draft.right[1]), "generic");
  assert.equal(context.ready, false);
  assert.equal(context.canSwap, false, "a generic pick still would not fit after a swap");
  assert.equal(context.mismatched, 3);
  assert.match(draftTeamSummary(context, { leftCount: 1, rightCount: 2 }), /3 pieces do not fit yet[\s\S]*still counts every piece/);
});

test("team impact is ready only when you give yours and get from one team", () => {
  const draft = draftOf([gibbs, { assetId: "pick:2027:r1:5", name: "2027 1st from Zim", leagueId: "L1" }], [bijan]);
  const context = resolveDraftContext({ draft, rosters, meRosterId: ME, leagueId: "L1" });
  assert.equal(context.ready, true);
  assert.equal(context.partnerRosterId, "7");
  assert.equal(draftTeamSummary(context, { leftCount: 2, rightCount: 1, partnerName: "Chris" }), "With Chris.");

  const split = draftOf([gibbs], [bijan, warren]);
  const splitContext = resolveDraftContext({ draft: split, rosters, meRosterId: ME, leagueId: "L1" });
  assert.equal(splitContext.ready, false);
  assert.deepEqual(splitContext.partnerIds.sort(), ["7", "9"]);
  assert.equal(split.right.length, 2, "both pieces stay in the draft");
  assert.match(draftTeamSummary(splitContext, { leftCount: 1, rightCount: 2, splitNames: ["Chris", "Ben"] }), /Chris and Ben/);
});

test("no team picked yet asks for the team instead of calling anything yours", () => {
  const draft = draftOf([gibbs], [bijan]);
  const context = resolveDraftContext({ draft, rosters, meRosterId: null, leagueId: "L1" });
  assert.equal(context.needsTeam, true);
  assert.equal(context.ready, false);
  assert.match(draftTeamSummary(context, { leftCount: 1, rightCount: 1 }), /Choose your team/);
});

test("swap is offered only when swapping fixes every piece", () => {
  const backwards = draftOf([bijan], [gibbs]);
  const context = resolveDraftContext({ draft: backwards, rosters, meRosterId: ME, leagueId: "L1" });
  assert.equal(context.ready, false);
  assert.equal(context.canSwap, true);
  const swapped = swapValueCalcSides(backwards);
  assert.deepEqual(swapped.left.map((item) => item.assetId), ["player:9221"]);
  assert.deepEqual(swapped.right.map((item) => item.assetId), ["player:9509"]);
  assert.equal(resolveDraftContext({ draft: swapped, rosters, meRosterId: ME, leagueId: "L1" }).ready, true);
});

test("a league pick from another league is flagged, not read as this league's pick", () => {
  const draft = draftOf([{ assetId: "pick:2027:r1:5", name: "2027 1st from Zim", leagueId: "OLD" }], [bijan]);
  const context = resolveDraftContext({ draft, rosters, meRosterId: ME, leagueId: "NEW" });
  assert.equal(context.items.get(draft.left[0].uid).status, "other-league");
  assert.equal(context.ready, false);
  assert.match(describeDraftItem({ status: "other-league" }, { kind: "pick" }), /another league/);
});

test("review opens the same trade: give is yours, get is theirs, partner is their team", () => {
  const idea = {
    counterpartyRosterId: 7,
    myAssets: [{ assetId: "pick:2027:r1:5" }],
    theirAssets: [{ assetId: "player:9509" }],
  };
  const draft = draftFromReview(reviewPayloadFor(idea), { rosters, leagueId: "L1" });
  assert.deepEqual(draft.left.map((item) => [item.assetId, item.name, item.leagueId]), [["pick:2027:r1:5", "2027 1st from Zim", "L1"]]);
  assert.deepEqual(draft.right.map((item) => [item.assetId, item.name]), [["player:9509", "Bijan Robinson"]]);
  assert.equal(draft.partnerRosterId, 7);
  const context = resolveDraftContext({ draft, rosters, meRosterId: ME, leagueId: "L1" });
  assert.equal(context.ready, true);
  assert.equal(context.partnerRosterId, "7");
});

test("add to trade puts a player on the side his owner implies", () => {
  assert.deepEqual(draftSideForAsset("player:9221", { rosters, meRosterId: ME }), { side: "left", ownerRosterId: 3 });
  assert.deepEqual(draftSideForAsset("player:9509", { rosters, meRosterId: ME }), { side: "right", ownerRosterId: 7 });
  assert.deepEqual(draftSideForAsset("player:1", { rosters, meRosterId: ME }), { side: "left", ownerRosterId: null });
  assert.deepEqual(draftSideForAsset("player:9509", { rosters: [], meRosterId: null }), { side: "left", ownerRosterId: null });
});

test("connecting keeps the page the visitor was working on", () => {
  assert.deepEqual(placeAfterConnect({ activePage: "trades", tradesRoom: "calculator" }), { page: "trades", room: "calculator" });
  assert.deepEqual(placeAfterConnect({ activePage: "players", selectedAssetId: "player:9509" }), { page: "players", room: "ranks" });
  assert.equal(placeAfterConnect({ activePage: "players" }), null);
  const shared = { page: "league", room: "scores" };
  assert.equal(placeAfterConnect({ activePage: "trades", pendingPlace: shared }), shared);
});

test("the draft survives a reload in the same tab and rejects junk", () => {
  const store = new Map();
  const storage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  const draft = draftOf([gibbs, { assetId: "pick:2027:r1:5", name: "2027 1st from Zim", leagueId: "L1" }], [bijan]);
  draft.partnerRosterId = 7;
  assert.equal(writeStoredDraft(draft, storage), true);
  const back = readStoredDraft(storage);
  assert.deepEqual(back.left.map((item) => [item.assetId, item.name, item.leagueId || ""]), [
    ["player:9221", "Jahmyr Gibbs", ""],
    ["pick:2027:r1:5", "2027 1st from Zim", "L1"],
  ]);
  assert.deepEqual(back.right.map((item) => item.assetId), ["player:9509"]);
  assert.equal(back.partnerRosterId, 7);
  assert.ok(Number(back.nextUid) > 3);

  store.set(TRADE_DRAFT_STORAGE_KEY, "{not json");
  assert.equal(readStoredDraft(storage), null);
  store.set(TRADE_DRAFT_STORAGE_KEY, JSON.stringify({ v: 1, left: [{ assetId: "<img src=x>", name: "x" }], right: [] }));
  assert.deepEqual(readStoredDraft(storage).left, []);
  writeStoredDraft(emptyValueCalcState(), storage);
  assert.equal(store.has(TRADE_DRAFT_STORAGE_KEY), false);
  assert.match(serializeDraft(draft), /"v":1/);
});

test("calculator, Players, and league tools use the exact same canonical value", () => {
  const values = { "player:9221": 10321, "player:12508": 6000, "pick:2027:r1:mid": 6100 };
  const gibbs = { assetId: "player:9221", name: "Jahmyr Gibbs", assetType: "player", raw: { position: "RB" } };
  const te = { assetId: "player:12508", name: "Tyler Warren", assetType: "player", raw: { position: "TE" } };
  assert.equal(draftMarketPrice(gibbs, { values }).value, 10321);
  assert.equal(getAssetValue(gibbs, values), 10321);
  assert.equal(draftMarketPrice(te, { values, tep: 3, leagueShifts: { "player:12508": 0.25 } }).value, 6000);
  assert.equal(getAssetValue(te, values, { league: { scoring_settings: { bonus_rec_te: 1.5 } }, crowdShifts: { "player:12508": 0.08 }, leagueShifts: { "player:12508": 0.25 }, applyLeagueBoard: true }), 6000);
  const leaguePick = { assetId: "pick:2027:r1:5", name: "2027 1st", assetType: "pick", valueAssetId: "pick:2027:r1:mid", raw: { season: "2027", round: 1, ktcBucket: "mid" } };
  assert.equal(draftMarketPrice(leaguePick, { values }).value, 6100);
  const unknown = draftMarketPrice({ assetId: "player:1", name: "Nobody", assetType: "player", raw: { position: "WR", age: 24 } }, { values });
  assert.deepEqual(unknown, { value: 0, estimated: true });
});

test("one verdict: market totals stay visible, an uneven package gets a labeled credit", () => {
  const even = draftVerdictModel([10321], [9996], { globalMaxValue: 10321 });
  assert.equal(even.adjustment, null);
  assert.deepEqual([even.give, even.get, even.compareGive, even.compareGet], [10321, 9996, 10321, 9996]);
  assert.equal(even.verdict.label, "Dead even");

  const starForTwo = draftVerdictModel([10321], [7700, 7300], { globalMaxValue: 10321 });
  assert.deepEqual([starForTwo.give, starForTwo.get], [10321, 15000], "pane totals stay the plain market sums");
  assert.equal(starForTwo.adjustment.side, "left", "the side sending the best player gets the credit");
  assert.equal(starForTwo.compareGive, 10321 + starForTwo.adjustment.amount);
  assert.deepEqual(draftMeterValues(starForTwo), { give: 10321, get: 15000 });
  assert.equal(starForTwo.compareGet, 15000);
  assert.equal(valueCalcVerdict(10321, 15000).label, "Lopsided for Get", "raw sums alone would call this a steal");
  assert.notEqual(starForTwo.verdict.label, "Lopsided for Get");

  const oneSided = draftVerdictModel([10321], []);
  assert.equal(oneSided.adjustment, null);
  assert.equal(oneSided.verdict.label, "Add the other side");
  assert.deepEqual(draftVerdictModel([10321], [7700, 7300], { globalMaxValue: 10321 }), starForTwo, "same prices, same answer");
});

test("an explicit clear offers the saved draft back, and nothing else claims a clear", () => {
  const both = {
    left: [{ name: "Puka Nacua" }],
    right: [{ name: "Drake London" }],
  };
  const one = { left: [{ name: "Puka Nacua" }], right: [] };
  const empty = { left: [], right: [] };
  const filled = { left: [{ name: "Brock Bowers" }], right: [] };
  const cleared = draftNoticeText({ note: "Cleared both sides.", saved: both, current: empty });
  assert.equal(cleared, "Started a new trade. Restore your Puka Nacua for Drake London draft?");
  assert.equal(
    draftNoticeText({ note: "Cleared both sides.", saved: one, current: empty }),
    "Started a new trade. Restore your Puka Nacua for nothing draft?",
  );
  assert.equal(draftNoticeText({ note: "Cleared both sides.", saved: both, current: filled }), cleared);
  assert.doesNotMatch(cleared, /Cleared both sides/);
  assert.equal(draftNoticeText({ note: "Cleared both sides.", saved: empty, current: empty }), "");
  assert.match(draftNoticeText({ note: "Opened the trade with Chris.", saved: both, current: filled }), /Opened the trade with Chris\. Saved:/);
});

test("even-up only names a pick that can close the gap", () => {
  const wide = evenUpPickChoice(11000, [{ name: "2027 Early 1st", value: 6300 }]);
  assert.equal(wide.closes, false);
  assert.equal(wide.name, "2027 Early 1st");
  const close = evenUpPickChoice(7000, [
    { name: "2027 Early 1st", value: 6300 },
    { name: "2027 Late 1st", value: 4100 },
  ]);
  assert.equal(close.closes, true);
  assert.equal(close.name, "2027 Early 1st");
  assert.equal(evenUpPickChoice(0, [{ name: "2027 Early 1st", value: 6300 }]), null);
});

test("even-up rescores the pick after stud credit, and bad numbers stay finite", () => {
  const picks = [
    { name: "2027 Early 1st", value: 6361 },
    { name: "2027 Mid 1st", value: 4779 },
    { name: "2027 Late 1st", value: 4234 },
    { name: "2027 2nd", value: 1703 },
  ];
  const oneForOne = evenUpTradePick({
    giveValues: [9000],
    getValues: [4000],
    picks,
    globalMaxValue: 12000,
  });
  assert.equal(oneForOne.closes, false);
  const stillOpen = draftVerdictModel([9000], [4000, oneForOne.value], { globalMaxValue: 12000 });
  assert.ok(stillOpen.verdict.pct > 12, `claimed a close but left ${stillOpen.verdict.pct}%`);

  const packageDeal = evenUpTradePick({
    giveValues: [10000],
    getValues: [6000, 3000],
    picks,
    globalMaxValue: 12000,
  });
  assert.equal(packageDeal.closes, true);
  const closed = draftVerdictModel([10000], [6000, 3000, packageDeal.value], { globalMaxValue: 12000 });
  assert.ok(closed.verdict.pct <= 12, `pick did not close: ${closed.verdict.pct}%`);

  const flipped = evenUpTradePick({
    giveValues: [6000, 3000],
    getValues: [10000],
    picks,
    globalMaxValue: 12000,
  });
  assert.equal(flipped.name, packageDeal.name);
  assert.equal(flipped.closes, packageDeal.closes);
  assert.equal(flipped.value, packageDeal.value);

  const poisoned = draftVerdictModel([Infinity, NaN, -40], [100], { globalMaxValue: 1000 });
  assert.equal(poisoned.give, 0);
  assert.equal(Number.isFinite(poisoned.verdict.pct), true);
  assert.equal(Number.isFinite(poisoned.verdict.gap), true);
  const junk = calculatePackageAdjustment({
    myValues: [Infinity, -50, 100],
    theirValues: [NaN, 40],
    globalMaxValue: 1000,
  });
  assert.equal(junk.myBaseValue, 100);
  assert.equal(junk.theirBaseValue, 40);
  assert.equal(Number.isFinite(junk.packageAdjustment), true);

  const app = readFileSync(join(root, "docs/app.js"), "utf8");
  assert.match(app, /evenUpTradePick\(/);
});

test("the verdict reads from the manager's seat", () => {
  assert.equal(draftVerdictLabel(valueCalcVerdict(9000, 11100), { them: "Chris" }), "Favors you");
  assert.equal(draftVerdictLabel(valueCalcVerdict(11100, 9000), { them: "Chris" }), "Favors Chris");
  assert.equal(draftVerdictLabel(valueCalcVerdict(10000, 10200)), "Dead even");
  assert.equal(draftVerdictLabel(valueCalcVerdict(20000, 9000)), "Lopsided for them");
});

test("a zero-value piece does not mint stud credit or hide a real side", () => {
  const withGhost = draftVerdictModel([10000, 0], [9000], { globalMaxValue: 10000 });
  const clean = draftVerdictModel([10000], [9000], { globalMaxValue: 10000 });
  assert.equal(withGhost.adjustment, null);
  assert.equal(withGhost.verdict.label, clean.verdict.label);
  assert.equal(withGhost.verdict.label, "Fair, leans Give");
  const missing = draftVerdictModel([0], [9000], { globalMaxValue: 9000 });
  assert.equal(missing.give, 0);
  assert.equal(missing.verdict.label, "Lopsided for Get");
  assert.equal(valueCalcVerdict(0, 9000).label, "Add the other side");
  const empty = draftVerdictModel([], [], { globalMaxValue: 1 });
  assert.equal(empty.verdict.label, "Add both sides");
  const tiny = draftVerdictModel([1], [1], { globalMaxValue: 1 });
  assert.equal(tiny.verdict.label, "Dead even");
});

test("verdict bands stay on the rounded tenth, both directions", () => {
  const band = (pct) => {
    if (pct <= 5) return /Dead even/;
    if (pct <= 12) return /Fair/;
    if (pct <= 22) return /Favors/;
    return /Lopsided/;
  };
  for (let right = 1; right <= 4000; right += 41) {
    const verdict = valueCalcVerdict(1000, right);
    const pct = Math.round((Math.abs(right - 1000) / Math.max(1000, right, 1)) * 1000) / 10;
    assert.equal(verdict.pct, pct);
    assert.match(verdict.label, band(pct));
    const flipped = valueCalcVerdict(right, 1000);
    assert.equal(flipped.pct, pct);
    if (pct > 5) assert.notEqual(verdict.label, flipped.label);
  }
  assert.equal(valueCalcVerdict(10000, 10526).label, "Dead even");
  assert.equal(valueCalcVerdict(10000, 12821).label, "Favors Get");
  assert.equal(valueCalcVerdict(10000, 12829).label, "Lopsided for Get");
});

test("restore drops duplicate players, keeps repeated generic picks, and reads an old unversioned draft", () => {
  const stored = restoreDraft(JSON.stringify({
    v: 1,
    left: [
      { assetId: "player:9509", name: "Bijan Robinson", value: 1 },
      { assetId: "player:9509", name: "Bijan again" },
      { assetId: "pick:2027:r1:early", name: "2027 Early 1st" },
      { assetId: "pick:2027:r1:early", name: "2027 Early 1st" },
    ],
    right: [
      { id: "player:9509", name: "Bijan on the other side", value: 99999 },
      { assetId: "pick:2027:r1:5", name: "2027 1st", leagueId: "L1" },
      { assetId: "pick:2027:r1:5", name: "same pick", leagueId: "L1" },
      { assetId: "pick:2027:r1:5", name: "other league", leagueId: "L2" },
    ],
  }));
  assert.deepEqual(stored.left.map((item) => item.assetId), ["player:9509", "pick:2027:r1:early", "pick:2027:r1:early"]);
  assert.equal("value" in stored.left[0], false);
  assert.deepEqual(stored.right.map((item) => [item.assetId, item.leagueId || ""]), [
    ["pick:2027:r1:5", "L1"],
    ["pick:2027:r1:5", "L2"],
  ]);

  const old = restoreDraft(JSON.stringify({
    give: [{ assetId: "player:9221", name: "Jahmyr Gibbs" }],
    get: [{ assetId: "player:9509", name: "Bijan Robinson" }],
    partnerRosterId: 7,
  }));
  assert.deepEqual(old.left.map((item) => item.assetId), ["player:9221"]);
  assert.deepEqual(old.right.map((item) => item.assetId), ["player:9509"]);
  assert.equal(old.partnerRosterId, 7);
  assert.equal(restoreDraft(JSON.stringify({ v: 2, left: [{ assetId: "player:9509", name: "Bijan" }] })), null);

  const session = new Map();
  const local = new Map();
  const storage = {
    getItem: (key) => (session.has(key) ? session.get(key) : null),
    setItem: (key, value) => session.set(key, String(value)),
    removeItem: (key) => session.delete(key),
  };
  const legacy = {
    getItem: (key) => (local.has(key) ? local.get(key) : null),
    setItem: (key, value) => local.set(key, String(value)),
    removeItem: (key) => local.delete(key),
  };
  local.set("dynasty_ticker_trade_draft", JSON.stringify({
    left: [{ assetId: "player:9221", name: "Jahmyr Gibbs" }],
    right: [],
  }));
  const fromLocal = readStoredDraft(storage, legacy);
  assert.equal(fromLocal.left[0].name, "Jahmyr Gibbs");
  session.set(TRADE_DRAFT_STORAGE_KEY, "{not json");
  assert.equal(readStoredDraft(storage, legacy).left[0].assetId, "player:9221");
});

test("an empty league and a one-player roster do not invent a partner", () => {
  const lone = [{
    rosterId: 1,
    manager: { displayName: "Solo" },
    assets: [{ assetId: "player:9509", name: "Bijan Robinson", assetType: "player" }],
  }];
  const draft = draftOf([bijan], [genericFirst]);
  const emptyLeague = resolveDraftContext({ draft, rosters: [], meRosterId: 1, leagueId: "L1" });
  assert.equal(emptyLeague.ready, false);
  assert.equal(emptyLeague.items.get(draft.left[0].uid).status, "unrostered");
  const tiny = resolveDraftContext({ draft, rosters: lone, meRosterId: 1, leagueId: "L1" });
  assert.equal(tiny.items.get(draft.left[0].uid).status, "ok");
  assert.equal(tiny.items.get(draft.right[0].uid).status, "generic");
  assert.equal(tiny.ready, false);

  const third = {
    rosterId: 11,
    manager: { displayName: "Pat" },
    assets: [{ assetId: "player:4881", name: "Justin Jefferson", assetType: "player" }],
  };
  const jj = { assetId: "player:4881", name: "Justin Jefferson" };
  const three = draftOf([gibbs], [bijan, warren, jj]);
  const context = resolveDraftContext({ draft: three, rosters: [...rosters, third], meRosterId: ME, leagueId: "L1" });
  assert.equal(context.ready, false);
  assert.equal(context.partnerIds.length, 3);
  assert.match(draftTeamSummary(context, { leftCount: 1, rightCount: 3, splitNames: ["Chris", "Ben", "Pat"] }), /Chris and Ben and Pat|more than one team/);
});

test("league load keeps the draft and there is one calculator", () => {
  const app = readFileSync(join(root, "docs/app.js"), "utf8");
  const start = app.indexOf("async function runLeagueLoad(");
  const end = app.indexOf("\nfunction resetSeasonState(", start);
  const body = app.slice(start, end);
  assert.ok(start > 0 && end > start, "runLeagueLoad not found");
  assert.doesNotMatch(body, /state\.valueCalc\s*=/, "league load must not replace the trade draft");
  assert.match(app, /draftNoticeText\(/);
  assert.match(app, /draftMeterValues\(/);
  assert.doesNotMatch(app, /weights stars above the market/);
  assert.doesNotMatch(body, /emptyValueCalcState\(\)|resetCalculatorState/, "league load must not clear the trade draft");
  assert.doesNotMatch(app, /state\.calc\./, "the roster-only calculator state is gone");
  const index = siteMarkup();
  assert.equal((index.match(/class="calculator-shell"/g) || []).length, 1);
});
