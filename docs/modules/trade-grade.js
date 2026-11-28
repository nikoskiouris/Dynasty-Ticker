import { archivedPackageRules } from "./archive-package-rules.js";
import { slotToRosterIdFromDraft } from "./draft-picks.js";
import { priceStamp } from "./trade-share.js";
import { STALE_AFTER_DAYS } from "./value-scale.js";
import { roundPrice } from "./price-units.js";
import { calculatePackageAdjustment } from "./package-value.js";
import { getGlobalMaxPlayerValue, resolvePickAssetValue, snapshotPrices } from "./values.js";
import { percentMore, tierForMore } from "./verdict-copy.js";

// Ticket 038. All prices are from the one 12-team Superflex PPR board.
// Grade table, on the SAME credited totals and % more as Trade Calculator:
//   Even (<=5%): B/B; Close (<=14%): B+/B-; Unfair (<=28%): A-/C;
//   Lopsided (<=60%): A/D; Lopsided (>60%): A+/F.
// These grades describe today's asset value, not a prediction that a trade
// will work out. A missing price never becomes a free asset worth zero.
const LETTERS = Object.freeze({
  even: ["B", "B"],
  edge: ["B+", "B-"],
  favors: ["A-", "C"],
  lopsided: ["A", "D"],
  severe: ["A+", "F"],
});

const id = (value) => String(value ?? "").trim();
const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const mapFor = (values) => object(values?.sf || values);
const isPrice = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;
const asMillis = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : Number.NaN;
};
const ordinal = (n) => {
  const value = Number(n);
  return `${value}${value % 100 >= 11 && value % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][value % 10] || "th"}`;
};

// Require a snapshot on or before the trade; never borrow a newer price.
export function priceSnapshotForTrade(history, trade) {
  const when = asMillis(trade?.created);
  if (!Number.isFinite(when)) return null;
  const snapshots = Array.isArray(history) ? history : Array.isArray(history?.snapshots) ? history.snapshots : [];
  return snapshots
    .filter((row) => {
      const date = Date.parse(row?.asOf || row?.date || "");
      return Number.isFinite(date) && date <= when && when - date <= STALE_AFTER_DAYS * 86400000
        && row?.sf && typeof row.sf === "object";
    })
    .sort((a, b) => Date.parse(b.asOf || b.date) - Date.parse(a.asOf || a.date))[0] || null;
}

function hindsightPick(asset, archive, tradedAt) {
  const entry = (archive?.seasons || []).find((item) => id(item.season) === asset.season);
  const drafts = archive?.drafts?.[asset.season] || [];
  const possible = drafts.filter((draft) =>
    !(Number(draft.last_picked) < tradedAt && Number(draft.last_picked) > 0 && draft.status === "complete")
    && !(Number(draft.settings?.rounds) > 0 && Number(draft.settings.rounds) < asset.round)
  );
  if (possible.length === 1 && asset.originalRosterId) {
    const draft = possible[0];
    const slots = slotToRosterIdFromDraft(draft, entry?.rosters);
    const selected = (draft.picks || []).find((pick) =>
      Number(pick.round) === asset.round && id(slots[pick.draft_slot]) === asset.originalRosterId
    );
    if (selected?.player_id) return { draftedPlayerId: id(selected.player_id) };
  }
  // Multiple drafts can contain the same round and original slot. An
  // unresolved selection in a finished draft cannot be sold as a future pick.
  const seasonDrafts = drafts.length ? drafts : entry?.drafts || [];
  const currentSeason = Number(archive?.seasons?.[0]?.season || new Date().getUTCFullYear());
  const missingDraft = Number(asset.season) < currentSeason
    || possible.length > 1 || seasonDrafts.some((draft) => draft.status === "complete");
  return { missingDraft };
}

