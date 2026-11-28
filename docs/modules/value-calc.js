import { priceHundredths } from "./price-units.js";
import { playerAliasName } from "./player-aliases.js";
import {
  formatGenericPickAssetLabel,
  formatPickBucketLabel,
  getPickBucketAliases,
  parsePickAssetId,
  upcomingDraftSeason,
} from "./values.js";

export const VALUE_CALC_SIDES = Object.freeze(["left", "right"]);
export const VALUE_CALC_BUCKETS = Object.freeze(["early", "mid", "late"]);

const ROUND_WORD_NAMES = {
  1: "first",
  2: "second",
  3: "third",
  4: "fourth",
  5: "fifth",
};

// The trade draft. Left is "You give", right is "You get". Items name an asset but never
// carry a price: totals are priced at render time so a format or market change re-prices
// every piece the same way.
export function emptyValueCalcState() {
  return {
    left: [],
    right: [],
    leftQuery: "",
    rightQuery: "",
    nextUid: 1,
    partnerRosterId: null,
  };
}

export function isGenericPickAssetId(assetId) {
  const meta = parsePickAssetId(assetId);
  if (!meta) return false;
  // "pick:2027:r2:any" is a generic whole-round pick; "pick:2027:r1:5" is a league pick.
  return VALUE_CALC_BUCKETS.includes(meta.bucket) || /:any$/i.test(String(assetId));
}

// A league pick is keyed by its original owner's roster id, which only means something
// inside the league it came from.
export function isLeaguePickAssetId(assetId) {
  return /^pick:\d{4}:r\d+:\d+$/.test(String(assetId || ""));
}

