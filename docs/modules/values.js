import { ordinal } from "./season.js";

export const ELITE_VALUE_PREMIUM_TIERS = [
  { floor: 9000, multiplier: 1.32 },
  { floor: 8000, multiplier: 1.27 },
  { floor: 7000, multiplier: 1.21 },
  { floor: 6000, multiplier: 1.15 },
  { floor: 5000, multiplier: 1.09 },
];

export const KTC_GLOBAL_MAX_FALLBACK = 9999;
export const SAMPLE_VALUES_PATH = "./data/ktc_values_sample.csv";
export const VALUES_JSON_PATH = "./data/ktc_values.json";
export const VALUES_SF_PATH = "./data/ktc_values_sf.csv";
export const VALUES_ONE_QB_PATH = "./data/ktc_values_1qb.csv";
export const PICK_YEAR_DISCOUNT = 0.88;

// Shared default so calls without a name map reuse one lookup cache entry.
const NO_NAMES = Object.freeze({});

const TEP_MULTIPLIERS = {
  0: 1,
  1: 1.06,
  2: 1.12,
  3: 1.18,
};

// Sleeper "Reception Bonus - TE" stacks on top of `rec`. Missing/zero is not TEP.
const TE_REC_BONUS_KEYS = ["bonus_rec_te", "rec_te", "bonus_te_rec"];

export function leagueHasSuperflex(league) {
  const slots = Array.isArray(league?.roster_positions) ? league.roster_positions : [];
  const normalized = slots.map((slot) => String(slot || "").toUpperCase());
  if (normalized.some((slot) => slot === "SUPER_FLEX" || slot === "OP")) return true;
  return normalized.filter((slot) => slot === "QB").length >= 2;
}

export function tepLevelFromScoring(scoring = {}) {
  let extra = 0;
  for (const key of TE_REC_BONUS_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(scoring, key)) continue;
    const value = Number(scoring[key]);
    if (Number.isFinite(value) && value > extra) extra = value;
  }
  if (extra >= 1.5) return 3;
  if (extra >= 1) return 2;
  if (extra >= 0.5) return 1;
  return 0;
}

export function tepLevel(league) {
  return tepLevelFromScoring(league?.scoring_settings || {});
}

export function tepMultiplier(level) {
  const key = Number(level) || 0;
  return TEP_MULTIPLIERS[key] ?? 1;
}

export function selectValueFormat(league) {
  return leagueHasSuperflex(league) ? "sf" : "oneQb";
}

export function parseCsvValues(csvText) {
  const rows = String(csvText || "").trim().split("\n");
  const values = {};
  const nameMap = {};
  for (let i = 1; i < rows.length; i += 1) {
    const [assetId, rawValue, ...rawNameParts] = rows[i].split(",");
    const value = Number(rawValue);
    const name = rawNameParts.join(",").trim();
    if (assetId && Number.isFinite(value)) {
      values[assetId] = value;
      if (name) nameMap[assetId] = name;
    }
  }
  return { values, nameMap };
}

export function coerceValueMap(payload) {
  if (Array.isArray(payload)) {
    return payload.reduce((acc, item) => {
      if (item?.asset_id && Number.isFinite(item.value)) {
        acc.values[item.asset_id] = item.value;
        if (item.name) acc.nameMap[item.asset_id] = item.name;
      }
      return acc;
    }, { values: {}, nameMap: {} });
  }
  return {
    values: payload?.values && typeof payload.values === "object" ? payload.values : payload || {},
    nameMap: payload?.nameMap && typeof payload.nameMap === "object" ? payload.nameMap : {},
  };
}

function nameMapFrom(source) {
  return source && typeof source === "object" && !Array.isArray(source) ? source : {};
}

function formatPayload(payload) {
  return payload && typeof payload === "object" ? payload : { values: {}, nameMap: {} };
}

export function pickValueBundle(payload, format) {
  if (!payload || typeof payload !== "object") return { values: {}, nameMap: {} };
  if (payload.sf || payload.oneQb) {
    // Missing 1QB evidence stays empty. Never price a 1QB league with Superflex.
    const selected = format === "oneQb"
      ? formatPayload(payload.oneQb)
      : formatPayload(payload.sf);
    const values = selected?.values && typeof selected.values === "object" ? selected.values : selected || {};
    return {
      values,
      nameMap: {
        ...nameMapFrom(payload.names),
        ...nameMapFrom(selected?.nameMap),
      },
    };
  }
  return coerceValueMap(payload);
}

