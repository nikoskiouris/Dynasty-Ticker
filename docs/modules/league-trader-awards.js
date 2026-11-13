import { resolveRosterIdentity } from "./franchise.js";
import { gradeTrade } from "./trade-grade.js";

const id = (value) => String(value ?? "").trim();
const rounded = (value) => Math.round((Number(value) || 0) * 100) / 100;

function manager(archive, entry, rosterId) {
  const roster = (entry?.rosters || []).find((row) => id(row.roster_id) === id(rosterId));
  return resolveRosterIdentity(archive?.franchiseIndex, {
    userId: roster?.owner_id, leagueId: entry?.leagueId, rosterId,
  });
}

// Today's player values, not a hindsight win probability. Trades without all
// their required asset prices are explicitly excluded, never valued as zero.
export function traderAwards(archive = {}, { values = {}, valueNames = {}, minTrades = 3 } = {}) {
  const totals = new Map();
  const trades = [];
  let ungradedTrades = 0;
  for (const entry of archive.seasons || []) {
    for (const transaction of archive.transactions?.[id(entry.season)] || []) {
      if (transaction?.type !== "trade" || transaction?.status !== "complete") continue;
      const result = gradeTrade(transaction, { values, valueNames, archive, basis: "today" });
      if (!result.available) {
        ungradedTrades += 1;
        continue;
      }
      const gradedSides = result.sides.map((side) => ({
        ...side, identity: manager(archive, entry, side.rosterId),
      }));
      for (const side of gradedSides) {
        const { managerKey, managerName } = side.identity;
        if (!totals.has(managerKey)) {
          totals.set(managerKey, { managerKey, name: managerName, tradeCount: 0, totalNet: 0,
            wins: 0, losses: 0, ties: 0, bestTrade: null, worstTrade: null });
        }
        const row = totals.get(managerKey);
        row.name = managerName;
        row.tradeCount += 1;
        row.totalNet += side.net;
        if (side.net > 0) row.wins += 1;
        else if (side.net < 0) row.losses += 1;
        else row.ties += 1;
        const reference = {
          transactionId: id(transaction.transaction_id), season: id(entry.season),
          leagueId: id(entry.leagueId), net: rounded(side.net),
          rosterId: side.rosterId, grade: side.grade,
          counterparties: gradedSides.filter((peer) => peer.rosterId !== side.rosterId)
            .map((peer) => peer.identity.managerName),
        };
        if (!row.bestTrade || side.net > row.bestTrade.net) row.bestTrade = reference;
        if (!row.worstTrade || side.net < row.worstTrade.net) row.worstTrade = reference;
      }
      trades.push({
        transactionId: id(transaction.transaction_id),
        season: id(entry.season), leagueId: id(entry.leagueId),
        sides: gradedSides.map(({ rosterId, identity, net, grade, received, sent }) => ({
          rosterId, managerKey: identity.managerKey, managerName: identity.managerName,
          net: rounded(net), grade, received, sent,
        })),
      });
    }
  }
  const standings = [...totals.values()].map((row) => ({
    ...row, totalNet: rounded(row.totalNet),
    winRate: row.tradeCount ? rounded(row.wins / row.tradeCount * 100) : 0,
    eligible: row.tradeCount >= minTrades,
  })).sort((a, b) => b.totalNet - a.totalNet || b.winRate - a.winRate);
  const eligible = standings.filter((row) => row.eligible);
  const best = eligible[0] || null;
  const worst = eligible.length > 1 ? eligible[eligible.length - 1] : null;
  const allSides = trades.flatMap((trade) =>
    trade.sides.map((side) => ({ ...side, season: trade.season, transactionId: trade.transactionId })));
  const bestSingle = allSides.slice().sort((a, b) => b.net - a.net)[0] || null;
  const worstSingle = allSides.slice().sort((a, b) => a.net - b.net)[0] || null;
  return { best, worst, bestSingle, worstSingle,
    standings, tradesGraded: trades.length, tradesSkipped: ungradedTrades,
    minTrades, basis: "Today's 12-team Superflex PPR values" };
}
