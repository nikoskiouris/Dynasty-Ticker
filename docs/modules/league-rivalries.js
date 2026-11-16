import { resolveRosterIdentity } from "./franchise.js";
import { allTimeStandings, seasonGames } from "./league-records.js";

const id = (value) => String(value ?? "").trim();

function teamIdentity(archive, entry, rosterId) {
  const roster = (entry.rosters || []).find((item) => id(item.roster_id) === rosterId);
  return resolveRosterIdentity(archive.franchiseIndex, {
    userId: roster?.owner_id, leagueId: entry.leagueId, rosterId,
  });
}

// Every head-to-head meeting has two managers, one winning side (or a tie),
// a season, a week and a source league. Manager IDs survive team-name edits.
export function headToHeadHistory(archive = {}) {
  const managers = allTimeStandings(archive).map((row) => ({ key: row.key, name: row.name }));
  const byPair = new Map();
  for (const entry of archive.seasons || []) {
    for (const game of seasonGames(entry, archive)) {
      const sides = game.teams.map((team) => ({
        ...team, identity: teamIdentity(archive, entry, team.rosterId),
      }));
      const [left, right] = sides;
      if (left.identity.managerKey === right.identity.managerKey) continue;
      const ordered = sides.slice().sort((a, b) =>
        a.identity.managerKey.localeCompare(b.identity.managerKey));
      const [a, b] = ordered;
      const key = `${a.identity.managerKey}|${b.identity.managerKey}`;
      if (!byPair.has(key)) {
        byPair.set(key, {
          key, first: a.identity.managerKey, second: b.identity.managerKey,
          firstName: a.identity.managerName, secondName: b.identity.managerName,
          firstWins: 0, secondWins: 0, ties: 0, playoffGames: 0, games: [],
        });
      }
      const pair = byPair.get(key);
      pair.firstName = a.identity.managerName;
      pair.secondName = b.identity.managerName;
      if (a.points > b.points) pair.firstWins += 1;
      else if (b.points > a.points) pair.secondWins += 1;
      else pair.ties += 1;
      if (game.playoff) pair.playoffGames += 1;
      pair.games.push({
        season: game.season, leagueId: game.leagueId, week: game.week,
        playoff: game.playoff, firstPoints: a.points, secondPoints: b.points,
        winnerKey: a.points > b.points ? pair.first : b.points > a.points ? pair.second : null,
      });
    }
  }
  const pairs = [...byPair.values()].map((pair) => ({
    ...pair,
    meetings: pair.firstWins + pair.secondWins + pair.ties,
    games: pair.games.sort((a, b) => Number(b.season) - Number(a.season) || b.week - a.week),
  })).sort((a, b) => b.meetings - a.meetings || a.key.localeCompare(b.key));
  const pairByKey = new Map(pairs.map((pair) => [pair.key, pair]));
  return { managers, pairs, pairByKey };
}

export function rivalryHighlights(history) {
  const pairs = history?.pairs || [];
  const mostPlayed = pairs[0] || null;
  // A single win isn't a dynasty-long rivalry. Require 3 meetings before
  // claiming a pairing was historically one-sided.
  const lopsided = pairs.filter((pair) => pair.meetings >= 3).slice().sort((a, b) => {
    const dominance = (row) => Math.max(row.firstWins, row.secondWins) / row.meetings;
    return dominance(b) - dominance(a) || b.meetings - a.meetings;
  })[0] || null;
  const playoff = pairs.filter((pair) => pair.playoffGames > 0)
    .slice().sort((a, b) => b.playoffGames - a.playoffGames || b.meetings - a.meetings)[0] || null;
  return { mostPlayed, lopsided, playoff };
}
