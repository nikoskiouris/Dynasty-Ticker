import { calculatePackageAdjustment } from "./package-value.js";
import { getGlobalMaxPlayerValue, resolvePickAssetValue } from "./values.js";
import { percentMore, tierForMore } from "./verdict-copy.js";

// Ticket 038. All prices are from the one 12-team Superflex PPR board.
// Grade table, on the SAME credited totals and % more as Trade Calc:
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
const roundValue = (value) => Math.round((Number(value) || 0) * 100) / 100;
const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const mapFor = (values) => object(values?.sf || values);
const isPrice = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;
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
      return Number.isFinite(date) && date <= when && row?.sf && typeof row.sf === "object";
    })
    .sort((a, b) => Date.parse(b.asOf || b.date) - Date.parse(a.asOf || a.date))[0] || null;
}

function completedPick(draftPick, archive) {
  const season = id(draftPick?.season);
  const originalRosterId = id(draftPick?.roster_id);
  const round = Number(draftPick?.round);
  if (!season || !originalRosterId || !Number.isFinite(round)) return null;
  const drafts = archive?.drafts?.[season] || [];
  const entry = (archive?.seasons || []).find((item) => id(item.season) === season);
  for (const draft of drafts) {
    const order = object(draft.draft_order);
    const draftSlot = Object.entries(order).find(([userId]) =>
      (entry?.rosters || []).some((roster) =>
        id(roster.roster_id) === originalRosterId &&
        (id(roster.owner_id) === userId || (roster.co_owners || []).map(id).includes(userId))
      )
    )?.[1];
    if (draftSlot == null) continue; // Never guess a traded pick's original owner.
    const selected = (draft.picks || []).find((pick) =>
      Number(pick.round) === round && Number(pick.draft_slot) === Number(draftSlot)
    );
    if (selected?.player_id) return id(selected.player_id);
  }
  return null;
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

function assetPrice(asset, values, { basis, archive, valueNames }) {
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
  const draftedId = basis === "today" ? completedPick({
    season: asset.season, round: asset.round, roster_id: asset.originalRosterId,
  }, archive) : null;
  if (draftedId) {
    const price = prices[`player:${draftedId}`];
    return { price: isPrice(price) ? price : null, pricedAs: `player:${draftedId}`, draftedPlayerId: draftedId };
  }
  // A pick from an earlier year that cannot be linked to its original
  // drafting slot cannot be safely repriced using a future-pick estimate.
  const currentSeason = Number(archive?.seasons?.[0]?.season || new Date().getUTCFullYear());
  if (basis === "today" && Number(asset.season) < currentSeason) {
    return { price: null, pricedAs: "", missingDraft: true };
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
  if (basis === "at-time" && !snapshot) {
    return { available: false, basis: label, reason: "No price from that date", sides: [], notes };
  }
  const { rosterIds, assets } = tradeAssets(trade);
  const priced = assets.map((asset) => ({
    ...asset, ...assetPrice(asset, snapshot?.sf || values, { basis, archive, valueNames }),
  }));
  const unresolved = priced.filter((asset) => !asset.sender || !asset.receiver || !rosterIds.includes(asset.sender) || !rosterIds.includes(asset.receiver));
  const unpriced = priced.filter((asset) => !isPrice(asset.price));
  const usedPicks = priced.filter((asset) => asset.draftedPlayerId).length;
  if (usedPicks) notes.push(`${usedPicks} pick${usedPicks === 1 ? "" : "s"} valued as the player later drafted.`);
  if ((trade.waiver_budget || []).length) notes.push("FAAB transfers are shown but not assigned a player value.");
  if (unresolved.length) notes.push(`${unresolved.length} asset${unresolved.length === 1 ? " has" : "s have"} an unknown sending or receiving team.`);
  if (unpriced.length) notes.push(`${unpriced.length} asset${unpriced.length === 1 ? " has" : "s have"} no published price for this lens.`);
  const sides = rosterIds.map((rosterId) => {
    const received = priced.filter((asset) => asset.receiver === rosterId);
    const sent = priced.filter((asset) => asset.sender === rosterId);
    return {
      rosterId, received, sent,
      listedReceived: roundValue(received.reduce((sum, item) => sum + (item.price || 0), 0)),
      listedSent: roundValue(sent.reduce((sum, item) => sum + (item.price || 0), 0)),
      faabReceived: (trade.waiver_budget || []).filter((item) => id(item.receiver) === rosterId).reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
      faabSent: (trade.waiver_budget || []).filter((item) => id(item.sender) === rosterId).reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    };
  });
  if (rosterIds.length < 2 || !assets.length || unresolved.length || unpriced.length) {
    return { available: false, basis: label, reason: unpriced.length ? "Some assets have no published price" : "Incomplete trade data", sides, notes };
  }
  let packageAdjustment = 0;
  if (sides.length === 2) {
    const first = sides[0].received.map((item) => item.price);
    const second = sides[1].received.map((item) => item.price);
    const adjusted = calculatePackageAdjustment({
      myValues: first, theirValues: second,
      globalMaxValue: getGlobalMaxPlayerValue(mapFor(snapshot?.sf || values)),
    });
    sides[0].valueReceived = roundValue(adjusted.myAdjustedValue);
    sides[1].valueReceived = roundValue(adjusted.theirAdjustedValue);
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
  sides.forEach((side) => { side.net = roundValue(side.valueReceived - side.valueSent); });
  const gapPct = sides.length === 2
    ? percentMore(sides[0].valueReceived, sides[1].valueReceived)
    : null;
  const tier = sides.length === 2 ? tierForMore(gapPct) : "multi-team";
  const maxNet = Math.max(...sides.map((side) => side.net));
  const winnerRosterId = maxNet > 0 && sides.filter((side) => side.net === maxNet).length === 1
    ? sides.find((side) => side.net === maxNet)?.rosterId : null;
  sides.forEach((side) => {
    const more = sides.length === 2 ? gapPct : percentMore(side.valueReceived, side.valueSent);
    const letter = gradeLetters(more, side.net > 0);
    side.gapPct = more;
    side.tier = letter.tier;
    side.grade = letter.letter;
    side.letter = letter.letter;
  });
  if (packageAdjustment > 0) notes.push(`Includes ${Math.round(packageAdjustment)} for fewer, better pieces in the credited trade totals; listed player prices do not change.`);
  return { available: true, basis: label, sides, winnerRosterId, gapPct, tier, packageAdjustment, notes };
}
