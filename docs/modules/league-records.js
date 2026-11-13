import { resolveRosterIdentity } from "./franchise.js";

// League history draws facts from each Sleeper season rather than projecting
// today's teams backward. Every source carries its original season/week.
const id = (value) => String(value ?? "").trim();
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const points = (settings = {}, key) => number(settings[key]) + number(settings[`${key}_decimal`]) / 100;
const round2 = (value) => Math.round(value * 100) / 100;

function rosterName(entry, rosterId) {
  const roster = (entry.rosters || []).find((row) => id(row.roster_id) === id(rosterId));
  const user = (entry.users || []).find((row) => id(row.user_id) === id(roster?.owner_id));
  return user?.metadata?.team_name || user?.display_name || user?.username || `Roster ${rosterId}`;
}
function seasonOrder(a, b) { return number(b.season) - number(a.season); }
function rosterRecord(roster) {
  const s = roster?.settings || {};
  return { wins: number(s.wins), losses: number(s.losses), ties: number(s.ties),
    pf: points(s, "fpts"), pa: points(s, "fpts_against") };
}
function isCompleted(entry) { return entry?.league?.status === "complete"; }
function finish(entry) {
  if (!isCompleted(entry)) return null;
  return (entry.winnersBracket || []).find((match) => number(match.p) === 1 && match.w != null) || null;
}

export function championsWall(archive = {}) {
  return (archive.seasons || []).slice().sort(seasonOrder).map((entry) => {
    const final = finish(entry);
    const sorted = (entry.rosters || []).slice().sort((a, b) => {
      const x = rosterRecord(a), y = rosterRecord(b);
      return y.wins - x.wins || x.losses - y.losses || y.pf - x.pf;
    });
    const pointsSorted = (entry.rosters || []).slice().sort((a, b) =>
      rosterRecord(b).pf - rosterRecord(a).pf);
    return {
      season: id(entry.season), leagueId: id(entry.leagueId),
      completed: isCompleted(entry),
      champion: final ? rosterName(entry, final.w) : null,
      runnerUp: final?.l != null ? rosterName(entry, final.l) : null,
      regularLeader: sorted.length ? rosterName(entry, sorted[0].roster_id) : null,
      pointsLeader: pointsSorted.length ? rosterName(entry, pointsSorted[0].roster_id) : null,
      lastPlace: sorted.length ? rosterName(entry, sorted[sorted.length - 1].roster_id) : null,
      consolationWinner: (() => {
        const game = (entry.losersBracket || []).find((match) => number(match.p) === 1 && match.w != null);
        return isCompleted(entry) && game ? rosterName(entry, game.w) : null;
      })(),
    };
  });
}

export function seasonGames(entry, archive) {
  const byWeek = archive?.matchups?.[id(entry.season)] || {};
  const games = [];
  for (const [week, rows] of Object.entries(byWeek)) {
    const byMatchup = new Map();
    for (const row of rows || []) {
      if (row?.matchup_id == null || row?.roster_id == null) continue;
      const key = id(row.matchup_id);
      if (!byMatchup.has(key)) byMatchup.set(key, []);
      byMatchup.get(key).push(row);
    }
    for (const pair of byMatchup.values()) {
      if (pair.length !== 2) continue; // A bye is not a head-to-head game.
      const [a, b] = pair;
      const left = Number(a.points), right = Number(b.points);
      if (!Number.isFinite(left) || !Number.isFinite(right) || (left === 0 && right === 0)) continue;
      games.push({ season: id(entry.season), leagueId: id(entry.leagueId), week: number(week),
        playoff: number(week) >= number(entry.league?.settings?.playoff_week_start || 15),
        teams: [
          { rosterId: id(a.roster_id), name: rosterName(entry, a.roster_id), points: left },
          { rosterId: id(b.roster_id), name: rosterName(entry, b.roster_id), points: right },
        ],
      });
    }
  }
  return games;
}