export function playerPositionForRaw(raw) {
  return (raw?.position || raw?.fantasy_positions?.[0] || "").toUpperCase();
}

export function playerPositionForAsset(asset) {
  return playerPositionForRaw(asset?.raw);
}

export function playerAgeForAsset(asset) {
  const age = Number(asset?.raw?.age);
  return Number.isFinite(age) ? age : null;
}

export function isInactivePlayerAsset(asset) {
  if (asset?.assetType !== "player") return false;
  if (asset.raw?.active === false) return true;
  const status = String(asset.raw?.status || "").trim().toLowerCase();
  if (["inactive", "retired", "reserve_retired", "reserve/did_not_report", "did_not_report"].includes(status)) {
    return true;
  }
  const team = String(asset.raw?.team || "").trim().toUpperCase();
  if (!team || team === "FA") {
    const age = playerAgeForAsset(asset);
    if (Number.isFinite(age) && age >= 30) return true;
  }
  return false;
}

export function estimatedValue(asset) {
  if (asset?.assetType === "pick") return 2200;
  if (isInactivePlayerAsset(asset)) return 0;
  const position = playerPositionForAsset(asset);
  const age = Number(asset?.raw?.age || 26);
  const baseByPos = {
    QB: 1600,
    RB: 1200,
    WR: 1200,
    TE: 1000,
    K: 100,
    DEF: 400,
  };
  const base = baseByPos[position] || 800;
  const ageModifier = Math.max(-500, (26 - age) * 35);
  return Math.max(300, Math.round(base + ageModifier));
}

function interpolateMultiplier(baseValue) {
  const ascending = [
    { floor: 4500, multiplier: 1 },
    ...[...ELITE_VALUE_PREMIUM_TIERS].reverse(),
    { floor: 10000, multiplier: 1.34 },
  ];
  if (baseValue <= ascending[0].floor) return 1;
  for (let index = 1; index < ascending.length; index += 1) {
    const low = ascending[index - 1];
    const high = ascending[index];
    if (baseValue > high.floor) continue;
    const span = high.floor - low.floor;
    const progress = span > 0 ? (baseValue - low.floor) / span : 1;
    return low.multiplier + progress * (high.multiplier - low.multiplier);
  }
  return ascending[ascending.length - 1].multiplier;
}

export function applyElitePlayerValuePremium(asset, baseValue) {
  if (asset?.assetType !== "player" || !Number.isFinite(baseValue)) return baseValue;
  return Math.round(baseValue * interpolateMultiplier(baseValue));
}

export function normalizePickBucket(bucket) {
  const normalized = String(bucket || "any").trim().toLowerCase();
  if (normalized === "middle") return "mid";
  return normalized || "any";
}

export function getPickBucketAliases(bucket) {
  const normalized = normalizePickBucket(bucket);
  if (normalized === "mid") return ["mid", "middle"];
  return [normalized];
}

export function formatPickBucketLabel(bucket) {
  return {
    early: "Early",
    mid: "Middle",
    late: "Late",
  }[normalizePickBucket(bucket)] || "";
}

export function parsePickRoundToken(token) {
  const normalized = String(token || "").trim().toLowerCase();
  if (!normalized) return null;
  if (/^r\d+$/.test(normalized)) return Number(normalized.slice(1));
  if (/^\d+$/.test(normalized)) return Number(normalized);
  if (/^\d+(st|nd|rd|th)$/.test(normalized)) return Number.parseInt(normalized, 10);
  return null;
}

export function parsePickAssetId(assetId) {
  if (!String(assetId || "").startsWith("pick:")) return null;
  const [, season, ...rest] = String(assetId).split(":");
  const roundToken = rest.find((part) => /^r\d+$/i.test(part) || /^\d+$/i.test(part) || /^(?:\d+)(?:st|nd|rd|th)$/i.test(part));
  const bucketToken = rest.find((part) => /^(any|early|mid|middle|late)$/i.test(part));
  const round = parsePickRoundToken(roundToken);
  if (!season || !Number.isFinite(round)) return null;
  return {
    season,
    round,
    bucket: normalizePickBucket(bucketToken || "any"),
  };
}

