import { resolveRosterIdentity } from "./franchise.js";
import { allTimeStandings } from "./league-records.js";

const id = (value) => String(value ?? "").trim();
const count = (value) => Number(value) || 0;

function rosterIdentity(archive, entry, roster) {
  return resolveRosterIdentity(archive.franchiseIndex, {
    userId: roster?.owner_id, leagueId: entry.leagueId, rosterId: id(roster?.roster_id),
  });
}

function seasonFinish(entry, rosterId) {
  const ordered = (entry.rosters || []).slice().sort((a, b) => {
    const sa = a.settings || {}, sb = b.settings || {};
    return count(sb.wins) - count(sa.wins) || count(sa.losses) - count(sb.losses)
      || (count(sb.fpts) + count(sb.fpts_decimal) / 100) - (count(sa.fpts) + count(sa.fpts_decimal) / 100);
  });
  const place = ordered.findIndex((roster) => id(roster.roster_id) === id(rosterId));
  return place >= 0 ? place + 1 : null;
}

function seasonResult(entry, roster) {
  const settings = roster.settings || {};
  const wins = count(settings.wins), losses = count(settings.losses), ties = count(settings.ties);
  const games = wins + losses + ties;
  if (!games) return null;
  return { season: id(entry.season), wins, losses, ties, games,
    winPct: (wins + ties / 2) / games, finish: seasonFinish(entry, roster.roster_id) };
}

// Trophy cases are evidence-based summaries of the data available from each
// season. Roster appearances are not presented as tenure or transaction history.
export function managerTrophyCases(archive = {}) {
  const cases = new Map(allTimeStandings(archive).map((row) =>
    [row.key, { key: row.key, name: row.name, titles: row.titles, seasons: [], playerCounts: new Map(), partners: new Map() }]));
  for (const entry of archive.seasons || []) {
    const byRosterId = new Map((entry.rosters || []).map((roster) =>
      [id(roster.roster_id), rosterIdentity(archive, entry, roster).managerKey]));
    for (const roster of entry.rosters || []) {
      const key = byRosterId.get(id(roster.roster_id));
      const summary = cases.get(key);
      if (!summary) continue;
      const result = seasonResult(entry, roster);
      if (result) summary.seasons.push(result);
      for (const playerId of new Set((roster.players || []).map(id).filter(Boolean))) {
        summary.playerCounts.set(playerId, (summary.playerCounts.get(playerId) || 0) + 1);
      }
    }
    for (const trade of archive.transactions?.[id(entry.season)] || []) {
      if (trade?.type !== "trade" || trade?.status !== "complete") continue;
      const unique = [...new Set((trade.roster_ids || []).map((rosterId) => byRosterId.get(id(rosterId))).filter(Boolean))];
      for (const managerKey of unique) {
        const summary = cases.get(managerKey);
        if (!summary) continue;
        for (const partner of unique) {
          if (partner === managerKey) continue;
          summary.partners.set(partner, (summary.partners.get(partner) || 0) + 1);
        }
      }
    }
  }

  return [...cases.values()].map((summary) => {
    const ranked = summary.seasons.slice().sort((a, b) =>
      b.winPct - a.winPct || b.wins - a.wins || Number(b.season) - Number(a.season));
    const topPlayer = [...summary.playerCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    const topPartner = [...summary.partners].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    return {
      key: summary.key, name: summary.name, titles: summary.titles,
      bestSeason: ranked[0] || null, worstSeason: ranked[ranked.length - 1] || null,
      mostFrequentRosterPlayer: topPlayer ? { playerId: topPlayer[0], seasonAppearances: topPlayer[1] } : null,
      favoriteTradePartner: topPartner ? {
        managerKey: topPartner[0], managerName: cases.get(topPartner[0])?.name || "Another manager",
        trades: topPartner[1],
      } : null,
    };
  });
}
