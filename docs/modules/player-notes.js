// Player notes for the rankings board: age, rookie draft slot, last season's line,
// and the position rank (WR3). Plain market price order; no crowd adjustments.

export const DRAFT_PICKS_PATH = "./data/nfl_draft_picks.json";

export function ordinal(value) {
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

export function isRookiePlayer(raw, currentSeason) {
  const years = Number(raw?.years_exp);
  if (years === 0) return true;
  const rookieYear = Number(raw?.metadata?.rookie_year);
  const season = Number(currentSeason);
  return Number.isFinite(rookieYear) && Number.isFinite(season) && rookieYear === season;
}

export function parseDraftPicks(payload) {
  if (!payload || typeof payload !== "object") return {};
  if (payload.picks && typeof payload.picks === "object") return payload.picks;
  return payload;
}

export async function fetchNflDraftPicks(fetchImpl = globalThis.fetch) {
  try {
    const response = await fetchImpl(DRAFT_PICKS_PATH, { cache: "no-store" });
    if (!response?.ok) return {};
    return parseDraftPicks(await response.json());
  } catch {
    return {};
  }
}

export function lookupNflDraftPick(playerId, draftPicks = {}, nflPlayer = {}) {
  const direct = draftPicks?.[String(playerId || "")];
  if (isDraftRow(direct)) return normalizeDraftRow(direct);
  const want = normalizeName(nflPlayer?.full_name || `${nflPlayer?.first_name || ""} ${nflPlayer?.last_name || ""}`);
  if (!want) return null;
  const matches = Object.values(draftPicks || {}).filter((row) => (
    isDraftRow(row) && normalizeName(row.name) === want
  ));
  return matches.length === 1 ? normalizeDraftRow(matches[0]) : null;
}

export function formatDraftLine(draft) {
  if (!draft) return "Rookie";
  const round = ordinal(draft.round);
  const pick = Number(draft.pick);
  if (round && Number.isFinite(pick)) return `${round} round · pick ${pick}`;
  if (Number.isFinite(pick)) return `Pick ${pick}`;
  return "Rookie";
}

export function formatStatNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "";
  if (Math.abs(numeric - Math.round(numeric)) < 1e-9) {
    return Math.round(numeric).toLocaleString("en-US");
  }
  return numeric.toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
}

export function formatSeasonStats(stats, position) {
  if (!stats || typeof stats !== "object") return "";
  const played = Number(stats.gp) > 0 || Number(stats.gms_active) > 0 || Number(stats.pts_ppr) > 0;
  if (!played) return "";

  const pos = String(position || "").toUpperCase();
  const parts = [];
  if (pos === "QB") {
    pushStat(parts, stats.pass_yd, "pass yds");
    pushStat(parts, stats.pass_td, "TD", { keepZero: true });
    pushStat(parts, stats.pass_int, "INT", { keepZero: true });
  } else if (pos === "RB") {
    pushStat(parts, stats.rush_yd, "rush yds");
    pushStat(parts, stats.rec, "rec");
    const touchdowns = (Number(stats.rush_td) || 0) + (Number(stats.rec_td) || 0);
    pushStat(parts, touchdowns, "TD", { keepZero: true });
  } else if (pos === "WR" || pos === "TE") {
    pushStat(parts, stats.rec, "rec");
    pushStat(parts, stats.rec_yd, "yds");
    pushStat(parts, stats.rec_td, "TD", { keepZero: true });
  } else if (pos === "K") {
    const made = Number(stats.fgm);
    const attempts = Number(stats.fga);
    if (Number.isFinite(made) && Number.isFinite(attempts)) {
      parts.push(`${formatStatNumber(made)}/${formatStatNumber(attempts)} FG`);
    }
  }
  if (!parts.length) {
    pushStat(parts, stats.pts_ppr, "PPR pts");
  }
  return parts.join(" · ");
}

export function boardPlayerPosition(player, nflPlayers = {}) {
  const direct = String(player?.position || "").toUpperCase();
  if (direct) return direct;
  const raw = nflPlayers?.[player?.playerId] || nflPlayers?.[String(player?.playerId || "")] || {};
  return String(raw.position || raw.fantasy_positions?.[0] || "").toUpperCase();
}

export function formatBoardRank({ position, positionRank, overallRank } = {}) {
  const pos = String(position || "").toUpperCase();
  const rank = Number(positionRank);
  if (pos && Number.isFinite(rank) && rank > 0) return `${pos}${rank}`;
  const overall = Number(overallRank);
  if (Number.isFinite(overall) && overall > 0) return `${ordinal(overall)} overall`;
  return pos;
}

export function assignBoardRanks(players, nflPlayers = {}) {
  const counts = Object.create(null);
  return (Array.isArray(players) ? players : []).map((player, index) => {
    const position = boardPlayerPosition(player, nflPlayers);
    const positionRank = position ? (counts[position] = (counts[position] || 0) + 1) : null;
    const overallRank = index + 1;
    return {
      ...player,
      position,
      positionRank,
      overallRank,
      boardRank: formatBoardRank({ position, positionRank, overallRank }),
    };
  });
}

export function buildPositionBoard(players, nflPlayers = {}) {
  const rows = Array.isArray(players) ? players.filter((row) => row?.assetId && row?.name) : [];
  const sorted = [...rows].sort((a, b) => (
    (Number(b.value) || 0) - (Number(a.value) || 0) || String(a.name || "").localeCompare(String(b.name || ""))
  ));
  return assignBoardRanks(sorted, nflPlayers);
}

export function formatPlayerDetail({
  isRookie = false,
  draft = null,
  stats = null,
  position = "",
  previousSeason = "",
} = {}) {
  if (isRookie) return formatDraftLine(draft);
  const line = formatSeasonStats(stats, position);
  if (line) return previousSeason ? `${previousSeason} · ${line}` : line;
  return previousSeason ? `No ${previousSeason} stats` : "";
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

function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9\s]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function pushStat(parts, value, label, { keepZero = false } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return;
  if (numeric === 0 && !keepZero) return;
  parts.push(`${formatStatNumber(numeric)} ${label}`);
}
