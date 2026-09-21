import {
  formatGenericPickAssetLabel,
  formatPickBucketLabel,
  getPickBucketAliases,
  parsePickAssetId,
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

export function emptyValueCalcState() {
  return {
    left: [],
    right: [],
    leftQuery: "",
    rightQuery: "",
    nextUid: 1,
  };
}

export function isGenericPickAssetId(assetId) {
  const meta = parsePickAssetId(assetId);
  return Boolean(meta && VALUE_CALC_BUCKETS.includes(meta.bucket));
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

export function valueCalcAssetSearchText(row) {
  if (row?.assetType === "pick") {
    return [
      row.name,
      row.assetId,
      row.season,
      "pick",
      `round${row.round}`,
      ...roundSearchWords(row.round),
      ...getPickBucketAliases(row.bucket),
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

export function valueCalcAssetMatchesQuery(row, query) {
  const tokens = searchWords(query);
  if (!tokens.length) return true;
  const words = searchWords(valueCalcAssetSearchText(row));
  return tokens.every((token) => words.some((word) => wordMatchesToken(word, token)));
}

function sortValueCalcRows(a, b) {
  return b.value - a.value || a.name.localeCompare(b.name);
}

function sliceValueCalcRows(rows, limit) {
  return Number.isFinite(Number(limit)) && Number(limit) > 0 ? rows.slice(0, Number(limit)) : rows;
}

export function listGenericPicks(values = {}, names = {}) {
  return Object.entries(values)
    .filter(([assetId, value]) => isGenericPickAssetId(assetId) && Number.isFinite(Number(value)))
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
    .sort((a, b) => Number(a.season) - Number(b.season) || a.round - b.round || VALUE_CALC_BUCKETS.indexOf(a.bucket) - VALUE_CALC_BUCKETS.indexOf(b.bucket));
}

function listValueCalcPlayerRows(values = {}, names = {}) {
  return Object.entries(values)
    .filter(([assetId, value]) => String(assetId).startsWith("player:") && Number.isFinite(Number(value)))
    .map(([assetId, value]) => ({
      assetId,
      playerId: String(assetId).slice("player:".length),
      name: names[assetId] || assetId,
      value: Number(value),
      assetType: "player",
    }));
}

export function listValueCalcAssets(values = {}, names = {}, { query = "", limit = 40, kinds = ["player", "pick"] } = {}) {
  const want = new Set(kinds);
  const rows = [];
  if (want.has("player")) rows.push(...listValueCalcPlayerRows(values, names));
  if (want.has("pick")) rows.push(...listGenericPicks(values, names));
  return sliceValueCalcRows(
    rows.filter((row) => valueCalcAssetMatchesQuery(row, query)).sort(sortValueCalcRows),
    limit
  );
}

export function listValueCalcPlayers(values = {}, names = {}, options = {}) {
  return listValueCalcAssets(values, names, { ...options, kinds: ["player"] });
}

export function addValueCalcItem(state, side, asset) {
  const next = emptyValueCalcState();
  Object.assign(next, state);
  next.left = [...(state?.left || [])];
  next.right = [...(state?.right || [])];
  const key = VALUE_CALC_SIDES.includes(side) ? side : "left";
  const uid = Number(state?.nextUid) > 0 ? Number(state.nextUid) : 1;
  next[key] = [...next[key], {
    uid: String(uid),
    assetId: asset.assetId,
    name: asset.name,
    value: Number(asset.value) || 0,
    assetType: asset.assetType || (String(asset.assetId).startsWith("pick:") ? "pick" : "player"),
  }];
  next.nextUid = uid + 1;
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
  return next;
}

export function sumValueCalcSide(items = []) {
  return items.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
}

export function valueCalcVerdict(leftTotal, rightTotal) {
  const left = Number(leftTotal) || 0;
  const right = Number(rightTotal) || 0;
  const gap = right - left;
  const maxSide = Math.max(left, right, 1);
  const pct = Math.round((Math.abs(gap) / maxSide) * 1000) / 10;
  let label = "Add both sides";
  let tone = "";
  if (left > 0 && right > 0) {
    if (pct <= 5) {
      label = "Dead even";
      tone = "good";
    } else if (pct <= 12) {
      label = gap > 0 ? "Fair, leans Get" : "Fair, leans Give";
      tone = "good";
    } else if (pct <= 22) {
      label = gap > 0 ? "Favors Get" : "Favors Give";
      tone = gap > 0 ? "good" : "bad";
    } else {
      label = gap > 0 ? "Lopsided for Get" : "Lopsided for Give";
      tone = gap > 0 ? "good" : "bad";
    }
  } else if (left > 0 || right > 0) {
    label = "Add the other side";
  }
  return { left, right, gap, pct, label, tone };
}
