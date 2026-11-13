import { gradeTrade } from "./trade-grade.js";
import { resolveRosterIdentity } from "./franchise.js";

const id = (value) => String(value ?? "").trim();
const n = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const round = (value) => Math.round(value * 100) / 100;
const priced = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;
const currentMap = (values) => values?.sf || values || {};

function identityFor(archive, entry, rosterId, suppliedUserId = "") {
  const roster = (entry?.rosters || []).find((row) => id(row.roster_id) === id(rosterId));
  return resolveRosterIdentity(archive?.franchiseIndex, {
    userId: roster?.owner_id || suppliedUserId,
    leagueId: entry?.leagueId,
    rosterId,
  });
}

export function traderAwards(archive, values) {
  const managers = new Map();
  const evaluated = [];
  let skipped = 0;
  for (const entry of archive?.seasons || []) {
    for (const trade of archive?.transactions?.[id(entry.season)] || []) {
      if (trade?.type !== "trade" || trade?.status !== "complete") continue;
      const grade = gradeTrade(trade, { values, archive });
      if (!grade.available) { skipped++; continue; }
      for (const side of grade.sides) {
        const person = identityFor(archive, entry, side.rosterId);
        let row = managers.get(person.managerKey);
        if (!row) {
          row = { key: person.managerKey, name: person.managerName,
            trades: 0, wins: 0, net: 0 };
          managers.set(person.managerKey, row);
        }
        row.trades += 1;
        row.wins += Number(side.net > 0);
        row.net += side.net;
        evaluated.push({
          transactionId: id(trade.transaction_id), season: id(entry.season),
          managerKey: person.managerKey, managerName: person.managerName,
          rosterId: id(side.rosterId), net: side.net,
          grade: side.grade, tier: grade.tier,
        });
      }
    }
  }
  const eligible = [...managers.values()].filter((row) => row.trades >= 3)
    .map((row) => ({ ...row, net: round(row.net), winRate: round(row.wins / row.trades * 100) }))
    .sort((a, b) => b.net - a.net || b.winRate - a.winRate);
  const byTrade = evaluated.slice().sort((a, b) => b.net - a.net);
  return {
    best: eligible[0] || null,
    worst: eligible.length > 1 ? eligible[eligible.length - 1] : null,
    leaders: eligible, skipped, evaluatedTrades: evaluated.length,
    bestTrade: byTrade.find((row) => row.net > 0) || null,
    worstTrade: byTrade.slice().reverse().find((row) => row.net < 0) || null,
    method: "Today's 12-team SF PPR prices, including two-side package credits; minimum 3 gradable trades.",
  };
}

function draftCategory(draft) {
  const rounds = Number(draft?.settings?.rounds);
  // Startup and rookie pick slots aren't the same competitive market.
  return Number.isFinite(rounds) && rounds <= 6 ? "rookie" : "startup";
}

export function drafterAwards(archive, values) {
  const priceMap = currentMap(values);
  const currentSeason = Math.max(0, ...(archive?.seasons || []).map((row) => n(row.season)));
  const picks = [];
  let tooEarly = 0;
  let missingPrices = 0;
  for (const entry of archive?.seasons || []) {
    for (const draft of archive?.drafts?.[id(entry.season)] || []) {
      if (draft?.status !== "complete") continue;
      const season = n(draft.season || entry.season);
      if (season >= currentSeason) { tooEarly += (draft.picks || []).length; continue; }
      for (const pick of draft.picks || []) {
        const value = priceMap[`player:${id(pick.player_id)}`];
        const slot = n(pick.pick_no);
        if (!priced(value) || slot <= 0) { missingPrices++; continue; }
        const rosterId = id(pick.roster_id);
        const person = identityFor(archive, entry, rosterId, id(pick.picked_by));
        if (!person.managerKey || person.managerKey.includes("unknown")) continue;
        picks.push({
          playerId: id(pick.player_id), managerKey: person.managerKey,
          managerName: person.managerName, category: draftCategory(draft),
          slot, value, season,
        });
      }
    }
  }
  const byManager = new Map();
  let comparablePicks = 0;
  for (const pick of picks) {
    const neighbors = picks.filter((other) =>
      other !== pick && other.category === pick.category
      && Math.abs(other.slot - pick.slot) <= 3
    );
    if (neighbors.length < 3) continue;
    const expected = neighbors.reduce((total, item) => total + item.value, 0) / neighbors.length;
    const surplus = round(pick.value - expected);
    comparablePicks++;
    let manager = byManager.get(pick.managerKey);
    if (!manager) {
      manager = { key: pick.managerKey, name: pick.managerName, picks: 0, totalSurplus: 0, hits: [], busts: [] };
      byManager.set(pick.managerKey, manager);
    }
    manager.picks++;
    manager.totalSurplus += surplus;
    const detail = { season: pick.season, playerId: pick.playerId,
      slot: pick.slot, actual: pick.value, expected: round(expected), surplus };
    manager.hits.push(detail);
    manager.busts.push(detail);
  }
  const eligible = [...byManager.values()].filter((row) => row.picks >= 3)
    .map((row) => ({
      ...row,
      averageSurplus: round(row.totalSurplus / row.picks),
      hits: row.hits.sort((a, b) => b.surplus - a.surplus).slice(0, 3),
      busts: row.busts.sort((a, b) => a.surplus - b.surplus).slice(0, 3),
    }))
    .sort((a, b) => b.averageSurplus - a.averageSurplus);
  return {
    best: eligible[0] || null,
    worst: eligible.length > 1 ? eligible[eligible.length - 1] : null,
    leaders: eligible, comparablePicks, tooEarly, missingPrices,
    method: "Average present-day player value above/below nearby draft slots (±3) in the same draft type, minimum 3 comparable peers and 3 graded picks per manager. Current-season picks excluded.",
  };
}
