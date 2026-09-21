import {
  formatGenericPickAssetLabel,
  formatPickBucketLabel,
  parsePickAssetId,
} from "./values.js";

export const VALUE_CALC_SIDES = Object.freeze(["left", "right"]);
export const VALUE_CALC_BUCKETS = Object.freeze(["early", "mid", "late"]);

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

export function listValueCalcPlayers(values = {}, names = {}, { query = "", limit = 40 } = {}) {
  const needle = String(query || "").trim().toLowerCase();
  const rows = Object.entries(values)
    .filter(([assetId, value]) => String(assetId).startsWith("player:") && Number.isFinite(Number(value)))
    .map(([assetId, value]) => ({
      assetId,
      playerId: String(assetId).slice("player:".length),
      name: names[assetId] || assetId,
      value: Number(value),
      assetType: "player",
    }))
    .filter((row) => !needle || row.name.toLowerCase().includes(needle) || row.assetId.toLowerCase().includes(needle))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
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

export function groupGenericPicks(picks = []) {
  const seasons = [];
  const seasonMap = new Map();
  picks.forEach((pick) => {
    if (!seasonMap.has(pick.season)) {
      const row = { season: pick.season, rounds: [] };
      seasonMap.set(pick.season, row);
      seasons.push(row);
    }
    const seasonRow = seasonMap.get(pick.season);
    let roundRow = seasonRow.rounds.find((entry) => entry.round === pick.round);
    if (!roundRow) {
      roundRow = { round: pick.round, buckets: [] };
      seasonRow.rounds.push(roundRow);
    }
    roundRow.buckets.push(pick);
  });
  seasons.forEach((season) => {
    season.rounds.sort((a, b) => a.round - b.round);
  });
  return seasons;
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
