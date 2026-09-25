import {
  addValueCalcItem,
  emptyValueCalcState,
  isLeaguePickAssetId,
  valueCalcVerdict,
} from "./value-calc.js";
import { calculatePackageAdjustment } from "./package-value.js";
import {
  LEAGUE_BOARD_ESTIMATED_SCALE,
  applyLeagueShift,
  lookupMarketValue,
  playerPositionForAsset,
  tepMultiplier,
} from "./values.js";

export const TRADE_DRAFT_STORAGE_KEY = "dynasty_ticker_trade_draft_v1";

// One price for the calculator, with or without a league: the Players page market price
// in the active format. A TE premium league or an applied league board are the only
// adjustments, and the caller labels both. The star premium used by league tools is not
// part of this number.
export function draftMarketPrice(asset, { values = {}, nameMap = {}, catalog = null, tep = 0, leagueShifts = null } = {}) {
  const lookup = lookupMarketValue(asset, values, nameMap, catalog);
  let value = Number(lookup.value) || 0;
  if (tep && asset?.assetType === "player" && playerPositionForAsset(asset) === "TE") {
    value = value * tepMultiplier(tep);
  }
  if (leagueShifts) {
    value = applyLeagueShift(String(asset?.assetId || ""), Math.round(value), leagueShifts, {
      scale: lookup.estimated ? LEAGUE_BOARD_ESTIMATED_SCALE : 1,
    });
  }
  return { value: Math.round(value), estimated: Boolean(lookup.estimated) };
}

const DRAFT_ASSET_ID = /^(?:player:[A-Za-z0-9_.-]+|pick:\d{4}:r\d+:[A-Za-z0-9_-]+)$/;

// The one verdict, with or without a league. Pane totals stay the plain market sums; an
// uneven package adds a visible consolidation credit to the side with the best player,
// and the verdict compares those adjusted totals.
export function draftVerdictModel(giveValues = [], getValues = [], { globalMaxValue = 9999 } = {}) {
  const clean = (list) => (Array.isArray(list) ? list : []).map((value) => Math.max(0, Number(value) || 0));
  const giveList = clean(giveValues);
  const getList = clean(getValues);
  const give = Math.round(giveList.reduce((sum, value) => sum + value, 0));
  const get = Math.round(getList.reduce((sum, value) => sum + value, 0));
  const pkg = giveList.length && getList.length
    ? calculatePackageAdjustment({ myValues: giveList, theirValues: getList, globalMaxValue })
    : null;
  const adjustment = pkg?.packageAdjustment > 0
    ? { amount: pkg.packageAdjustment, side: pkg.packageAdjustmentSide === "my" ? "left" : "right" }
    : null;
  const compareGive = give + (adjustment?.side === "left" ? adjustment.amount : 0);
  const compareGet = get + (adjustment?.side === "right" ? adjustment.amount : 0);
  return { give, get, compareGive, compareGet, adjustment, verdict: valueCalcVerdict(compareGive, compareGet) };
}

export function isDraftEmpty(draft) {
  return !draft?.left?.length && !draft?.right?.length;
}

export function draftOwnerIndex(rosters = []) {
  const index = new Map();
  for (const roster of Array.isArray(rosters) ? rosters : []) {
    for (const asset of roster?.assets || []) {
      const id = String(asset?.assetId || "");
      if (id && !index.has(id)) index.set(id, { rosterId: roster.rosterId, asset });
    }
  }
  return index;
}

function draftItemStatus(item, side, { index, me, leagueId }) {
  const id = String(item?.assetId || "");
  if (isLeaguePickAssetId(id) && item?.leagueId && String(item.leagueId) !== String(leagueId || "")) {
    return { status: "other-league", ownerRosterId: null, asset: null };
  }
  const hit = index.get(id);
  if (!hit) {
    const generic = id.startsWith("pick:") && !isLeaguePickAssetId(id);
    return { status: generic ? "generic" : "unrostered", ownerRosterId: null, asset: null };
  }
  const mine = me !== "" && String(hit.rosterId) === me;
  if (side === "left") return { status: mine ? "ok" : "not-yours", ownerRosterId: hit.rosterId, asset: hit.asset };
  return { status: mine ? "already-yours" : "ok", ownerRosterId: hit.rosterId, asset: hit.asset };
}