// Sleeper's adds names the new owner; drops names the old owner.
// A draft pick's roster_id is its ORIGINAL owner, previous_owner_id sends it,
// owner_id receives it. Do not assign a pick to its original owner by mistake.
export function tradeAssets(trade) {
  const rosterIds = new Set((trade?.roster_ids || []).map(id).filter(Boolean));
  const assets = [];
  for (const [playerId, receiver] of Object.entries(object(trade?.adds))) {
    const recipient = id(receiver);
    const sender = id(object(trade?.drops)[playerId]);
    if (recipient) rosterIds.add(recipient);
    if (sender) rosterIds.add(sender);
    assets.push({ kind: "player", assetId: `player:${playerId}`, playerId: id(playerId), sender, receiver: recipient });
  }
  // A missing adds record is an incomplete transaction, not a zero-value gift.
  for (const [playerId, sender] of Object.entries(object(trade?.drops))) {
    if (Object.prototype.hasOwnProperty.call(object(trade?.adds), playerId)) continue;
    const from = id(sender);
    if (from) rosterIds.add(from);
    assets.push({ kind: "player", assetId: `player:${playerId}`, playerId: id(playerId), sender: from, receiver: "" });
  }
  for (const pick of trade?.draft_picks || []) {
    const sender = id(pick.previous_owner_id);
    const receiver = id(pick.owner_id);
    if (sender) rosterIds.add(sender);
    if (receiver) rosterIds.add(receiver);
    const season = id(pick.season);
    const round = Number(pick.round);
    assets.push({
      kind: "pick",
      assetId: `pick:${season}:r${round}:any`,
      season, round, originalRosterId: id(pick.roster_id), sender, receiver,
      name: `${season} ${ordinal(round)}`,
    });
  }
  return { rosterIds: [...rosterIds], assets };
}

function assetPrice(asset, values, { basis, archive, valueNames, tradedAt }) {
  const prices = mapFor(values);
  if (asset.kind === "player") {
    const price = prices[asset.assetId];
    return { price: isPrice(price) ? price : null, pricedAs: asset.assetId };
  }
  if (asset.kind !== "pick" || !asset.season || !Number.isFinite(asset.round)) {
    return { price: null, pricedAs: "" };
  }
  // Hindsight: a used pick is the specific drafted player, not a generic pick.
  // At-time: the draft outcome was not known; use that day's pick market price.
  if (basis === "today") {
    const { draftedPlayerId, missingDraft } = hindsightPick(asset, archive, tradedAt);
    if (draftedPlayerId) {
      const pricedAs = `player:${draftedPlayerId}`;
      const price = prices[pricedAs];
      return { price: isPrice(price) ? price : null, pricedAs, draftedPlayerId };
    }
    if (missingDraft) return { price: null, pricedAs: "", missingDraft };
  }
  const pick = { assetType: "pick", assetId: asset.assetId,
    raw: { season: asset.season, round: asset.round, ktcBucket: "any" } };
  const price = resolvePickAssetValue(pick, prices, object(valueNames));
  return { price: isPrice(price) ? price : null, pricedAs: asset.assetId };
}

function gradeLetters(gapPct, winner) {
  const tier = tierForMore(gapPct);
  const pair = gapPct > 60 ? LETTERS.severe : LETTERS[tier];
  return { tier, letter: winner ? pair[0] : pair[1] };
}

