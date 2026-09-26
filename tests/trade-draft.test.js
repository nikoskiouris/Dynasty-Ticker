import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  draftSideForAsset,
  draftTeamSummary,
  draftVerdictModel,
  placeAfterConnect,
  readStoredDraft,
  resolveDraftContext,
  reviewPayloadFor,
  serializeDraft,
  writeStoredDraft,
} from "../docs/modules/trade-draft.js";
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

test("calculator price is the Players page price; the league star premium stays out", () => {
  const values = { "player:9221": 10321, "player:12508": 6000, "pick:2027:r1:mid": 6100 };
  const star = { assetId: "player:9221", name: "Jahmyr Gibbs", assetType: "player", raw: { position: "RB" } };
  assert.equal(draftMarketPrice(star, { values }).value, 10321);
  assert.ok(getAssetValue(star, values) > 13000, "league tools still apply the star premium");
  const te = { assetId: "player:12508", name: "Tyler Warren", assetType: "player", raw: { position: "TE" } };
  assert.equal(draftMarketPrice(te, { values }).value, 6000);
  assert.equal(draftMarketPrice(te, { values, tep: 2 }).value, 6720);
  assert.equal(draftMarketPrice(star, { values, tep: 2 }).value, 10321, "TE premium only touches tight ends");
  const leaguePick = { assetId: "pick:2027:r1:5", name: "2027 1st", assetType: "pick", valueAssetId: "pick:2027:r1:mid", raw: { season: "2027", round: 1, ktcBucket: "mid" } };
  assert.equal(draftMarketPrice(leaguePick, { values }).value, 6100);
  const unknown = draftMarketPrice({ assetId: "player:1", name: "Nobody", assetType: "player", raw: { position: "WR", age: 24 } }, { values });
  assert.equal(unknown.estimated, true);
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
  assert.equal(starForTwo.compareGet, 15000);
  assert.equal(valueCalcVerdict(10321, 15000).label, "Lopsided for Get", "raw sums alone would call this a steal");
  assert.notEqual(starForTwo.verdict.label, "Lopsided for Get");

  const oneSided = draftVerdictModel([10321], []);
  assert.equal(oneSided.adjustment, null);
  assert.equal(oneSided.verdict.label, "Add the other side");
  assert.deepEqual(draftVerdictModel([10321], [7700, 7300], { globalMaxValue: 10321 }), starForTwo, "same prices, same answer");
});

test("the verdict reads from the manager's seat", () => {
  assert.equal(draftVerdictLabel(valueCalcVerdict(9000, 11100), { them: "Chris" }), "Favors you");
  assert.equal(draftVerdictLabel(valueCalcVerdict(11100, 9000), { them: "Chris" }), "Favors Chris");
  assert.equal(draftVerdictLabel(valueCalcVerdict(10000, 10200)), "Dead even");
  assert.equal(draftVerdictLabel(valueCalcVerdict(20000, 9000)), "Lopsided for them");
});

test("league load keeps the draft and there is one calculator", () => {
  const app = readFileSync(join(root, "docs/app.js"), "utf8");
  const start = app.indexOf("async function runLeagueLoad(");
  const end = app.indexOf("\nfunction resetSeasonState(", start);
  const body = app.slice(start, end);
  assert.ok(start > 0 && end > start, "runLeagueLoad not found");
  assert.doesNotMatch(body, /state\.valueCalc\s*=/, "league load must not replace the trade draft");
  assert.doesNotMatch(body, /emptyValueCalcState\(\)|resetCalculatorState/, "league load must not clear the trade draft");
  assert.doesNotMatch(app, /state\.calc\./, "the roster-only calculator state is gone");
  const index = readFileSync(join(root, "docs/index.html"), "utf8");
  assert.equal((index.match(/class="calculator-shell"/g) || []).length, 1);
});
