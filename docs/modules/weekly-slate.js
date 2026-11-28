// Current-week lineup advice uses Sleeper point projections and player statuses.
// ESPN's weekly scoreboard supplies scheduled kickoffs, live states, and explicit byes.
import { apiGetWithRetry, createSleeperClient } from "./sleeper.js";

export const WEEKLY_SLATE_TTL_MS = 5 * 60 * 1000;

const projections = createSleeperClient({ baseUrl: "https://api.sleeper.app" });
const scoreboard = createSleeperClient({ baseUrl: "https://site.api.espn.com/apis/site/v2/sports/football/nfl" });
const positions = ["QB", "RB", "WR", "TE", "K", "DEF"];
const inactiveStatuses = new Set(["IR", "PUP", "SUS", "SUSPENDED", "NA", "NFI", "INACTIVE", "COV"]);
const teamAliases = { WSH: "WAS", JAC: "JAX", LA: "LAR" };
const teamCode = (value) => teamAliases[value] || String(value || "").toUpperCase();
const pointsOrNull = (value) => Number.isFinite(value) ? value : null;

function scheduleByTeam(board, season, week) {
  if (Number(board?.season?.type) !== 2 || String(board.season.year) !== season
    || Number(board?.week?.number) !== week || !board.events?.length) {
    throw new Error("The schedule for this NFL week is unavailable.");
  }
  const schedule = new Map();
  for (const team of board.week.teamsOnBye || []) {
    schedule.set(teamCode(team.abbreviation), { bye: true });
  }
  for (const event of board.events) {
    const game = event.competitions?.[0];
    if (Number(event.week?.number) !== week || game?.competitors?.length !== 2) continue;
    const teams = game.competitors.map((side) => teamCode(side.team?.abbreviation));
    if (!teams.every(Boolean)) continue;
    const state = game.status?.type;
    const locked = state?.state === "in" || state?.state === "post";
    // A postponed game can still carry its original date.
    const scheduled = state?.name === "STATUS_SCHEDULED" && game.timeValid === true;
    const ms = Date.parse(game.date);
    const kickoff = (locked || scheduled) && Number.isFinite(ms) ? new Date(ms).toISOString() : null;
    for (const [i, team] of teams.entries()) {
      schedule.set(team, { opponent: teams[1 - i], kickoff, locked });
    }
  }
  return schedule;
}

function playerAvailability(status, team, game, projectedTeam, projectedOpponent, points) {
  if (!team) return ["inactive", "No NFL team"];
  if (game?.bye) return ["bye", "Bye week"];
  if (status?.toUpperCase() === "OUT") return ["out", "Ruled out"];
  if (status?.toUpperCase() === "DOUBTFUL") return ["inactive", "Doubtful to play"];
  if (inactiveStatuses.has(status?.toUpperCase())) return ["inactive", status];
  if (!game?.kickoff) return ["unknown", "Kickoff unavailable"];
  if ((projectedTeam && team !== projectedTeam) || (projectedOpponent && game.opponent !== projectedOpponent)) {
    return ["unknown", "Projection and schedule disagree"];
  }
  if (points === null) return ["unknown", "No weekly projection"];
  return ["available", null];
}

// Sleeper may omit a rostered player entirely. A known team can still confirm
// a bye or kickoff. Keep missing points unknown, even if old registry data
// contains a healthy/injured label.
export function weeklyPlayer(slate, id, bio = {}) {
  if (slate?.players?.[id]) return slate.players[id];
  const raw = bio || {};
  const team = teamCode(raw.team);
  const game = slate?.games?.[team];
  const bye = Boolean(game?.bye);
  return {
    id: String(id), name: raw.full_name || [raw.first_name, raw.last_name].filter(Boolean).join(" "),
    team, position: raw.position || "", positions: raw.fantasy_positions || (raw.position ? [raw.position] : []),
    opponent: game?.opponent || null, kickoff: game?.kickoff || null, locked: Boolean(game?.locked),
    points: null, halfPpr: null, standard: null, status: null,
    availability: bye ? "bye" : "unknown", reason: bye ? "Bye week" : "No weekly projection",
  };
}

// Use the league's reception setting only. Sleeper baseline totals do not
// account for this league's other scoring rules (bonuses, passing TDs, etc.).
export function weeklyScoring(league) {
  const settings = league?.scoring_settings;
  const receptions = settings ? Number(settings.rec ?? 0) : NaN;
  if (receptions === 0.5) return { label: "Half-PPR baseline", pointsKey: "halfPpr" };
  if (receptions === 0) return { label: "Standard baseline", pointsKey: "standard" };
  return { label: "Full-PPR baseline", pointsKey: "points" };
}

// Recheck kickoff when displaying or changing a comparison while the tab is open.
export function weeklyUnavailable(player, now = Date.now()) {
  if (!player) return "No weekly projection";
  if (player.locked || Date.parse(player.kickoff) <= now) return "Game has started";
  return player.reason;
}

export async function loadWeeklySlate({ signal } = {}) {
  const options = { signal, timeoutMs: 12000, retries: 1, cache: "no-store" };
  const state = await apiGetWithRetry("/state/nfl", options);
  const season = String(state?.season || "");
  if (!/^\d{4}$/.test(season) || !state.season_type) throw new Error("The current NFL week is unavailable.");
  if (state.season_type !== "regular") {
    return { season, week: null, offSeason: true, fetchedAt: new Date().toISOString(), players: {}, games: {} };
  }
  const week = Number(state.week);
  if (!Number.isInteger(week) || week < 1 || week > 18) throw new Error("The current NFL week is unavailable.");

  // The projection records already include Sleeper's player and injury metadata.
  // Fetch just the supported fantasy positions, without a second full player registry download.
  const query = new URLSearchParams({ season_type: "regular" });
  for (const position of positions) query.append("position[]", position);
  const [rows, board] = await Promise.all([
    projections.apiGetWithRetry(`/projections/nfl/${season}/${week}?${query}`, options),
    scoreboard.apiGetWithRetry(`/scoreboard?dates=${season}&seasontype=2&week=${week}`, options),
  ]);
  if (!Array.isArray(rows)) throw new Error("Weekly projections are unavailable.");
  const schedule = scheduleByTeam(board, season, week);
  const players = Object.create(null);
  for (const row of rows) {
    const player = row?.player;
    if (!row?.player_id || !positions.includes(player?.position) || String(row.season) !== season
      || Number(row.week) !== week || row.season_type !== "regular") continue;
    const id = String(row.player_id);
    const team = teamCode(player.team);
    const game = schedule.get(team);
    const points = pointsOrNull(row.stats?.pts_ppr);
    const status = player.injury_status || null;
    const [availability, reason] = playerAvailability(status, team, game, teamCode(row.team), teamCode(row.opponent), points);
    players[id] = {
      id, name: [player.first_name, player.last_name].filter(Boolean).join(" ") || (player.position === "DEF" ? team : ""), team,
      position: player.position, positions: [...new Set([player.position, ...(player.fantasy_positions || [])])],
      opponent: game?.opponent || null, kickoff: game?.kickoff || null, locked: Boolean(game?.locked),
      points, halfPpr: pointsOrNull(row.stats?.pts_half_ppr), standard: pointsOrNull(row.stats?.pts_std),
      status, availability, reason,
    };
  }
  if (!Object.keys(players).length) throw new Error("Weekly projections are unavailable.");
  return { season, week, offSeason: false, fetchedAt: new Date().toISOString(), players, games: Object.fromEntries(schedule) };
}
