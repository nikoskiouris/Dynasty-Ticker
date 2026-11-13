import { resolveRosterIdentity } from "./franchise.js";

const id = (value) => String(value ?? "").trim();
const round2 = (number) => Math.round(number * 100) / 100;
const isPrice = (number) => typeof number === "number" && Number.isFinite(number) && number >= 0;
const priceMap = (values) => values?.sf || values || {};

function manager(archive, entry, rosterId) {
  const roster = (entry.rosters || []).find((item) => id(item.roster_id) === id(rosterId));
  return resolveRosterIdentity(archive.franchiseIndex, {
    userId: roster?.owner_id, leagueId: entry.leagueId, rosterId,
  });
}

export function waiverAwards(archive = {}, {
  values = {}, minMoves = 5,
} = {}) {
  const prices = priceMap(values);
  const totals = new Map();
  const pickups = [];
  const drops = [];
  let evaluatedMoves = 0;
  let excludedMoves = 0;
  for (const entry of archive.seasons || []) {
    for (const transaction of archive.transactions?.[id(entry.season)] || []) {
      if (!["waiver", "free_agent"].includes(transaction?.type)
        || transaction?.status !== "complete") continue;
      const rosterAssets = new Map();
      const record = (rosterId, playerId, field) => {
        const who = id(rosterId);
        if (!who || !id(playerId)) return;
        if (!rosterAssets.has(who)) rosterAssets.set(who, { adds: [], drops: [] });
        rosterAssets.get(who)[field].push(id(playerId));
      };
      for (const [playerId, rosterId] of Object.entries(transaction.adds || {})) {
        record(rosterId, playerId, "adds");
      }
      for (const [playerId, rosterId] of Object.entries(transaction.drops || {})) {
        record(rosterId, playerId, "drops");
      }
      for (const [rosterId, assets] of rosterAssets) {
        const involved = [...assets.adds, ...assets.drops];
        if (!involved.length || involved.some((playerId) =>
          !isPrice(prices[`player:${playerId}`]))) {
          excludedMoves++;
          continue;
        }
        const entryUser = manager(archive, entry, rosterId);
        if (!totals.has(entryUser.managerKey)) totals.set(entryUser.managerKey, {
          key: entryUser.managerKey, name: entryUser.managerName, moves: 0,
          net: 0, addedValue: 0, releasedValue: 0,
        });
        const row = totals.get(entryUser.managerKey);
        row.name = entryUser.managerName;
        row.moves++;
        evaluatedMoves++;
        const addedValue = assets.adds.reduce((total, playerId) =>
          total + prices[`player:${playerId}`], 0);
        const releasedValue = assets.drops.reduce((total, playerId) =>
          total + prices[`player:${playerId}`], 0);
        row.net += addedValue - releasedValue;
        row.addedValue += addedValue;
        row.releasedValue += releasedValue;
        for (const playerId of assets.adds) {
          pickups.push({ season: id(entry.season), managerName: entryUser.managerName,
            playerId, value: prices[`player:${playerId}`] });
        }
        for (const playerId of assets.drops) {
          drops.push({ season: id(entry.season), managerName: entryUser.managerName,
            playerId, value: prices[`player:${playerId}`] });
        }
      }
    }
  }
  const standings = [...totals.values()].map((row) => ({
    ...row, eligible: row.moves >= minMoves, net: round2(row.net),
    averageNet: row.moves ? round2(row.net / row.moves) : null,
    addedValue: round2(row.addedValue), releasedValue: round2(row.releasedValue),
  })).sort((a, b) => b.averageNet - a.averageNet || b.moves - a.moves);
  const eligible = standings.filter((row) => row.eligible);
  const highest = (rows) => rows.slice().sort((a, b) => b.value - a.value)[0] || null;
  return {
    best: eligible[0] || null,
    worst: eligible.length > 1 ? eligible[eligible.length - 1] : null,
    standings, bestPickup: highest(pickups), mostValuableDrop: highest(drops),
    evaluatedMoves, excludedMoves, minMoves,
    method: "Average net current player value (added minus released) per completed waiver or free-agent transaction; minimum 5 fully priced moves. FAAB is excluded. This is a hindsight proxy, not a prediction or a judgment at the time.",
  };
}