export function parsePickDescriptor(input) {
  const source = String(input || "").trim();
  if (!source) return null;
  const seasonMatch = source.match(/\b(20\d{2})\b/);
  const bucketMatch = source.match(/\b(early|mid|middle|late)\b/i);
  const roundMatch = source.match(/\b(\d+)(?:st|nd|rd|th)\b/i) || source.match(/\br(?:ound)?\s*(\d+)\b/i);
  const season = seasonMatch?.[1];
  const round = roundMatch ? Number(roundMatch[1]) : null;
  if (!season || !Number.isFinite(round)) return null;
  return {
    season,
    round,
    bucket: normalizePickBucket(bucketMatch?.[1] || "any"),
  };
}

export function formatGenericPickAssetLabel(assetId) {
  const pickMeta = parsePickAssetId(assetId);
  if (!pickMeta) return assetId;
  const bucketLabel = pickMeta.bucket && pickMeta.bucket !== "any" ? ` ${formatPickBucketLabel(pickMeta.bucket)}` : "";
  if (Number.isFinite(pickMeta.round)) return `${pickMeta.season}${bucketLabel} ${ordinal(pickMeta.round)}`;
  return assetId;
}

export function resolvePickNameForCatalog(assetId, valueNameMap = {}) {
  if (valueNameMap[assetId]) return valueNameMap[assetId];
  return formatGenericPickAssetLabel(assetId);
}

export function buildPickValuationCatalog(values, valueNameMap = {}) {
  const catalog = [];
  Object.entries(values || {}).forEach(([assetId, value]) => {
    if (!Number.isFinite(value)) return;
    const pickMeta = parsePickAssetId(assetId) || parsePickDescriptor(valueNameMap[assetId] || assetId);
    if (!pickMeta) return;
    catalog.push({
      assetId,
      name: resolvePickNameForCatalog(assetId, valueNameMap),
      value,
      season: pickMeta.season,
      round: pickMeta.round,
      bucket: normalizePickBucket(pickMeta.bucket),
    });
  });
  return catalog;
}

export function getAssetPickBucket(asset) {
  if (asset?.assetType !== "pick") return "any";
  return normalizePickBucket(asset?.raw?.ktcBucket || asset?.valueBucket || "any");
}

export function buildPickLookupMeta(asset) {
  if (asset?.assetType !== "pick") return null;
  const valueMeta = parsePickAssetId(asset.valueAssetId || "");
  if (valueMeta) return valueMeta;
  const assetMeta = parsePickAssetId(asset.assetId || "");
  if (assetMeta) {
    return {
      ...assetMeta,
      bucket: assetMeta.round === 1 ? getAssetPickBucket(asset) : assetMeta.bucket,
    };
  }
  const season = asset?.raw?.season != null ? String(asset.raw.season) : "";
  const round = Number(asset?.raw?.round);
  if (!season || !Number.isFinite(round)) return null;
  return {
    season,
    round,
    bucket: round === 1 ? getAssetPickBucket(asset) : "any",
  };
}

export function buildPickValueLookupIds(asset) {
  const meta = buildPickLookupMeta(asset);
  if (!meta) return [];
  const ids = [];
  const seen = new Set();
  const push = (id) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };
  if (asset.valueAssetId) push(asset.valueAssetId);
  if (meta.round === 1) {
    getPickBucketAliases(meta.bucket).forEach((bucket) => push(`pick:${meta.season}:r${meta.round}:${bucket}`));
  }
  push(`pick:${meta.season}:r${meta.round}:any`);
  return ids;
}

function adjustPickAcrossYears(value, sourceSeason, targetSeason) {
  const source = Number(sourceSeason);
  const target = Number(targetSeason);
  if (!Number.isFinite(value) || !Number.isFinite(source) || !Number.isFinite(target)) return value;
  const yearDelta = target - source;
  if (yearDelta <= 0) return Math.max(1, Math.round(value));
  const factor = PICK_YEAR_DISCOUNT ** yearDelta;
  return Math.max(1, Math.round(value * Math.max(0.5, factor)));
}

const pickCatalogs = new WeakMap();

function cachedPickCatalog(values, valueNameMap) {
  if (!values || typeof values !== "object") return buildPickValuationCatalog(values, valueNameMap);
  const names = valueNameMap && typeof valueNameMap === "object" ? valueNameMap : NO_NAMES;
  let byNames = pickCatalogs.get(values);
  if (!byNames) {
    byNames = new WeakMap();
    pickCatalogs.set(values, byNames);
  }
  let catalog = byNames.get(names);
  if (!catalog) {
    catalog = buildPickValuationCatalog(values, names);
    byNames.set(names, catalog);
  }
  return catalog;
}

