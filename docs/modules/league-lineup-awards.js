import { chooseBestLineup } from "./lineup.js";
import { resolveRosterIdentity } from "./franchise.js";

const id = (value) => String(value ?? "").trim();
const round2 = (value) => Math.round(value * 100) / 100;
const BENCH = new Set(["BN", "IR", "TAXI", "RES", "NA", "INJURED_RESERVE"]);
const FLEX = Object.freeze({
  FLEX: ["RB", "WR", "TE"],
  SUPER_FLEX: ["QB", "RB", "WR", "TE"],
  WRRB_FLEX: ["WR", "RB"],
  REC_FLEX: ["WR", "TE"],
  IDP_FLEX: ["DL", "LB", "DB", "DE", "DT", "CB", "S"],
});
const slotSupported = (slot) => !BENCH.has(slot) &&
  (Boolean(FLEX[slot]) || /^(QB|RB|WR|TE|K|DEF|DL|LB|DB|DE|DT|CB|S|FS|SS|EDGE)$/.test(slot));

function canFill(player, slot) {
  if (FLEX[slot]) return player.positions.some((position) => FLEX[slot].includes(position));
  return player.positions.includes(slot);
}

function teamIdentity(archive, entry, rosterId) {
  const roster = (entry.rosters || []).find((row) => id(row.roster_id) === id(rosterId));
  return resolveRosterIdentity(archive.franchiseIndex, {
    userId: roster?.owner_id, leagueId: entry.leagueId, rosterId,
  });
}

function evaluateWeek(row, slots, players) {
  const starters = Array.isArray(row?.starters) ? row.starters.map(id) : null;
  const starterPoints = Array.isArray(row?.starters_points) ? row.starters_points : null;
  const rostered = Array.isArray(row?.players) ? row.players.map(id).filter(Boolean) : null;
  const points = row?.players_points;
  if (!starters || !starterPoints || !rostered || !points
    || starters.length !== slots.length || starterPoints.length !== slots.length
    || starterPoints.some((value) => !Number.isFinite(Number(value)))) return null;

  const candidates = [];
  for (const playerId of rostered) {
    const raw = players[playerId];
    const positions = [...new Set([
      ...(Array.isArray(raw?.fantasy_positions) ? raw.fantasy_positions : []), raw?.position,
    ].map((position) => id(position).toUpperCase()).filter(Boolean))];
    const value = Number(points[playerId]);
    // If history or position metadata is missing, do not credit a false
    // optimal lineup created by silently discarding a rostered player.
    if (!positions.length || !Number.isFinite(value)) return null;
    candidates.push({ playerId, positions, value });
  }
  const optimal = chooseBestLineup(slots.map((slot) => ({ slot })), candidates, canFill);
  if (!optimal || !Number.isFinite(optimal.score) || optimal.score <= 0) return null;
  const actual = starterPoints.reduce((sum, score) => sum + Number(score), 0);
  if (actual > optimal.score + 0.5 || actual < 0) return null;
  return { actual: round2(actual), optimal: round2(optimal.score),
    left: round2(Math.max(0, optimal.score - actual)) };
}

// A season must have completed weekly matchups and position metadata to
// qualify. The optimization uses the very same assignment solver as My Team;
// unavailable players/weeks are not assumed to be zero-cost bench mistakes.
export function lineupAwards(archive = {}, { players = {}, minWeeks = 6 } = {}) {
  const byManager = new Map();
  let examinedWeeks = 0;
  let validWeeks = 0;
  let unavailableWeeks = 0;
  for (const entry of archive.seasons || []) {
    const slots = (entry.league?.roster_positions || []).map((value) => id(value).toUpperCase())
      .filter((slot) => !BENCH.has(slot));
    if (!slots.length || slots.some((slot) => !slotSupported(slot))) continue;
    for (const [week, rows] of Object.entries(archive.matchups?.[id(entry.season)] || {})) {
      for (const row of rows || []) {
        if (row?.roster_id == null) continue;
        examinedWeeks++;
        const evaluated = evaluateWeek(row, slots, players);
        if (!evaluated) { unavailableWeeks++; continue; }
        validWeeks++;
        const rosterId = id(row.roster_id);
        const person = teamIdentity(archive, entry, rosterId);
        const key = person.managerKey;
        if (!byManager.has(key)) byManager.set(key, {
          key, name: person.managerName, weeks: 0, actualPoints: 0,
          optimalPoints: 0, pointsLeft: 0, worstWeek: null,
        });
        const manager = byManager.get(key);
        manager.name = person.managerName;
        manager.weeks++;
        manager.actualPoints += evaluated.actual;
        manager.optimalPoints += evaluated.optimal;
        manager.pointsLeft += evaluated.left;
        if (!manager.worstWeek || manager.worstWeek.left < evaluated.left) {
          manager.worstWeek = { season: id(entry.season), week: Number(week),
            pointsLeft: evaluated.left, actual: evaluated.actual, optimal: evaluated.optimal };
        }
      }
    }
  }
  const standings = [...byManager.values()].map((row) => ({
    ...row, eligible: row.weeks >= minWeeks,
    efficiency: row.optimalPoints > 0 ? round2(row.actualPoints / row.optimalPoints * 100) : null,
    averageLeft: row.weeks ? round2(row.pointsLeft / row.weeks) : null,
    pointsLeft: round2(row.pointsLeft),
  })).sort((a, b) => b.efficiency - a.efficiency || b.weeks - a.weeks);
  const eligible = standings.filter((row) => row.eligible);
  return {
    best: eligible[0] || null,
    worst: eligible.length > 1 ? eligible[eligible.length - 1] : null,
    standings, minWeeks, examinedWeeks, validWeeks, unavailableWeeks,
    method: "Starter efficiency = points scored by the submitted lineup divided by the optimal legal lineup using the same rostered players and their Sleeper weekly points. At least 6 fully evaluated weeks required. Missing positions or weekly points exclude that week.",
  };
}
