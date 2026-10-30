// Draft order for future picks: current standings, with roster strength only
// breaking a tied record. Plain pick values build on this; no mock-draft data.
import { compareRosterRecord, ordinal, pointsAgainstFromSettings, sleeperPoints } from "./standings.js";

export function projectedDraftSlot(placeRank, teamCount) {
  const rank = Number(placeRank);
  const total = Number(teamCount);
  if (!Number.isFinite(rank) || !Number.isFinite(total) || rank < 1 || total < 1) return null;
  if (rank > total) return null;
  return total - rank + 1;
}

export function compareProjectedDraftOrder(a, b) {
  const record = compareRosterRecord(
    { ...a, rosterId: "\0" },
    { ...b, rosterId: "\0" },
  );
  if (record) return record;
  const starter = (Number(b.starterValue) || 0) - (Number(a.starterValue) || 0);
  if (starter) return starter;
  const bench = (Number(b.benchValue) || 0) - (Number(a.benchValue) || 0);
  if (bench) return bench;
  return String(a.rosterId ?? "").localeCompare(String(b.rosterId ?? ""), undefined, { numeric: true });
}

function strengthForRoster(strengthByRosterId, rosterId) {
  if (!strengthByRosterId) return { starterValue: 0, benchValue: 0 };
  const row = strengthByRosterId instanceof Map
    ? strengthByRosterId.get(String(rosterId))
    : strengthByRosterId[String(rosterId)];
  return {
    starterValue: Number(row?.starterValue) || 0,
    benchValue: Number(row?.benchValue) || 0,
  };
}

function recordKey(row) {
  const against = Number.isFinite(Number(row.pointsAgainst)) ? Number(row.pointsAgainst) : "";
  return [row.wins, row.losses, row.ties, row.points, against].join(":");
}

export function rosterPointsFor(roster) {
  const settings = roster?.settings || {};
  if (settings.fpts == null) return 0;
  return sleeperPoints(settings.fpts, settings.fpts_decimal) ?? 0;
}

export function buildCurrentPlaceLookup(rosters = [], standings = [], strengthByRosterId = null) {
  if (Array.isArray(standings) && standings.length) {
    const ranked = standings
      .map((team, index) => ({
        rosterId: String(team?.rosterId ?? ""),
        wins: Number(team?.wins) || 0,
        losses: Number(team?.losses) || 0,
        ties: Number(team?.ties) || 0,
        points: Number(team?.pf) || 0,
        pointsAgainst: Number.isFinite(Number(team?.pa)) ? Number(team.pa) : null,
        fallbackRank: Number(team?.rank) || index + 1,
        ...strengthForRoster(strengthByRosterId, team?.rosterId),
      }))
      .filter((row) => row.rosterId)
      .sort((a, b) => {
        if (recordKey(a) !== recordKey(b)) return a.fallbackRank - b.fallbackRank;
        const hasStrength = a.starterValue || b.starterValue || a.benchValue || b.benchValue;
        if (!hasStrength) return a.fallbackRank - b.fallbackRank;
        return compareProjectedDraftOrder(a, b) || a.fallbackRank - b.fallbackRank;
      });
    const byRosterId = new Map();
    const total = ranked.length;
    ranked.forEach((row, index) => {
      const rank = index + 1;
      byRosterId.set(row.rosterId, { rank, total, label: ordinal(rank) });
    });
    return { byRosterId, total };
  }

  const ranked = [...(Array.isArray(rosters) ? rosters : [])]
    .map((roster) => ({
      rosterId: String(roster?.roster_id ?? ""),
      wins: Number(roster?.settings?.wins || 0),
      losses: Number(roster?.settings?.losses || 0),
      ties: Number(roster?.settings?.ties || 0),
      points: rosterPointsFor(roster),
      pointsAgainst: pointsAgainstFromSettings(roster?.settings),
      ...strengthForRoster(strengthByRosterId, roster?.roster_id),
    }))
    .filter((row) => row.rosterId)
    .sort(compareProjectedDraftOrder);

  const byRosterId = new Map();
  const total = ranked.length;
  ranked.forEach((row, index) => {
    const rank = index + 1;
    byRosterId.set(row.rosterId, { rank, total, label: ordinal(rank) });
  });
  return { byRosterId, total };
}

export function currentPlaceForOwner(originalOwner, placeLookup) {
  if (originalOwner == null) return null;
  return placeLookup?.byRosterId?.get(String(originalOwner)) || null;
}

export function formatPickSlotLabel(round, slot) {
  const rnd = Number(round);
  const n = Number(slot);
  if (!Number.isFinite(rnd) || !Number.isFinite(n) || rnd < 1 || n < 1) return "";
  return `${rnd}.${String(n).padStart(2, "0")}`;
}