export function gradeTrade(trade, {
  values = {}, valueNames = {}, archive = null, history = null, basis = "today",
} = {}) {
  const label = basis === "at-time" ? "Value at the time" : "Today's value (hindsight)";
  const notes = ["Graded using 12-team Superflex PPR dynasty values."];
  if (trade?.type !== "trade" || trade?.status !== "complete") {
    return { available: false, basis: label, reason: "Only completed trades can be graded", sides: [], notes };
  }
  const snapshot = basis === "at-time" ? priceSnapshotForTrade(history, trade) : null;
  const board = snapshot && snapshotPrices(snapshot);
  if (basis === "at-time" && !board) {
    return { available: false, basis: label, reason: "No price from that date", sides: [], notes };
  }
  const prices = board?.values || mapFor(values);
  const stamp = priceStamp(snapshot?.asOf || snapshot?.date);
  const packageRules = board ? archivedPackageRules({ stamp }, stamp, board.sourceScale, snapshot.modelVersion) : undefined;
  if (board) notes.push(`Prices as of ${snapshot.asOf || snapshot.date}.`);
  if (packageRules?.note) notes.push(packageRules.note);
  const { rosterIds, assets } = tradeAssets(trade);
  const context = { basis, archive, valueNames: board?.nameMap || valueNames, tradedAt: asMillis(trade.created) };
  const priced = assets.map((asset) => ({
    ...asset, ...assetPrice(asset, prices, context),
  }));
  const unresolved = priced.filter((asset) => !asset.sender || !asset.receiver || asset.sender === asset.receiver);
  const unpriced = priced.filter((asset) => !isPrice(asset.price));
  if (unpriced.some((asset) => asset.missingDraft)) notes.push("A traded pick could not be matched to a unique draft selection.");
  const usedPicks = priced.filter((asset) => asset.draftedPlayerId).length;
  if (usedPicks) notes.push(`${usedPicks} pick${usedPicks === 1 ? "" : "s"} valued as the player later drafted.`);
  const hasFaab = (trade.waiver_budget || []).some((item) => Number(item.amount) > 0);
  if (hasFaab) notes.push("FAAB has no published dynasty price.");
  if (unresolved.length) notes.push(`${unresolved.length} asset${unresolved.length === 1 ? " has" : "s have"} an unresolved transfer.`);
  if (unpriced.length) notes.push(`${unpriced.length} asset${unpriced.length === 1 ? " has" : "s have"} no published price for this lens.`);
  const sides = rosterIds.map((rosterId) => {
    const received = priced.filter((asset) => asset.receiver === rosterId);
    const sent = priced.filter((asset) => asset.sender === rosterId);
    return {
      rosterId, received, sent,
      listedReceived: roundPrice(received.reduce((sum, item) => sum + (item.price || 0), 0)),
      listedSent: roundPrice(sent.reduce((sum, item) => sum + (item.price || 0), 0)),
      faabReceived: (trade.waiver_budget || []).filter((item) => id(item.receiver) === rosterId).reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
      faabSent: (trade.waiver_budget || []).filter((item) => id(item.sender) === rosterId).reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    };
  });
  if (hasFaab) return { available: false, basis: label, reason: "Trade includes unpriced FAAB", sides, notes };
  if (rosterIds.length < 2 || !assets.length || unresolved.length || unpriced.length
      || sides.some((side) => !side.received.length || !side.sent.length)) {
    return { available: false, basis: label, reason: unpriced.length ? "Some assets have no published price" : "Incomplete trade data", sides, notes };
  }
  let packageAdjustment = 0;
  if (sides.length === 2) {
    const first = sides[0].received.map((item) => item.price);
    const second = sides[1].received.map((item) => item.price);
    const adjusted = calculatePackageAdjustment({
      myValues: first, theirValues: second,
      globalMaxValue: getGlobalMaxPlayerValue(prices),
    }, packageRules);
    sides[0].valueReceived = roundPrice(adjusted.myAdjustedValue);
    sides[1].valueReceived = roundPrice(adjusted.theirAdjustedValue);
    sides[0].valueSent = sides[1].valueReceived;
    sides[1].valueSent = sides[0].valueReceived;
    packageAdjustment = adjusted.packageAdjustment;
  } else {
    // There is no meaningful two-package consolidation bonus in a 3+ team trade.
    sides.forEach((side) => {
      side.valueReceived = side.listedReceived;
      side.valueSent = side.listedSent;
    });
    notes.push("Multi-team grades compare each team's received and sent values without a two-side package bonus.");
  }
  sides.forEach((side) => { side.net = roundPrice(side.valueReceived - side.valueSent); });
  const gapPct = sides.length === 2
    ? percentMore(sides[0].valueReceived, sides[1].valueReceived, packageRules)
    : null;
  const tier = sides.length === 2 ? tierForMore(gapPct) : "multi-team";
  const maxNet = Math.max(...sides.map((side) => side.net));
  const winnerRosterId = maxNet > 0 && sides.filter((side) => side.net === maxNet).length === 1
    ? sides.find((side) => side.net === maxNet)?.rosterId : null;
  sides.forEach((side) => {
    const more = sides.length === 2 ? gapPct : percentMore(side.valueReceived, side.valueSent, packageRules);
    const letter = gradeLetters(more, side.net > 0);
    side.gapPct = more;
    side.tier = letter.tier;
    side.grade = letter.letter;
    side.letter = letter.letter;
  });
  if (packageAdjustment > 0) notes.push(`Includes +${packageAdjustment.toLocaleString()} for fewer, better pieces.`);
  return { available: true, basis: label, sides, winnerRosterId, gapPct, tier, packageAdjustment, notes };
}