export function findPickCatalogValue(meta, values, valueNameMap = NO_NAMES, catalog = null) {
  if (!meta) return null;
  const list = Array.isArray(catalog) && catalog.length > 0
    ? catalog
    : cachedPickCatalog(values, valueNameMap);
  const desiredBuckets = meta.round === 1
    ? [...getPickBucketAliases(meta.bucket), "any"]
    : ["any"];
  for (const bucket of desiredBuckets) {
    const exact = list.find((pick) =>
      pick.season === meta.season
      && pick.round === meta.round
      && pick.bucket === normalizePickBucket(bucket)
    );
    if (exact) return exact.value;
  }
  const numericSeason = Number(meta.season);
  if (!Number.isFinite(numericSeason)) return null;
  const nearest = list
    .filter((pick) => pick.round === meta.round && desiredBuckets.includes(pick.bucket))
    .sort((a, b) => Math.abs(Number(a.season) - numericSeason) - Math.abs(Number(b.season) - numericSeason))[0];
  return nearest ? adjustPickAcrossYears(nearest.value, nearest.season, meta.season) : null;
}

export function resolvePickAssetValue(asset, values, valueNameMap = NO_NAMES, catalog = null) {
  for (const candidateId of buildPickValueLookupIds(asset)) {
    if (Number.isFinite(values?.[candidateId])) return values[candidateId];
  }
  return findPickCatalogValue(buildPickLookupMeta(asset), values, valueNameMap, catalog);
}

export function normalizePlayerValueName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function playerNameForAsset(asset) {
  return String(
    asset?.name
    || asset?.raw?.full_name
    || `${asset?.raw?.first_name || ""} ${asset?.raw?.last_name || ""}`
  ).trim();
}

// Every value lookup that misses by id falls back to a name match, so the name map is
// indexed once per map object. Maps are built whole and never edited after use.
const playerNameIndexes = new WeakMap();

function playerNameIndex(valueNameMap) {
  if (!valueNameMap || typeof valueNameMap !== "object") return null;
  const cached = playerNameIndexes.get(valueNameMap);
  if (cached) return cached;
  const index = new Map();
  for (const [assetId, label] of Object.entries(valueNameMap)) {
    if (!String(assetId).startsWith("player:")) continue;
    const key = normalizePlayerValueName(label);
    if (!key) continue;
    const assetIds = index.get(key);
    if (assetIds) assetIds.push(assetId);
    else index.set(key, [assetId]);
  }
  playerNameIndexes.set(valueNameMap, index);
  return index;
}

export function findMarketValueByPlayerName(name, values, valueNameMap = NO_NAMES) {
  const want = normalizePlayerValueName(name);
  if (!want) return null;
  const assetIds = playerNameIndex(valueNameMap)?.get(want);
  if (!assetIds) return null;
  let match = null;
  for (const assetId of assetIds) {
    const value = Number(values?.[assetId]);
    if (!Number.isFinite(value) || value <= 0) continue;
    if (match != null) return null;
    match = value;
  }
  return match;
}

export function lookupMarketValue(asset, values, valueNameMap = NO_NAMES, catalog = null) {
  const exact = values?.[asset?.assetId];
  if (Number.isFinite(exact)) return { value: exact, estimated: false };
  const named = findMarketValueByPlayerName(playerNameForAsset(asset), values, valueNameMap);
  if (Number.isFinite(named)) return { value: named, estimated: false };
  if (asset?.assetType === "pick") {
    const resolvedPickValue = resolvePickAssetValue(asset, values, valueNameMap, catalog);
    if (Number.isFinite(resolvedPickValue)) return { value: resolvedPickValue, estimated: false };
  }
  return { value: estimatedValue(asset), estimated: true };
}

export function adjustLeagueValue(asset, baseValue, league) {
  let value = applyElitePlayerValuePremium(asset, baseValue);
  if (asset?.assetType === "player" && playerPositionForAsset(asset) === "TE") {
    value = Math.round(value * tepMultiplier(tepLevel(league)));
  }
  return value;
}

export const CROWD_LEARNING_RATE = 0.028;
export const CROWD_MAX_ABS_SHIFT = 0.085;
export const CROWD_PER_VOTE_LOG_CAP = 0.025;
export const CROWD_HALF_LIFE_MS = 90 * 24 * 60 * 60 * 1000;
export const CROWD_ESTIMATED_SCALE = 0.5;
export const LEAGUE_BOARD_MAX_ABS_SHIFT = 0.26;
export const LEAGUE_BOARD_ESTIMATED_SCALE = 0.55;

