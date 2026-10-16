import {
  addValueCalcItem,
  emptyValueCalcState,
  isGenericPickAssetId,
  isLeaguePickAssetId,
  valueCalcVerdict,
} from "./value-calc.js";
import { calculatePackageAdjustment, finiteAssetValue } from "./package-value.js";
import { lookupMarketValue } from "./values.js";

export const TRADE_DRAFT_STORAGE_KEY = "dynasty_ticker_trade_draft_v1";
const LEGACY_TRADE_DRAFT_KEYS = Object.freeze([
  TRADE_DRAFT_STORAGE_KEY,
  "dynasty_ticker_trade_draft",
]);

// The calculator reads the exact same canonical snapshot as Players and My League.
export function draftMarketPrice(asset, { values = {}, nameMap = {}, catalog = null } = {}) {
  const lookup = lookupMarketValue(asset, values, nameMap, catalog);
  return { value: Math.round(Number(lookup.value) || 0), estimated: Boolean(lookup.estimated) };
}

const DRAFT_ASSET_ID = /^(?:player:[A-Za-z0-9_.-]+|pick:\d{4}:r\d+:[A-Za-z0-9_-]+)$/;

// The one verdict, with or without a league. Pane totals stay the plain market sums.
// A package of two or more adds a stud credit, even when both sides send the same
// number of pieces. A straight one-for-one stays at the listed prices.
export function draftVerdictModel(giveValues = [], getValues = [], { globalMaxValue = 9999 } = {}) {
  // Keep a 0 in the list so a missing player still counts as a side. Infinity
  // and NaN become 0 here; stud credit drops them before the stud curve.
  const clean = (list) => (Array.isArray(list) ? list : []).map(finiteAssetValue);
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
  return {
    give,
    get,
    compareGive,
    compareGet,
    adjustment,
    verdict: valueCalcVerdict(compareGive, compareGet, {
      leftCount: giveList.length,
      rightCount: getList.length,
    }),
  };
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

export function describeDraftItem(row, { ownerName = "", kind = "player", voice = null } = {}) {
  const owner = String(ownerName || "").trim() || "Another team";
  const pick = kind === "pick";
  switch (row?.status) {
    case "not-yours":
      return pick ? `${owner} owns this pick, not you.` : `${owner} has him, not you.`;
    case "already-yours":
      if (voice?.roster) return pick ? `This pick is already on ${voice.roster}.` : `He is already on ${voice.roster}.`;
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

export function draftTeamSummary(context, { leftCount = 0, rightCount = 0, partnerName = "", splitNames = [], voice = null } = {}) {
  if (!context) return "";
  if (context.needsTeam) {
    return voice?.roster
      ? `Open ${voice.roster} to see what this trade does to both rosters.`
      : "Choose your team to see what this trade does to both rosters.";
  }
  if (!leftCount || !rightCount) return "Add both sides to see what this trade does to both rosters.";
  if (context.partnerIds.length > 1) {
    const names = splitNames.filter(Boolean);
    const from = names.length ? names.join(" and ") : "more than one team";
    return voice
      ? `The other side has pieces from ${from}. Team impact needs one partner.`
      : `You get pieces from ${from}. Team impact needs one partner.`;
  }
  if (context.mismatched > 0) {
    const n = context.mismatched;
    const fit = `${n} ${n === 1 ? "piece does" : "pieces do"} not fit yet. The market verdict above still counts every piece.`;
    return voice?.draftNeedPieces
      ? `${voice.draftNeedPieces} ${fit}`
      : `Team impact needs You give from your roster and You get from one team. ${fit}`;
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

// Bars and pane totals stay on the listed prices. Stud credit changes the
// verdict only, so the same side never shows two different numbers.
export function draftMeterValues(model) {
  return {
    give: Math.round(Number(model?.give) || 0),
    get: Math.round(Number(model?.get) || 0),
  };
}

// Same cutoff as valueCalcVerdict's "Fair" band. A suggestion closes only when
// the trade, after the pick and the stud credit, lands inside that band.
const EVEN_UP_FAIR_PCT = 12;

// A pick evens the gap only when its price actually covers it. Pass scoreAdded
// when adding the pick changes the stud credit; the raw 0.8–1.25 band does
// not know about that credit.
export function evenUpPickChoice(gap, picks = [], { scoreAdded = null } = {}) {
  const need = Math.abs(Number(gap) || 0);
  if (!(need > 0)) return null;
  const score = typeof scoreAdded === "function" ? scoreAdded : null;
  let best = null;
  for (const pick of Array.isArray(picks) ? picks : []) {
    const value = Math.round(Number(pick?.value) || 0);
    if (!(value > 0) || !pick?.name) continue;
    if (!score) {
      const miss = Math.abs(value - need);
      if (!best || miss < best.miss) best = { name: String(pick.name), value, miss };
      continue;
    }
    const scored = score(value) || {};
    const afterGap = Number(scored.gap);
    const pct = Number(scored.pct);
    if (!Number.isFinite(afterGap) || !Number.isFinite(pct)) continue;
    const miss = Math.abs(afterGap);
    const closes = pct <= EVEN_UP_FAIR_PCT;
    const candidate = { name: String(pick.name), value, miss, closes, gap: need, afterGap, pct };
    const betterClose = Boolean(best) && closes && !best.closes;
    const tighter = Boolean(best) && closes === best.closes && (miss < best.miss || (miss === best.miss && value < best.value));
    if (!best || betterClose || tighter) best = candidate;
  }
  if (!best) return null;
  if (score) return best;
  const closes = best.value >= need * 0.8 && best.value <= need * 1.25;
  return { ...best, closes, gap: need };
}

// Rescore every pick on the short side. Matching the raw gap is not enough:
// the first extra piece turns on stud credit and can reopen the hole.
export function evenUpTradePick({ giveValues = [], getValues = [], picks = [], globalMaxValue = 9999 } = {}) {
  const give = (Array.isArray(giveValues) ? giveValues : []).map(finiteAssetValue);
  const get = (Array.isArray(getValues) ? getValues : []).map(finiteAssetValue);
  if (!give.length || !get.length) return null;
  const model = draftVerdictModel(give, get, { globalMaxValue });
  const gap = model.verdict.gap;
  if (!(Math.abs(gap) > 0) || model.verdict.pct <= 5) return null;
  const shortIsGive = gap > 0;
  return evenUpPickChoice(gap, picks, {
    scoreAdded(value) {
      const next = draftVerdictModel(
        shortIsGive ? [...give, value] : give,
        shortIsGive ? get : [...get, value],
        { globalMaxValue },
      );
      return { gap: next.verdict.gap, pct: next.verdict.pct };
    },
  });
}

// The restore strip is only for an explicit clear. Later edits keep the same
// sentence, which stays true, and never claim the board is still empty.
export function draftNoticeText({ note = "", saved = null, voice = null } = {}) {
  if (!saved || isDraftEmpty(saved)) return "";
  const summary = draftSummaryLine(saved);
  const claimsClear = /cleared both sides/i.test(String(note || ""));
  if (claimsClear) {
    if (voice) {
      return summary
        ? `Started a new trade. Restore the saved ${summary} draft?`
        : "Started a new trade. Restore the last draft?";
    }
    return summary
      ? `Started a new trade. Restore your ${summary} draft?`
      : "Started a new trade. Restore your last draft?";
  }
  const lead = String(note || "").trim();
  if (!lead) return summary ? `Previous trade saved: ${summary}.` : "";
  return summary ? `${lead} Saved: ${summary}.` : lead;
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
  const assetId = String(raw?.assetId || raw?.id || "");
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

function draftPayload(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  if (parsed.v != null && parsed.v !== 1) return null;
  const left = parsed.left ?? parsed.give;
  const right = parsed.right ?? parsed.get;
  const hasSides = [left, right].some((side) => Array.isArray(side));
  if (parsed.v !== 1 && !hasSides) return null;
  return {
    ...parsed,
    left: Array.isArray(left) ? left : [],
    right: Array.isArray(right) ? right : [],
  };
}

function draftItemKey(item) {
  if (isGenericPickAssetId(item.assetId)) return "";
  if (isLeaguePickAssetId(item.assetId)) return `${item.assetId}@${item.leagueId || ""}`;
  return item.assetId;
}

export function restoreDraft(text) {
  let parsed = null;
  try {
    parsed = draftPayload(JSON.parse(String(text || "")));
  } catch {
    return null;
  }
  if (!parsed) return null;
  const draft = emptyValueCalcState();
  const seen = new Set();
  let uid = 1;
  for (const side of ["left", "right"]) {
    for (const raw of parsed[side]) {
      const item = cleanDraftItem(raw);
      if (!item) continue;
      const key = draftItemKey(item);
      if (key) {
        if (seen.has(key)) continue;
        seen.add(key);
      }
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

function readDraftText(storage) {
  if (!storage?.getItem) return "";
  for (const key of LEGACY_TRADE_DRAFT_KEYS) {
    const text = storage.getItem(key);
    if (text) return text;
  }
  return "";
}

export function readStoredDraft(storage = globalThis.sessionStorage, legacyStorage = undefined) {
  try {
    const text = readDraftText(storage);
    if (text) {
      const current = restoreDraft(text);
      if (current) return current;
    }
  } catch {
    /* Try the older store below. */
  }
  if (!legacyStorage || legacyStorage === storage) return null;
  try {
    return restoreDraft(readDraftText(legacyStorage));
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
