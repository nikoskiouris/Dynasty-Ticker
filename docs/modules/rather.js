import { escapeHtml } from "./html.js";
import {
  SLEEPER_PLAYER_THUMB_BASE,
  playerIdFromAssetId,
  playerInitials,
  sleeperPlayerThumbUrl,
} from "./player-face.js";

export {
  SLEEPER_PLAYER_THUMB_BASE,
  playerIdFromAssetId,
  playerInitials,
  sleeperPlayerThumbUrl,
};

export const RATHER_VOTES_KEY = "dynasty_ticker_rather_votes";
export const RATHER_RECENT_KEY = "dynasty_ticker_rather_recent";
export const RATHER_SESSION_KEY = "dynasty_ticker_rather_session";
export const RATHER_MIN_PLAYER_VALUE = 1800;
export const RATHER_RECENT_LIMIT = 24;
export const RATHER_VOTE_LIMIT = 200;
export const RATHER_MAX_RANK_GAP = 8;
export const RATHER_MAX_VALUE_RATIO = 1.12;
export const RATHER_SAME_POS_WEIGHT = 2.4;
export const RATHER_DRAFT_PICKS_PATH = "./data/nfl_draft_picks.json";
const WR_DEPTH_SLOTS = new Set(["WR", "LWR", "RWR", "SWR"]);

export const DEFAULT_RATHER_FORMAT = Object.freeze({
  scoring: "PPR",
  teams: 12,
  qb: "Superflex",
  type: "Dynasty",
});

export function formatRatherHeadline() {
  return "Who would you rather have?";
}

export function formatRatherDetail(format = DEFAULT_RATHER_FORMAT) {
  const scoring = String(format?.scoring || DEFAULT_RATHER_FORMAT.scoring);
  const teams = Number(format?.teams || DEFAULT_RATHER_FORMAT.teams);
  const qb = String(format?.qb || DEFAULT_RATHER_FORMAT.qb);
  return `${scoring} ${teams}-man ${qb}`;
}

export function formatRatherDetailLong(format = DEFAULT_RATHER_FORMAT) {
  const scoring = String(format?.scoring || DEFAULT_RATHER_FORMAT.scoring);
  const teams = Number(format?.teams || DEFAULT_RATHER_FORMAT.teams);
  const qb = String(format?.qb || DEFAULT_RATHER_FORMAT.qb);
  return `Ticker ${qb} ranks · full ${scoring} scoring · ${teams}-man league · ${qb} QB`;
}

export function pairKey(leftId, rightId) {
  return [String(leftId || ""), String(rightId || "")].sort().join("|");
}