export function normalizeCrowdFormat(format) {
  const text = String(format || "").trim().toLowerCase();
  if (!text) return "";
  if (text === "oneqb" || text === "one_qb" || text === "1qb" || text.includes("1qb") || text.includes("one qb")) return "oneQb";
  if (text === "sf" || text === "superflex" || text.includes("superflex")) return "sf";
  return "";
}

export function sanitizeCrowdVotes(votes) {
  if (!Array.isArray(votes)) return [];
  const out = [];
  const seen = new Set();
  for (const vote of votes) {
    const winnerId = String(vote?.winnerId || "");
    const loserId = String(vote?.loserId || "");
    if (!winnerId.startsWith("player:") || !loserId.startsWith("player:")) continue;
    if (winnerId === loserId) continue;
    const at = Number(vote?.at);
    const stamp = Number.isFinite(at) && at > 0 ? at : 0;
    const format = normalizeCrowdFormat(vote?.format);
    if (!format) continue;
    const eventId = String(vote?.eventId || "").trim();
    const key = eventId || `${winnerId}|${loserId}|${stamp}|${format}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ eventId, winnerId, loserId, at: stamp, format });
  }
  return out.sort((a, b) => a.at - b.at || a.winnerId.localeCompare(b.winnerId) || a.loserId.localeCompare(b.loserId));
}

export function crowdFormatScale(voteFormat, valueFormat) {
  const vote = normalizeCrowdFormat(voteFormat);
  const want = valueFormat === "oneQb" ? "oneQb" : "sf";
  return vote && vote === want ? 1 : 0;
}

export function crowdShiftsFromVotes(votes, marketValues, options = {}) {
  const now = Number(options.now);
  const clock = Number.isFinite(now) && now > 0 ? now : Date.now();
  const valueFormat = options.format === "oneQb" ? "oneQb" : "sf";
  const cleaned = sanitizeCrowdVotes(votes);
  const deltas = Object.create(null);

  for (const vote of cleaned) {
    const formatScale = crowdFormatScale(vote.format, valueFormat);
    if (!formatScale) continue;
    const winnerValue = Number(marketValues?.[vote.winnerId]);
    const loserValue = Number(marketValues?.[vote.loserId]);
    if (!Number.isFinite(winnerValue) || !Number.isFinite(loserValue) || winnerValue <= 0 || loserValue <= 0) {
      continue;
    }

    const age = Math.max(0, clock - vote.at);
    const recency = vote.at ? 2 ** (-age / CROWD_HALF_LIFE_MS) : 1;
    const priorGap = Math.log(winnerValue) - Math.log(loserValue);
    const expected = 1 / (1 + Math.exp(-clampLogGap(priorGap)));
    const surprise = 1 - expected;
    const step = Math.min(
      CROWD_PER_VOTE_LOG_CAP,
      CROWD_LEARNING_RATE * recency * formatScale * surprise,
    );

    deltas[vote.winnerId] = (deltas[vote.winnerId] || 0) + step;
    deltas[vote.loserId] = (deltas[vote.loserId] || 0) - step;
  }

  const ids = Object.keys(deltas);
  if (ids.length > 1) {
    const mean = ids.reduce((sum, id) => sum + deltas[id], 0) / ids.length;
    for (const id of ids) deltas[id] -= mean;
  }

  const shifts = Object.create(null);
  for (const id of ids) {
    const raw = Math.exp(deltas[id]) - 1;
    shifts[id] = clampCrowdShift(raw);
  }
  return shifts;
}

export function applyCrowdShift(assetId, value, shifts, { scale = 1 } = {}) {
  if (!Number.isFinite(value) || value <= 0) return value;
  const shift = Number(shifts?.[assetId]);
  if (!Number.isFinite(shift) || shift === 0) return value;
  const weight = Number.isFinite(scale) ? Math.max(0, Math.min(1, scale)) : 1;
  const capped = clampCrowdShift(shift * weight);
  return Math.max(1, Math.round(value * (1 + capped)));
}

export function applyLeagueShift(assetId, value, shifts, { scale = 1 } = {}) {
  if (!Number.isFinite(value) || value <= 0) return value;
  const shift = Number(shifts?.[assetId]);
  if (!Number.isFinite(shift) || shift === 0) return value;
  const weight = Number.isFinite(scale) ? Math.max(0, Math.min(1, scale)) : 1;
  const capped = clampLeagueShift(shift * weight);
  return Math.max(1, Math.round(value * (1 + capped)));
}

export function getAssetValue(asset, values, options = {}) {
  const {
    valueNameMap = NO_NAMES,
    pickCatalog = null,
    league = null,
    crowdShifts = null,
    leagueShifts = null,
    applyLeagueBoard = false,
  } = options;
  const lookup = lookupMarketValue(asset, values, valueNameMap, pickCatalog);
  let value = adjustLeagueValue(asset, lookup.value, league);
  const assetId = String(asset?.assetId || "");
  const isPlayer = asset?.assetType === "player" || assetId.startsWith("player:");
  const isPick = asset?.assetType === "pick" || assetId.startsWith("pick:");
  if (isPlayer && crowdShifts) {
    value = applyCrowdShift(assetId, value, crowdShifts, {
      scale: lookup.estimated ? CROWD_ESTIMATED_SCALE : 1,
    });
  }
  if (applyLeagueBoard && leagueShifts && (isPlayer || isPick)) {
    value = applyLeagueShift(assetId, value, leagueShifts, {
      scale: lookup.estimated ? LEAGUE_BOARD_ESTIMATED_SCALE : 1,
    });
  }
  return value;
}

function clampLogGap(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(-20, Math.min(20, numeric));
}

function clampCrowdShift(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(-CROWD_MAX_ABS_SHIFT, Math.min(CROWD_MAX_ABS_SHIFT, numeric));
}

function clampLeagueShift(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(-LEAGUE_BOARD_MAX_ABS_SHIFT, Math.min(LEAGUE_BOARD_MAX_ABS_SHIFT, numeric));
}

export function isEstimatedAsset(asset, values, options = {}) {
  const { valueNameMap = NO_NAMES, pickCatalog = null } = options;
  return lookupMarketValue(asset, values, valueNameMap, pickCatalog).estimated;
}

export function getGlobalMaxPlayerValue(values, tradeMaxValue = 0) {
  const floor = Number.isFinite(tradeMaxValue) ? tradeMaxValue : 0;
  let maxValue = Math.max(KTC_GLOBAL_MAX_FALLBACK, floor);
  for (const [assetId, value] of Object.entries(values || {})) {
    if (!String(assetId).startsWith("player:")) continue;
    if (Number.isFinite(value) && value > maxValue) maxValue = value;
  }
  return maxValue;
}

async function readTextIfOk(fetchImpl, path) {
  try {
    const response = await fetchImpl(path);
    if (!response?.ok) return "";
    return await response.text();
  } catch {
    return "";
  }
}

async function readJsonIfOk(fetchImpl, path) {
  try {
    const response = await fetchImpl(path);
    if (!response?.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function fetchValuationBundles(fetchImpl = globalThis.fetch) {
  const jsonBundle = await readJsonIfOk(fetchImpl, VALUES_JSON_PATH);
  if (jsonBundle && (jsonBundle.sf || jsonBundle.oneQb || jsonBundle.values)) {
    if (jsonBundle.sf || jsonBundle.oneQb) {
      const sf = coerceValueMap(jsonBundle.sf || {});
      const oneQb = coerceValueMap(jsonBundle.oneQb || {});
      const names = jsonBundle.names && typeof jsonBundle.names === "object"
        ? jsonBundle.names
        : { ...sf.nameMap, ...oneQb.nameMap };
      return {
        sf: { values: sf.values, nameMap: { ...names, ...sf.nameMap } },
        oneQb: { values: oneQb.values, nameMap: { ...names, ...oneQb.nameMap } },
        names,
      };
    }
    const coerced = coerceValueMap(jsonBundle);
    return { sf: coerced, oneQb: coerced, names: coerced.nameMap };
  }

  const [sfCsv, oneQbCsv, sampleCsv] = await Promise.all([
    readTextIfOk(fetchImpl, VALUES_SF_PATH),
    readTextIfOk(fetchImpl, VALUES_ONE_QB_PATH),
    readTextIfOk(fetchImpl, SAMPLE_VALUES_PATH),
  ]);
  const sf = parseCsvValues(sfCsv || sampleCsv);
  const oneQb = oneQbCsv ? parseCsvValues(oneQbCsv) : { values: {}, nameMap: {} };
  return { sf, oneQb, names: { ...sf.nameMap, ...oneQb.nameMap } };
}