export function leagueRecordBook(archive = {}) {
  const allGames = (archive.seasons || []).flatMap((entry) => seasonGames(entry, archive));
  const records = {};
  const set = (key, candidate, higher) => {
    if (!candidate || !Number.isFinite(candidate.value)) return;
    const previous = records[key];
    if (!previous || (higher ? candidate.value > previous.value : candidate.value < previous.value)) {
      records[key] = candidate;
    }
  };
  for (const game of allGames) {
    const [a, b] = game.teams;
    const base = { season: game.season, leagueId: game.leagueId, week: game.week };
    const winner = a.points > b.points ? a : b.points > a.points ? b : null;
    const loser = winner ? (winner === a ? b : a) : null;
    for (const side of [a, b]) {
      set("highWeek", { ...base, team: side.name, value: side.points }, true);
      set("lowWeek", { ...base, team: side.name, value: side.points }, false);
    }
    if (!winner) continue;
    set("biggestWin", { ...base, team: winner.name, opponent: loser.name,
      value: round2(winner.points - loser.points) }, true);
    set("closestWin", { ...base, team: winner.name, opponent: loser.name,
      value: round2(winner.points - loser.points) }, false);
    set("mostInLoss", { ...base, team: loser.name, opponent: winner.name, value: loser.points }, true);
    set("fewestInWin", { ...base, team: winner.name, opponent: loser.name, value: winner.points }, false);
  }
  // A team has a season record even when matchup-by-week data is unavailable.
  for (const entry of archive.seasons || []) {
    for (const roster of entry.rosters || []) {
      const record = rosterRecord(roster);
      set("highSeasonPF", { season: id(entry.season), leagueId: id(entry.leagueId),
        team: rosterName(entry, roster.roster_id), value: round2(record.pf) }, true);
      set("bestSeasonRecord", { season: id(entry.season), leagueId: id(entry.leagueId),
        team: rosterName(entry, roster.roster_id),
        value: record.wins + record.losses + record.ties
          ? round2((record.wins + record.ties / 2) / (record.wins + record.losses + record.ties) * 100) : NaN,
        record: `${record.wins}-${record.losses}-${record.ties}` }, true);
    }
  }
  return { records, gamesRead: allGames.length, seasonsRead: (archive.seasons || []).length };
}

export function allTimeStandings(archive = {}) {
  const byManager = new Map();
  const index = archive.franchiseIndex;
  for (const entry of archive.seasons || []) {
    const final = finish(entry);
    const playoffTeams = new Set((entry.winnersBracket || []).flatMap((game) => [id(game.t1), id(game.t2), id(game.w), id(game.l)]).filter(Boolean));
    for (const roster of entry.rosters || []) {
      const rosterId = id(roster.roster_id);
      const identity = resolveRosterIdentity(index, { userId: roster.owner_id,
        leagueId: entry.leagueId, rosterId });
      const key = identity.managerKey;
      if (!byManager.has(key)) byManager.set(key, {
        key, name: identity.managerName, seasons: 0, wins: 0, losses: 0, ties: 0,
        pf: 0, pa: 0, playoffAppearances: 0, titles: 0, finals: 0,
      });
      const total = byManager.get(key);
      const record = rosterRecord(roster);
      total.name = identity.managerName;
      total.seasons += 1;
      total.wins += record.wins;
      total.losses += record.losses;
      total.ties += record.ties;
      total.pf += record.pf;
      total.pa += record.pa;
      if (playoffTeams.has(rosterId)) total.playoffAppearances += 1;
      if (final && id(final.w) === rosterId) total.titles += 1;
      if (final && (id(final.w) === rosterId || id(final.l) === rosterId)) total.finals += 1;
    }
  }
  return [...byManager.values()].map((row) => ({
    ...row, pf: round2(row.pf), pa: round2(row.pa),
    winPct: row.wins + row.losses + row.ties ? round2((row.wins + row.ties / 2) /
      (row.wins + row.losses + row.ties) * 100) : null,
  })).sort((a, b) => b.titles - a.titles || b.winPct - a.winPct || b.pf - a.pf);
}

export function leagueTrends(archive = {}) {
  return (archive.seasons || []).slice().sort(seasonOrder).map((entry) => {
    const season = id(entry.season);
    const trades = (archive.transactions?.[season] || []).filter((row) => row.type === "trade").length;
    const waivers = (archive.transactions?.[season] || []).filter((row) =>
      row.type === "waiver" || row.type === "free_agent").length;
    const games = seasonGames(entry, archive);
    const scores = games.flatMap((game) => game.teams.map((team) => team.points));
    return { season, trades, waivers, games: games.length,
      averageScore: scores.length ? round2(scores.reduce((total, score) => total + score, 0) / scores.length) : null };
  });
}