export function searchWords(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function roundSearchWords(round) {
  const n = Number(round);
  if (!Number.isFinite(n) || n <= 0) return [];
  const mod = n % 100;
  const suffix = mod >= 11 && mod <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th");
  return [`${n}${suffix}`, `r${n}`, ROUND_WORD_NAMES[n]].filter(Boolean);
}

// A round priced as a whole (usually 2nd and later) has one price for every
// slot, so "2027 early 2nd" finds that round's pick instead of nothing.
const WHOLE_ROUND_ALIASES = Object.freeze(["early", "mid", "middle", "late"]);

export function valueCalcAssetSearchText(row) {
  if (row?.assetType === "pick") {
    const season = String(row.season || "");
    return [
      row.name,
      row.assetId,
      row.season,
      /^\d{4}$/.test(season) ? season.slice(2) : "",
      "pick",
      `round${row.round}`,
      ...roundSearchWords(row.round),
      ...(row.bucket === "any" ? WHOLE_ROUND_ALIASES : getPickBucketAliases(row.bucket)),
      row.bucketLabel,
    ].filter(Boolean).join(" ");
  }
  return [row?.name, row?.assetId].filter(Boolean).join(" ");
}

function wordMatchesToken(word, token) {
  if (!word || !token) return false;
  if (word === token) return true;
  if (/^\d+$/.test(token) && /^\d+$/.test(word)) {
    return token.length >= 3 && word.startsWith(token);
  }
  return word.startsWith(token);
}

// "1.05" is round 1, slot 5. Slots 1-4 read as early, 5-8 mid, 9+ late.
export function expandPickSlotQuery(query) {
  return String(query || "").replace(/\b(\d{1,2})\.(\d{1,2})\b/g, (match, round, slot) => {
    const r = Number(round);
    const n = Number(slot);
    if (!r || !n) return match;
    const bucket = n <= 4 ? "early" : n <= 8 ? "mid" : "late";
    return `r${r} ${bucket}`;
  });
}

// The query asked for a slot tier, but this round has one price for every slot.
export function wholeRoundPickHint(row, query) {
  if (row?.assetType !== "pick" || row.bucket !== "any") return "";
  if (!/\b(?:early|mid|middle|late)\b|\b\d{1,2}\.\d{1,2}\b/i.test(String(query || ""))) return "";
  const words = roundSearchWords(row.round);
  return words[0] ? `Whole-round ${words[0]} estimate` : "";
}

export function valueCalcAssetMatchesQuery(row, query) {
  const tokens = searchWords(expandPickSlotQuery(query));
  // Emoji or punctuation only: nothing to match, so show "No matching".
  if (!tokens.length) return !String(query || "").trim();
  const words = searchWords(valueCalcAssetSearchText(row));
  const hit = (list) => list.every((token) => words.some((word) => wordMatchesToken(word, token)));
  if (hit(tokens)) return true;
  // "jsn" finds Jaxon Smith-Njigba too.
  const alias = playerAliasName(query);
  return Boolean(alias) && hit(searchWords(alias));
}

function sortValueCalcRows(a, b) {
  return b.value - a.value || a.name.localeCompare(b.name);
}

function sliceValueCalcRows(rows, limit) {
  return Number.isFinite(Number(limit)) && Number(limit) > 0 ? rows.slice(0, Number(limit)) : rows;
}

export function listGenericPicks(values = {}, names = {}, { minSeason = upcomingDraftSeason() } = {}) {
  const floor = Number(minSeason);
  // Rounds priced by slot (early/mid/late) list those; rounds priced only as a
  // whole ("any", usually 2nd-5th) list the single round pick.
  const bucketed = new Set();
  Object.keys(values).forEach((assetId) => {
    const meta = parsePickAssetId(assetId);
    if (meta && VALUE_CALC_BUCKETS.includes(meta.bucket)) bucketed.add(`${meta.season}:${meta.round}`);
  });
  return Object.entries(values)
    .filter(([assetId, value]) => {
      if (!isGenericPickAssetId(assetId) || !Number.isFinite(Number(value))) return false;
      const meta = parsePickAssetId(assetId);
      return meta.bucket !== "any" || !bucketed.has(`${meta.season}:${meta.round}`);
    })
    .map(([assetId, value]) => {
      const meta = parsePickAssetId(assetId);
      return {
        assetId,
        name: names[assetId] || formatGenericPickAssetLabel(assetId),
        value: Number(value),
        assetType: "pick",
        season: meta.season,
        round: meta.round,
        bucket: meta.bucket,
        bucketLabel: formatPickBucketLabel(meta.bucket),
      };
    })
    .filter((pick) => !Number.isFinite(floor) || Number(pick.season) >= floor)
    .sort((a, b) => Number(a.season) - Number(b.season) || a.round - b.round || VALUE_CALC_BUCKETS.indexOf(a.bucket) - VALUE_CALC_BUCKETS.indexOf(b.bucket));
}

// "2026 early 1st" after the 2026 draft: say why nothing matched.
// Only when that season truly has no pick values.
export function pastPickSeasonHint(query, minSeason = upcomingDraftSeason(), values = null) {
  const year = String(query || "").match(/\b(20\d{2})\b/);
  if (!year || Number(year[1]) >= Number(minSeason)) return "";
  if (values && Object.keys(values).some((id) => id.startsWith(`pick:${year[1]}:`))) return "";
  return `${year[1]} picks were already drafted. Try ${minSeason} early 1st.`;
}

export function isBarePlayerId(label) {
  const text = String(label || "").trim();
  return /^\d+$/.test(text) || /^player:\d+$/i.test(text);
}

export function playerDisplayName(playerId, raw = {}, names = {}) {
  const id = String(playerId || "").replace(/^player:/, "").trim();
  const fromRaw = `${String(raw?.first_name || "").trim()} ${String(raw?.last_name || "").trim()}`.trim()
    || String(raw?.full_name || "").trim();
  if (fromRaw && !isBarePlayerId(fromRaw)) return fromRaw;
  const mapped = String(names?.[`player:${id}`] || names?.[id] || "").trim();
  if (mapped && !isBarePlayerId(mapped)) return mapped;
  return "";
}

export function tradeRowName(asset, names = {}) {
  if (!asset) return "";
  if (asset.assetType === "pick") return String(asset.name || "").trim();
  const named = playerDisplayName(asset.playerId || asset.assetId, asset.raw, names);
  if (named) return named;
  const fallback = String(asset.name || "").trim();
  if (fallback && !isBarePlayerId(fallback)) return fallback;
  return "";
}

function listValueCalcPlayerRows(values = {}, names = {}) {
  return Object.entries(values)
    .filter(([assetId, value]) => String(assetId).startsWith("player:") && Number(value) > 0)
    .map(([assetId, value]) => ({
      assetId,
      playerId: String(assetId).slice("player:".length),
      name: playerDisplayName(assetId, {}, names),
      value: Number(value),
      assetType: "player",
    }))
    .filter((row) => row.name);
}

export function listValueCalcAssets(values = {}, names = {}, { query = "", limit = 40, kinds = ["player", "pick"], minSeason } = {}) {
  const want = new Set(kinds);
  const rows = [];
  if (want.has("player")) rows.push(...listValueCalcPlayerRows(values, names));
  if (want.has("pick")) {
    const picks = listGenericPicks(values, names, { minSeason });
    rows.push(...picks);
    // "2027 1st" names no slot. Offer the plain round pick too, so Enter does not
    // quietly add the Early 1st, the priciest slot.
    if (String(query || "").trim() && !PICK_SLOT_WORD.test(String(query))) {
      const floor = Number(minSeason);
      const listed = new Set(picks.map((pick) => pick.assetId));
      Object.entries(values).forEach(([assetId, value]) => {
        const meta = parsePickAssetId(assetId);
        if (!meta || meta.bucket !== "any" || listed.has(assetId) || !isGenericPickAssetId(assetId)) return;
        if (!Number.isFinite(Number(value)) || (Number.isFinite(floor) && Number(meta.season) < floor)) return;
        rows.push({
          assetId,
          name: names[assetId] || formatGenericPickAssetLabel(assetId),
          value: Number(value),
          assetType: "pick",
          season: meta.season,
          round: meta.round,
          bucket: meta.bucket,
          bucketLabel: formatPickBucketLabel(meta.bucket),
        });
      });
    }
  }
  const sorted = rows.filter((row) => valueCalcAssetMatchesQuery(row, query)).sort(sortValueCalcRows);
  return sliceValueCalcRows(plainRoundFirst(sorted), limit);
}

const PICK_SLOT_WORD = /\b(?:early|mid|middle|late|\d{1,2}\.\d{1,2})\b/i;

// The plain round pick sits just ahead of its own Early/Mid/Late slots.
function plainRoundFirst(rows) {
  const out = [];
  rows.forEach((row) => {
    if (row.assetType === "pick" && row.bucket === "any") {
      const at = out.findIndex((other) => other.assetType === "pick" && other.season === row.season && other.round === row.round);
      if (at >= 0) {
        out.splice(at, 0, row);
        return;
      }
    }
    out.push(row);
  });
  return out;
}

export function listValueCalcPlayers(values = {}, names = {}, options = {}) {
  return listValueCalcAssets(values, names, { ...options, kinds: ["player"] });
}

export function withPlayerDirectoryNames(nameMap = {}, players = {}) {
  const names = { ...nameMap };
  Object.entries(players && typeof players === "object" ? players : {}).forEach(([playerId, raw]) => {
    const assetId = String(playerId).startsWith("player:") ? String(playerId) : `player:${playerId}`;
    if (names[assetId]) return;
    const name = String(raw?.full_name || `${raw?.first_name || ""} ${raw?.last_name || ""}`).trim();
    if (name) names[assetId] = name;
  });
  return names;
}

function sameDraftAsset(item, asset) {
  if (String(item?.assetId) !== String(asset?.assetId)) return false;
  if (!isLeaguePickAssetId(asset.assetId)) return true;
  return String(item.leagueId || "") === String(asset.leagueId || "");
}

// Generic picks can repeat (two 2027 early 1sts). A named player or a league pick cannot.
export function valueCalcHasAsset(state, asset) {
  if (!asset?.assetId || isGenericPickAssetId(asset.assetId)) return false;
  return [...(state?.left || []), ...(state?.right || [])].some((item) => sameDraftAsset(item, asset));
}

export function addValueCalcItem(state, side, asset) {
  if (!asset?.assetId || valueCalcHasAsset(state, asset)) return state;
  const next = emptyValueCalcState();
  Object.assign(next, state);
  next.left = [...(state?.left || [])];
  next.right = [...(state?.right || [])];
  const key = VALUE_CALC_SIDES.includes(side) ? side : "left";
  const uid = Number(state?.nextUid) > 0 ? Number(state.nextUid) : 1;
  const assetId = String(asset.assetId);
  const item = {
    uid: String(uid),
    assetId,
    name: String(asset.name || assetId),
    assetType: asset.assetType === "pick" || asset.assetType === "player"
      ? asset.assetType
      : (assetId.startsWith("pick:") ? "pick" : "player"),
  };
  if (isLeaguePickAssetId(assetId) && asset.leagueId) item.leagueId = String(asset.leagueId);
  next[key] = [...next[key], item];
  next.nextUid = uid + 1;
  return next;
}

export function swapValueCalcSides(state) {
  const next = emptyValueCalcState();
  Object.assign(next, state);
  next.left = [...(state?.right || [])];
  next.right = [...(state?.left || [])];
  next.leftQuery = "";
  next.rightQuery = "";
  return next;
}

export function removeValueCalcItem(state, side, uid) {
  const next = emptyValueCalcState();
  Object.assign(next, state);
  next.left = [...(state?.left || [])];
  next.right = [...(state?.right || [])];
  const key = VALUE_CALC_SIDES.includes(side) ? side : "left";
  next[key] = next[key].filter((item) => String(item.uid) !== String(uid));
  return next;
}

export function clearValueCalcSides(state) {
  const next = emptyValueCalcState();
  Object.assign(next, state);
  next.left = [];
  next.right = [];
  next.leftQuery = "";
  next.rightQuery = "";
  return next;
}

export function sumValueCalcSide(items = [], priceOf = null) {
  return items.reduce((sum, item) => sum + priceHundredths(typeof priceOf === "function" ? priceOf(item) : item.value), 0) / 100;
}

// Apply the published bands to the gap as a percentage of the smaller side.
export const TIER_BANDS = Object.freeze({ even: 5, edge: 14, favors: 28 });

export function tierForMore(more) {
  if (more == null) return "lopsided";
  if (more <= TIER_BANDS.even) return "even";
  if (more <= TIER_BANDS.edge) return "edge";
  if (more <= TIER_BANDS.favors) return "favors";
  return "lopsided";
}

export function percentMore(left, right, { roundToTenth = false } = {}) {
  const leftUnits = priceHundredths(left);
  const rightUnits = priceHundredths(right);
  const small = Math.min(leftUnits, rightUnits);
  const big = Math.max(leftUnits, rightUnits);
  if (small <= 0) return big > 0 ? null : 0;
  // Dated links through v5.1 classified the percentage after rounding it.
  if (roundToTenth) return Math.round(((big - small) / small) * 100 * 10) / 10;
  return ((big - small) * 100) / small;
}

export function valueCalcVerdict(leftTotal, rightTotal, { leftCount = null, rightCount = null, roundToTenth = false } = {}) {
  const leftUnits = priceHundredths(leftTotal);
  const rightUnits = priceHundredths(rightTotal);
  const left = leftUnits / 100;
  const right = rightUnits / 100;
  const gap = (rightUnits - leftUnits) / 100;
  const maxUnits = Math.max(leftUnits, rightUnits, 1);
  const pct = Math.round((Math.abs(rightUnits - leftUnits) / maxUnits) * 1000) / 10;
  const more = percentMore(left, right, { roundToTenth });
  const tier = tierForMore(more);
  const leftHas = leftCount == null ? left > 0 : Number(leftCount) > 0;
  const rightHas = rightCount == null ? right > 0 : Number(rightCount) > 0;
  let label = "Add players to both sides";
  let tone = "";
  if (leftHas && rightHas) {
    if (tier === "even") {
      label = "Dead even";
      tone = "good";
    } else if (tier === "edge") {
      label = gap > 0 ? "Fair, leans Get" : "Fair, leans Give";
      tone = "good";
    } else if (tier === "favors") {
      label = gap > 0 ? "Favors Get" : "Favors Give";
      tone = gap > 0 ? "good" : "bad";
    } else {
      label = gap > 0 ? "Lopsided for Get" : "Lopsided for Give";
      tone = gap > 0 ? "good" : "bad";
    }
  } else if (leftHas || rightHas) {
    label = "Now add what you get back";
  }
  return { left, right, gap, pct, more, label, tone };
}

// Seat wording ("Favors you"). The published line is verdictCopy, which stays Give/Get.
export function draftVerdictLabel(verdict, { them = "them", getFavor = "your", favorName = "" } = {}) {
  const label = String(verdict?.label || "");
  const other = String(them || "them");
  const favor = String(getFavor || "your");
  const seat = String(favorName || "").trim();
  const lopsidedGet = favor === "your" ? "Lopsided in your favor" : `Lopsided in ${favor} favor`;
  const leansGet = favor === "your" ? "Fair, leans your way" : `Fair, leans ${favor} way`;
  const favorsGet = favor === "your" ? "Favors you" : `Favors ${seat || favor}`;
  return {
    "Favors Get": favorsGet,
    "Favors Give": `Favors ${other}`,
    "Lopsided for Get": lopsidedGet,
    "Lopsided for Give": `Lopsided for ${other}`,
    "Fair, leans Get": leansGet,
    "Fair, leans Give": `Fair, leans ${other}`,
  }[label] || label;
}