// Reads a draft against the loaded league without changing it. Team impact is only
// honest when every piece you give is yours and every piece you get sits on one roster.
export function resolveDraftContext({ draft, rosters = [], meRosterId = null, leagueId = "" } = {}) {
  const index = draftOwnerIndex(rosters);
  const me = meRosterId == null || meRosterId === "" ? "" : String(meRosterId);
  const left = Array.isArray(draft?.left) ? draft.left : [];
  const right = Array.isArray(draft?.right) ? draft.right : [];
  const options = { index, me, leagueId };
  const items = new Map();
  const partners = new Set();
  left.forEach((item) => items.set(String(item.uid), { side: "left", ...draftItemStatus(item, "left", options) }));
  right.forEach((item) => {
    const row = { side: "right", ...draftItemStatus(item, "right", options) };
    items.set(String(item.uid), row);
    if (row.status === "ok") partners.add(String(row.ownerRosterId));
  });
  const rows = [...items.values()];
  const partnerIds = [...partners];
  const mismatched = rows.filter((row) => row.status !== "ok").length;
  const needsTeam = me === "";
  const ready = !needsTeam && left.length > 0 && right.length > 0 && mismatched === 0 && partnerIds.length === 1;
  const preferred = draft?.partnerRosterId != null && draft.partnerRosterId !== "" && String(draft.partnerRosterId) !== me
    ? String(draft.partnerRosterId)
    : "";
  const partnerRosterId = partnerIds.length === 1 ? partnerIds[0] : (partnerIds.length === 0 ? preferred : "");
  const statusOf = (item) => items.get(String(item.uid))?.status;
  const giveOwners = new Set(left.map((item) => String(items.get(String(item.uid))?.ownerRosterId ?? "")));
  const canSwap = !needsTeam && left.length > 0 && right.length > 0
    && right.every((item) => statusOf(item) === "already-yours")
    && left.every((item) => statusOf(item) === "not-yours")
    && giveOwners.size === 1;
  return { ready, needsTeam, partnerRosterId, partnerIds, items, mismatched, canSwap, index };
}

export function describeDraftItem(row, { ownerName = "", kind = "player" } = {}) {
  const owner = String(ownerName || "").trim() || "Another team";
  const pick = kind === "pick";
  switch (row?.status) {
    case "not-yours":
      return pick ? `${owner} owns this pick, not you.` : `${owner} has him, not you.`;
    case "already-yours":
      return pick ? "This pick is already yours." : "He is already on your roster.";
    case "unrostered":
      return pick ? "Nobody in this league owns this pick." : "He is not on a roster in this league.";
    case "generic":
      return "Generic pick. Swap in a real pick from a roster to count it in team impact.";
    case "other-league":
      return "This pick is from another league.";
    default:
      return "";
  }
}

export function draftTeamSummary(context, { leftCount = 0, rightCount = 0, partnerName = "", splitNames = [] } = {}) {
  if (!context) return "";
  if (context.needsTeam) return "Choose your team to see what this trade does to both rosters.";
  if (!leftCount || !rightCount) return "Add both sides to see what this trade does to both rosters.";
  if (context.partnerIds.length > 1) {
    const names = splitNames.filter(Boolean);
    return `You get pieces from ${names.length ? names.join(" and ") : "more than one team"}. Team impact needs one partner.`;
  }
  if (context.mismatched > 0) {
    const n = context.mismatched;
    return `Team impact needs You give from your roster and You get from one team. ${n} ${n === 1 ? "piece does" : "pieces do"} not fit yet. The market verdict above still counts every piece.`;
  }
  return partnerName ? `With ${partnerName}.` : "";
}

export function draftSideForAsset(assetId, { rosters = [], meRosterId = null } = {}) {
  const hit = draftOwnerIndex(rosters).get(String(assetId || ""));
  if (!hit) return { side: "left", ownerRosterId: null };
  if (meRosterId != null && String(hit.rosterId) === String(meRosterId)) return { side: "left", ownerRosterId: hit.rosterId };
  return { side: meRosterId == null ? "left" : "right", ownerRosterId: hit.rosterId };
}

