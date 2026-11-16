import { resolveRosterIdentity } from "./franchise.js";
import { buildSeasonModel } from "./standings.js";

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

// One Standings model per season with matchups: the same luck (real wins
// minus all-play expected wins) and records the Standings page shows.
const modelCache = new WeakMap();
export function seasonModels(archive = {}) {
  if (modelCache.has(archive)) return modelCache.get(archive);
  const models = new Map();
  for (const entry of archive.seasons || []) {
    const byWeek = archive.matchups?.[id(entry.season)];
    if (!byWeek || !Object.keys(byWeek).length) continue;
    const weekRows = new Map(Object.entries(byWeek).map(([week, rows]) => [Number(week), rows || []]));
    const model = buildSeasonModel({ league: entry.league, rosters: entry.rosters || [], users: entry.users || [], weekRows });
    if (model.hasComputedGames) models.set(id(entry.season), model);
  }
  modelCache.set(archive, models);
  return models;
}

function longestRun(results, outcome) {
  let best = null, run = null;
  for (const row of results.slice().sort((a, b) => a.week - b.week)) {
    if (row.result === outcome) {
      run = run ? { ...run, length: run.length + 1, to: row.week } : { length: 1, from: row.week, to: row.week };
      if (!best || run.length > best.length) best = run;
    } else run = null;
  }
  return best;
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

// A playoff game is a winners-bracket matchup. Consolation and toilet-bowl
// games are played in the same weeks but are not playoff meetings.
function bracketPairs(entry) {
  const start = number(entry.league?.settings?.playoff_week_start || 15);
  const twoWeekFinal = number(entry.league?.settings?.playoff_round_type) === 1;
  const pairs = new Set();
  for (const game of entry.winnersBracket || []) {
    if (game?.t1 == null || game?.t2 == null) continue;
    const key = [id(game.t1), id(game.t2)].sort().join("-");
    const week = start + number(game.r) - 1;
    pairs.add(`${week}:${key}`);
    if (twoWeekFinal) pairs.add(`${week + 1}:${key}`);
  }
  return pairs;
}

export function seasonGames(entry, archive) {
  const byWeek = archive?.matchups?.[id(entry.season)] || {};
  const games = [];
  const playoffPairs = bracketPairs(entry);
  const playoffStart = number(entry.league?.settings?.playoff_week_start || 15);
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
        playoff: number(week) >= playoffStart && (playoffPairs.size
          ? playoffPairs.has(`${number(week)}:${[id(a.roster_id), id(b.roster_id)].sort().join("-")}`)
          : true),
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
  // Streaks run inside one regular season, from the same results as Standings.
  for (const entry of archive.seasons || []) {
    const model = seasonModels(archive).get(id(entry.season));
    if (!model) continue;
    for (const team of model.teams.values()) {
      for (const [key, outcome] of [["winStreak", "W"], ["loseStreak", "L"]]) {
        const run = longestRun(team.results || [], outcome);
        if (run) set(key, { season: id(entry.season), leagueId: id(entry.leagueId),
          team: rosterName(entry, team.rosterId), value: run.length, weeks: `Weeks ${run.from}–${run.to}` }, true);
      }
    }
  }
  // A team has a season record even when matchup-by-week data is unavailable.
  // Best/worst records count finished regular seasons only: 9-0 in week 10 is not a season.
  for (const entry of archive.seasons || []) {
    for (const roster of entry.rosters || []) {
      const record = rosterRecord(roster);
      set("highSeasonPF", { season: id(entry.season), leagueId: id(entry.leagueId),
        team: rosterName(entry, roster.roster_id), value: round2(record.pf) }, true);
      if (!isCompleted(entry)) continue;
      const seasonRecord = { season: id(entry.season), leagueId: id(entry.leagueId),
        team: rosterName(entry, roster.roster_id),
        value: record.wins + record.losses + record.ties
          ? round2((record.wins + record.ties / 2) / (record.wins + record.losses + record.ties) * 100) : NaN,
        record: `${record.wins}-${record.losses}-${record.ties}` };
      set("bestSeasonRecord", seasonRecord, true);
      set("worstSeasonRecord", seasonRecord, false);
    }
  }
  return { records, gamesRead: allGames.length, seasonsRead: (archive.seasons || []).length };
}

export function allTimeStandings(archive = {}) {
  const byManager = new Map();
  const index = archive.franchiseIndex;
  for (const entry of archive.seasons || []) {
    const final = finish(entry);
    // Sleeper publishes an in-season bracket from current seeds; only a finished season's bracket is a playoff trip.
    const playoffTeams = new Set((isCompleted(entry) ? entry.winnersBracket || [] : []).flatMap((game) => [id(game.t1), id(game.t2), id(game.w), id(game.l)]).filter(Boolean));
    for (const roster of entry.rosters || []) {
      const rosterId = id(roster.roster_id);
      const identity = resolveRosterIdentity(index, { userId: roster.owner_id,
        leagueId: entry.leagueId, rosterId });
      const key = identity.managerKey;
      if (!byManager.has(key)) byManager.set(key, {
        key, name: identity.managerName, seasons: 0, wins: 0, losses: 0, ties: 0,
        pf: 0, pa: 0, playoffAppearances: 0, titles: 0, finals: 0,
        luck: 0, luckSeasons: 0, finishTotal: 0, finishSeasons: 0,
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
      const team = seasonModels(archive).get(id(entry.season))?.teams.get(rosterId);
      if (team) { total.luck += team.luck; total.luckSeasons += 1; }
      if (team && isCompleted(entry)) { total.finishTotal += team.rank; total.finishSeasons += 1; }
    }
  }
  return [...byManager.values()].map((row) => ({
    ...row, pf: round2(row.pf), pa: round2(row.pa),
    luck: row.luckSeasons ? round2(row.luck) : null,
    avgFinish: row.finishSeasons ? Math.round(row.finishTotal / row.finishSeasons * 10) / 10 : null,
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
    // Draft picks that changed hands in this season's completed trades.
    const picksTraded = (archive.transactions?.[season] || []).filter((row) => row.type === "trade")
      .reduce((total, row) => total + (Array.isArray(row.draft_picks) ? row.draft_picks.length : 0), 0);
    // Parity: 100 − (season points spread ÷ top season points × 100). Higher = closer league.
    const pf = (entry.rosters || []).map((roster) => rosterRecord(roster).pf).filter((value) => value > 0);
    const top = pf.length ? Math.max(...pf) : 0;
    const spread = pf.length ? top - Math.min(...pf) : null;
    return { season, trades, waivers, picksTraded, games: games.length,
      transactionsLoaded: Array.isArray(archive.transactions?.[season]),
      pointsSpread: spread == null ? null : round2(spread),
      parity: top > 0 ? Math.round(100 - spread / top * 100) : null,
      averageScore: scores.length ? round2(scores.reduce((total, score) => total + score, 0) / scores.length) : null };
  });
}