export function listRatherPlayers(values, names, { minValue = RATHER_MIN_PLAYER_VALUE } = {}) {
  const rows = [];
  for (const [assetId, rawValue] of Object.entries(values || {})) {
    if (!String(assetId).startsWith("player:")) continue;
    const value = Number(rawValue);
    const name = String(names?.[assetId] || "").trim();
    const playerId = playerIdFromAssetId(assetId);
    if (!name || !playerId || !Number.isFinite(value) || value < minValue) continue;
    rows.push({ assetId, playerId, name, value });
  }
  return rows.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

export function ratherEffectiveValue(player, shifts = null) {
  return applyLocalCrowdShift(player?.assetId, Number(player?.value), shifts);
}

export function ratherPairWeight(left, right, shifts = null) {
  const leftValue = ratherEffectiveValue(left, shifts);
  const rightValue = ratherEffectiveValue(right, shifts);
  const lo = Math.min(leftValue, rightValue);
  const hi = Math.max(leftValue, rightValue);
  if (!(lo > 0) || !(hi > 0)) return 0;
  const ratio = hi / lo;
  if (ratio > RATHER_MAX_VALUE_RATIO) return 0;
  return (RATHER_MAX_VALUE_RATIO - ratio) + 0.02;
}

export function pickRatherPair(players, { recentKeys = [], random = Math.random, shifts = null } = {}) {
  const ranked = sortRatherPlayers(players, shifts);
  if (ranked.length < 2) return null;

  const recent = new Set((recentKeys || []).map(String));
  const closeOptions = collectRatherPairOptions(ranked, { recent, shifts, requireClose: true });
  const pool = closeOptions.length
    ? closeOptions
    : collectRatherPairOptions(ranked, { recent: new Set(), shifts, requireClose: true });
  const picked = pickWeightedRatherOption(
    pool.length
      ? pool
      : [{
        left: ranked[0],
        right: ranked[1],
        key: pairKey(ranked[0].assetId, ranked[1].assetId),
        weight: 1,
      }],
    random,
  );
  if (clampUnit(random()) < 0.5) {
    return { left: picked.right, right: picked.left, key: picked.key };
  }
  return { left: picked.left, right: picked.right, key: picked.key };
}

export function ratherOrdinal(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "";
  const rank = Math.round(numeric);
  const mod100 = rank % 100;
  if (mod100 >= 10 && mod100 <= 20) return `${rank}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[rank % 10] || "th";
  return `${rank}${suffix}`;
}

export function playerAgeFromNfl(raw) {
  if (raw?.age == null || raw?.age === "") return null;
  const age = Number(raw.age);
  return Number.isFinite(age) && age > 0 ? age : null;
}

export function ratherDepthChartFromNfl(raw, position = "") {
  if (raw?.depth_chart_order == null || raw?.depth_chart_order === "") return "";
  const order = Number(raw.depth_chart_order);
  if (!Number.isFinite(order) || order <= 0) return "";
  const fantasy = String(position || raw?.position || raw?.fantasy_positions?.[0] || "").toUpperCase();
  const slot = String(raw?.depth_chart_position || "").toUpperCase();
  const role = WR_DEPTH_SLOTS.has(slot) ? (fantasy || "WR") : (fantasy || slot);
  return role ? `${role}${order}` : "";
}

export function isRatherRookie(raw, currentSeason) {
  const years = Number(raw?.years_exp);
  if (years === 0) return true;
  const rookieYear = Number(raw?.metadata?.rookie_year);
  const season = Number(currentSeason);
  return Number.isFinite(rookieYear) && Number.isFinite(season) && rookieYear === season;
}

export function parseRatherDraftPicks(payload) {
  if (!payload || typeof payload !== "object") return {};
  if (payload.picks && typeof payload.picks === "object") return payload.picks;
  return payload;
}

export async function fetchRatherDraftPicks(fetchImpl = globalThis.fetch) {
  try {
    const response = await fetchImpl(RATHER_DRAFT_PICKS_PATH, { cache: "no-store" });
    if (!response?.ok) return {};
    return parseRatherDraftPicks(await response.json());
  } catch {
    return {};
  }
}

export function lookupRatherDraftPick(playerId, draftPicks = {}, nflPlayer = {}) {
  const direct = draftPicks?.[String(playerId || "")];
  if (isDraftRow(direct)) return normalizeDraftRow(direct);
  const want = normalizeRatherName(nflPlayer?.full_name || `${nflPlayer?.first_name || ""} ${nflPlayer?.last_name || ""}`);
  if (!want) return null;
  const matches = Object.values(draftPicks || {}).filter((row) => (
    isDraftRow(row) && normalizeRatherName(row.name) === want
  ));
  return matches.length === 1 ? normalizeDraftRow(matches[0]) : null;
}

export function formatRatherDraftLine(draft) {
  if (!draft) return "Rookie";
  const round = ratherOrdinal(draft.round);
  const pick = Number(draft.pick);
  if (round && Number.isFinite(pick)) return `${round} round · pick ${pick}`;
  if (Number.isFinite(pick)) return `Pick ${pick}`;
  return "Rookie";
}

export function formatRatherStatNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "";
  if (Math.abs(numeric - Math.round(numeric)) < 1e-9) {
    return Math.round(numeric).toLocaleString("en-US");
  }
  return numeric.toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
}

export function formatRatherSeasonStats(stats, position) {
  if (!stats || typeof stats !== "object") return "";
  const played = Number(stats.gp) > 0 || Number(stats.gms_active) > 0 || Number(stats.pts_ppr) > 0;
  if (!played) return "";

  const pos = String(position || "").toUpperCase();
  const parts = [];
  if (pos === "QB") {
    pushRatherStat(parts, stats.pass_yd, "pass yds");
    pushRatherStat(parts, stats.pass_td, "TD", { keepZero: true });
    pushRatherStat(parts, stats.pass_int, "INT", { keepZero: true });
  } else if (pos === "RB") {
    pushRatherStat(parts, stats.rush_yd, "rush yds");
    pushRatherStat(parts, stats.rec, "rec");
    const touchdowns = (Number(stats.rush_td) || 0) + (Number(stats.rec_td) || 0);
    pushRatherStat(parts, touchdowns, "TD", { keepZero: true });
  } else if (pos === "WR" || pos === "TE") {
    pushRatherStat(parts, stats.rec, "rec");
    pushRatherStat(parts, stats.rec_yd, "yds");
    pushRatherStat(parts, stats.rec_td, "TD", { keepZero: true });
  } else if (pos === "K") {
    const made = Number(stats.fgm);
    const attempts = Number(stats.fga);
    if (Number.isFinite(made) && Number.isFinite(attempts)) {
      parts.push(`${formatRatherStatNumber(made)}/${formatRatherStatNumber(attempts)} FG`);
    }
  }
  if (!parts.length) {
    pushRatherStat(parts, stats.pts_ppr, "PPR pts");
  }
  return parts.join(" · ");
}

export function ratherPlayerPosition(player, nflPlayers = {}) {
  const direct = String(player?.position || "").toUpperCase();
  if (direct) return direct;
  const raw = nflPlayers?.[player?.playerId] || nflPlayers?.[String(player?.playerId || "")] || {};
  return String(raw.position || raw.fantasy_positions?.[0] || "").toUpperCase();
}

export function formatRatherBoardRank({ position, positionRank, overallRank } = {}) {
  const pos = String(position || "").toUpperCase();
  const rank = Number(positionRank);
  if (pos && Number.isFinite(rank) && rank > 0) return `${pos}${rank}`;
  const overall = Number(overallRank);
  if (Number.isFinite(overall) && overall > 0) return `${ratherOrdinal(overall)} overall`;
  return pos;
}

export function assignRatherBoardRanks(players, nflPlayers = {}) {
  const counts = Object.create(null);
  return (Array.isArray(players) ? players : []).map((player, index) => {
    const position = ratherPlayerPosition(player, nflPlayers);
    const positionRank = position ? (counts[position] = (counts[position] || 0) + 1) : null;
    const overallRank = index + 1;
    return {
      ...player,
      position,
      positionRank,
      overallRank,
      boardRank: formatRatherBoardRank({ position, positionRank, overallRank }),
    };
  });
}

export function buildRatherBoard(players, nflPlayers = {}, shifts = null) {
  return assignRatherBoardRanks(rankRatherPlayers(players, shifts), nflPlayers);
}

export function formatRatherMatchup(left, right) {
  const leftRank = left?.boardRank || formatRatherBoardRank(left);
  const rightRank = right?.boardRank || formatRatherBoardRank(right);
  if (!leftRank || !rightRank) return "";
  if (left?.position && left.position === right?.position) {
    return `${leftRank} vs ${rightRank} on the ticker board`;
  }
  return `${leftRank} vs ${rightRank}`;
}

export function formatRatherPlayerMeta({ boardRank, position, team, age } = {}) {
  const numericAge = Number(age);
  const ageLabel = age != null && age !== "" && Number.isFinite(numericAge) && numericAge > 0
    ? `${numericAge}y`
    : "";
  const rankLabel = boardRank || formatRatherBoardRank({ position }) || position;
  return [rankLabel, team, ageLabel].filter(Boolean).join(" · ");
}

export function formatRatherPlayerDetail({
  isRookie = false,
  draft = null,
  stats = null,
  position = "",
  previousSeason = "",
} = {}) {
  if (isRookie) return formatRatherDraftLine(draft);
  const line = formatRatherSeasonStats(stats, position);
  if (line) return previousSeason ? `${previousSeason} · ${line}` : line;
  return previousSeason ? `No ${previousSeason} stats` : "";
}

export function decorateRatherPlayer(player, nflPlayers = {}, extras = {}) {
  const raw = nflPlayers?.[player?.playerId] || {};
  const position = ratherPlayerPosition(player, nflPlayers);
  const team = String(raw.team || player?.team || "").toUpperCase();
  const age = playerAgeFromNfl(raw) ?? player?.age ?? null;
  const isRookie = isRatherRookie(raw, extras.currentSeason);
  const draft = lookupRatherDraftPick(player?.playerId, extras.draftPicks, raw);
  const stats = extras.seasonStats?.[player?.playerId] || extras.seasonStats?.[String(player?.playerId)] || null;
  const positionRank = Number.isFinite(Number(player?.positionRank)) ? Number(player.positionRank) : null;
  const overallRank = Number.isFinite(Number(player?.overallRank)) ? Number(player.overallRank) : null;
  const boardRank = player?.boardRank || extras.boardRank || formatRatherBoardRank({
    position,
    positionRank,
    overallRank,
  });
  return {
    assetId: player.assetId,
    playerId: player.playerId,
    name: player.name,
    value: player.value,
    position,
    team,
    age,
    positionRank,
    overallRank,
    boardRank,
    isRookie,
    photoUrl: sleeperPlayerThumbUrl(player.playerId),
    initials: playerInitials(player.name),
    meta: formatRatherPlayerMeta({ boardRank, position, team, age }),
    detail: formatRatherPlayerDetail({
      isRookie,
      draft,
      stats,
      position,
      previousSeason: extras.previousSeason,
    }),
  };
}

export function rankRatherPlayers(players, shifts = null) {
  return sortRatherPlayers(players, shifts);
}

export function renderRatherMarkup(pair, format = DEFAULT_RATHER_FORMAT, options = {}) {
  const left = pair?.left || {};
  const right = pair?.right || {};
  const skipLabel = options.skipLabel || "Skip";
  const note = options.note
    || "Your pick slightly nudges the public ticker board for everyone. These ranks are ours, not NFL depth charts. The prior is Sleeper trades mixed with KeepTradeCut.";
  const status = options.status || "";
  const matchup = options.matchup || formatRatherMatchup(left, right);
  return `
    <div class="rather-panel">
      <h2 id="rather-title">${escapeHtml(formatRatherHeadline())}</h2>
      <p class="rather-format" id="rather-format">${escapeHtml(formatRatherDetail(format))}</p>
      <p class="rather-format-detail" id="rather-format-detail">${escapeHtml(formatRatherDetailLong(format))}</p>
      ${matchup ? `<p class="rather-matchup" id="rather-matchup">${escapeHtml(matchup)}</p>` : ""}
      ${status ? `<p class="rather-status" id="rather-status" role="status">${escapeHtml(status)}</p>` : ""}
      <div class="rather-duel">
        ${renderRatherPlayerButton(left, "left")}
        <span class="rather-or" aria-hidden="true">or</span>
        ${renderRatherPlayerButton(right, "right")}
      </div>
      <button type="button" class="rather-skip ghost-btn" id="rather-skip" aria-label="Skip this matchup">${escapeHtml(skipLabel)}</button>
      <p class="rather-note" id="rather-note">${escapeHtml(note)}</p>
    </div>
  `;
}

export function renderLandingRatherPlaceholder() {
  return `
    <div class="rather-panel landing-rather-pending">
      <h2 id="rather-title">${escapeHtml(formatRatherHeadline())}</h2>
      <p class="rather-format" id="rather-format">${escapeHtml(formatRatherDetail())}</p>
      <p class="rather-format-detail" id="rather-format-detail">${escapeHtml(formatRatherDetailLong())}</p>
      <p class="muted">Loading a close matchup…</p>
    </div>
  `;
}

function applyLocalCrowdShift(assetId, value, shifts) {
  const shift = Number(shifts?.[assetId]);
  if (!Number.isFinite(value) || !Number.isFinite(shift)) return Number.isFinite(value) ? value : 0;
  return value * (1 + shift);
}

function sortRatherPlayers(players, shifts = null) {
  const rows = Array.isArray(players) ? players.filter((row) => row?.assetId && row?.name) : [];
  return [...rows].sort((a, b) => {
    const aValue = ratherEffectiveValue(a, shifts);
    const bValue = ratherEffectiveValue(b, shifts);
    return bValue - aValue || String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function collectRatherPairOptions(ranked, { recent, shifts, requireClose }) {
  const options = [];
  const seen = new Set();
  const pushPair = (left, right, extraWeight = 1) => {
    if (!left?.assetId || !right?.assetId || left.assetId === right.assetId) return;
    const key = pairKey(left.assetId, right.assetId);
    if (recent.has(key) || seen.has(key)) return;
    const weight = ratherPairWeight(left, right, shifts);
    if (requireClose && weight <= 0) return;
    seen.add(key);
    options.push({ left, right, key, weight: (weight || 1) * extraWeight });
  };

  const byPosition = new Map();
  ranked.forEach((player) => {
    const pos = String(player.position || "").toUpperCase();
    if (!pos) return;
    if (!byPosition.has(pos)) byPosition.set(pos, []);
    byPosition.get(pos).push(player);
  });
  byPosition.forEach((group) => {
    for (let index = 0; index < group.length - 1; index += 1) {
      for (let gap = 1; gap <= RATHER_MAX_RANK_GAP && index + gap < group.length; gap += 1) {
        pushPair(group[index], group[index + gap], RATHER_SAME_POS_WEIGHT);
      }
    }
  });

  for (let index = 0; index < ranked.length - 1; index += 1) {
    for (let gap = 1; gap <= RATHER_MAX_RANK_GAP && index + gap < ranked.length; gap += 1) {
      pushPair(ranked[index], ranked[index + gap], 1);
    }
  }
  return options;
}

function pickWeightedRatherOption(options, random) {
  if (!options.length) return null;
  const total = options.reduce((sum, option) => sum + Number(option.weight || 0), 0);
  if (!(total > 0)) return options[0];
  let cursor = clampUnit(random()) * total;
  for (const option of options) {
    cursor -= Number(option.weight || 0);
    if (cursor <= 0) return option;
  }
  return options[options.length - 1];
}

export function applyRatherOverlayHidden(overlay, hidden) {
  if (!overlay) return;
  const hide = Boolean(hidden);
  overlay.hidden = hide;
  overlay.classList?.toggle?.("hidden", hide);
}

function renderRatherPlayerButton(player, side) {
  const name = player?.name || "Player";
  const initials = player?.initials || playerInitials(name);
  const photo = player?.photoUrl
    ? `<img class="rather-photo" src="${escapeHtml(player.photoUrl)}" alt="" width="96" height="96" data-initials="${escapeHtml(initials)}">`
    : "";
  const meta = player?.meta
    ? `<small class="rather-meta">${escapeHtml(player.meta)}</small>`
    : "";
  const detail = player?.detail
    ? `<small class="rather-stats">${escapeHtml(player.detail)}</small>`
    : "";
  return `
    <button
      type="button"
      class="rather-player"
      data-rather-pick="${escapeHtml(player?.assetId || "")}"
      data-rather-side="${escapeHtml(side)}"
    >
      <span class="rather-headshot" aria-hidden="true">
        ${photo}
        <span class="rather-initials">${escapeHtml(initials)}</span>
      </span>
      <strong>${escapeHtml(name)}</strong>
      ${meta}
      ${detail}
    </button>
  `;
}

export function readRatherSessionDone(storage = globalThis.sessionStorage) {
  try {
    return storage?.getItem(RATHER_SESSION_KEY) === "1";
  } catch {
    return true;
  }
}

export function writeRatherSessionDone(storage = globalThis.sessionStorage) {
  try {
    storage?.setItem(RATHER_SESSION_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

export function readRatherRecentKeys(storage = globalThis.localStorage) {
  const parsed = readJson(storage, RATHER_RECENT_KEY);
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

export function pushRatherRecentKey(key, storage = globalThis.localStorage, limit = RATHER_RECENT_LIMIT) {
  const next = [String(key), ...readRatherRecentKeys(storage).filter((item) => item !== String(key))]
    .slice(0, limit);
  writeJson(storage, RATHER_RECENT_KEY, next);
  return next;
}

export function readRatherVotes(storage = globalThis.localStorage) {
  const parsed = readJson(storage, RATHER_VOTES_KEY);
  return Array.isArray(parsed) ? parsed : [];
}

export function recordRatherVote(vote, storage = globalThis.localStorage, limit = RATHER_VOTE_LIMIT) {
  const winnerId = String(vote?.winnerId || "");
  const loserId = String(vote?.loserId || "");
  if (!winnerId || !loserId || winnerId === loserId) return readRatherVotes(storage);
  const entry = {
    winnerId,
    loserId,
    format: formatRatherDetail(vote?.format || DEFAULT_RATHER_FORMAT),
    at: Number(vote?.at) || Date.now(),
  };
  const next = [entry, ...readRatherVotes(storage)].slice(0, limit);
  writeJson(storage, RATHER_VOTES_KEY, next);
  return next;
}

function clampUnit(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(1, Math.max(0, numeric));
}

function isDraftRow(row) {
  return Number.isFinite(Number(row?.round)) && Number.isFinite(Number(row?.pick));
}

function normalizeDraftRow(row) {
  return {
    year: Number(row.year) || null,
    round: Number(row.round),
    pick: Number(row.pick),
    name: String(row.name || ""),
  };
}

function normalizeRatherName(name) {
  return String(name || "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9\s]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function pushRatherStat(parts, value, label, { keepZero = false } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return;
  if (numeric === 0 && !keepZero) return;
  parts.push(`${formatRatherStatNumber(numeric)} ${label}`);
}

function readJson(storage, key) {
  try {
    const raw = storage?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(storage, key, value) {
  try {
    storage?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