export function draftFromReview(payload, { rosters = [], leagueId = "", nameFor = () => "" } = {}) {
  const index = draftOwnerIndex(rosters);
  let draft = emptyValueCalcState();
  const add = (side, assetId) => {
    const id = String(assetId || "");
    if (!DRAFT_ASSET_ID.test(id)) return;
    const hit = index.get(id);
    draft = addValueCalcItem(draft, side, {
      assetId: id,
      name: hit?.asset?.name || nameFor(id) || id,
      assetType: hit?.asset?.assetType || (id.startsWith("pick:") ? "pick" : "player"),
      leagueId: isLeaguePickAssetId(id) ? leagueId : "",
    });
  };
  (Array.isArray(payload?.give) ? payload.give : []).forEach((id) => add("left", id));
  (Array.isArray(payload?.get) ? payload.get : []).forEach((id) => add("right", id));
  const partner = Number(payload?.partnerId);
  draft.partnerRosterId = Number.isFinite(partner) && partner > 0 ? partner : null;
  return draft;
}

export function reviewPayloadFor(idea) {
  return {
    partnerId: idea?.counterpartyRosterId ?? idea?.theirRosterId ?? idea?.partnerRosterId ?? "",
    give: (idea?.myAssets || []).map((asset) => asset.assetId),
    get: (idea?.theirAssets || []).map((asset) => asset.assetId),
  };
}

export function draftSummaryLine(draft) {
  const names = (items) => (items || []).map((item) => item.name).filter(Boolean);
  const give = names(draft?.left);
  const get = names(draft?.right);
  if (!give.length && !get.length) return "";
  return `${give.join(", ") || "nothing"} for ${get.join(", ") || "nothing"}`;
}

// Where to land once a league opens: keep the page a visitor was working on.
export function placeAfterConnect({ activePage = "", tradesRoom = "", selectedAssetId = "", pendingPlace = null } = {}) {
  if (pendingPlace?.page) return pendingPlace;
  if (activePage === "trades") return { page: "trades", room: tradesRoom || "calculator" };
  if (activePage === "players" && selectedAssetId) return { page: "players", room: "ranks" };
  return null;
}

function cleanDraftItem(raw) {
  const assetId = String(raw?.assetId || "");
  if (!DRAFT_ASSET_ID.test(assetId)) return null;
  const item = {
    uid: String(raw?.uid || ""),
    assetId,
    name: String(raw?.name || assetId).slice(0, 120),
    assetType: assetId.startsWith("pick:") ? "pick" : "player",
  };
  if (isLeaguePickAssetId(assetId) && raw?.leagueId) item.leagueId = String(raw.leagueId);
  return item;
}

export function serializeDraft(draft) {
  const side = (items) => (Array.isArray(items) ? items : []).map(cleanDraftItem).filter(Boolean);
  return JSON.stringify({
    v: 1,
    left: side(draft?.left),
    right: side(draft?.right),
    nextUid: Number(draft?.nextUid) || 1,
    partnerRosterId: draft?.partnerRosterId ?? null,
  });
}

export function restoreDraft(text) {
  let parsed = null;
  try {
    parsed = JSON.parse(String(text || ""));
  } catch {
    return null;
  }
  if (!parsed || parsed.v !== 1) return null;
  const draft = emptyValueCalcState();
  let uid = 1;
  for (const side of ["left", "right"]) {
    for (const raw of Array.isArray(parsed[side]) ? parsed[side] : []) {
      const item = cleanDraftItem(raw);
      if (!item) continue;
      item.uid = String(uid);
      uid += 1;
      draft[side].push(item);
    }
  }
  draft.nextUid = uid;
  const partner = Number(parsed.partnerRosterId);
  draft.partnerRosterId = Number.isFinite(partner) && partner > 0 ? partner : null;
  return draft;
}

export function readStoredDraft(storage = globalThis.sessionStorage) {
  try {
    return restoreDraft(storage?.getItem?.(TRADE_DRAFT_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeStoredDraft(draft, storage = globalThis.sessionStorage) {
  try {
    if (isDraftEmpty(draft)) storage?.removeItem?.(TRADE_DRAFT_STORAGE_KEY);
    else storage?.setItem?.(TRADE_DRAFT_STORAGE_KEY, serializeDraft(draft));
    return true;
  } catch {
    return false;
  }
}
