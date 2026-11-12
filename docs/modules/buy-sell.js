// Ticket 004: buy-low and sell-high names from this league.
//
// A heuristic, and labeled as one: it compares a player's listed price (the
// one Dynasty Ticker price) with what he has scored in this league this
// season. Buy low: scoring like a better player than his price, on another
// roster. Sell high: priced like a better player than he scores, on yours.
// It never changes a price. It is a reason to look, not a forecast.

export const BUY_SELL_POSITIONS = Object.freeze(["QB", "RB", "WR", "TE"]);
export const BUY_SELL_MIN_GAMES = 4;
export const BUY_SELL_LIMIT = 5;

// Rank gap needed, and how deep a rank still counts as a real player.
const MIN_GAP = 6;
const GAP_SHARE = 0.4;
const DEPTH_PER_TEAM = { QB: 2, RB: 3, WR: 4, TE: 1.5 };

function ordinalRank(position, rank) {
  return `${position}${rank}`;
}

// Points per game from Sleeper matchup rows (week -> rows). A week counts
// when the player scored above zero, so byes, injuries and future weeks drop.
export function seasonScoring(weekRows) {
  const totals = new Map();
  const weeks = weekRows instanceof Map ? [...weekRows.values()] : Object.values(weekRows || {});
  for (const rows of weeks) {
    for (const row of Array.isArray(rows) ? rows : []) {
      const points = row?.players_points || {};
      for (const [playerId, raw] of Object.entries(points)) {
        const value = Number(raw);
        if (!Number.isFinite(value) || value <= 0) continue;
        const entry = totals.get(String(playerId)) || { points: 0, games: 0 };
        entry.points += value;
        entry.games += 1;
        totals.set(String(playerId), entry);
      }
    }
  }
  return totals;
}

function rankBy(rows, key) {
  const sorted = rows.slice().sort((a, b) => b[key] - a[key] || String(a.name).localeCompare(String(b.name)));
  const out = new Map();
  sorted.forEach((row, index) => out.set(row.assetId, index + 1));
  return out;
}

// teamState: "contending" | "middle" | "rebuilding" (My team's call).
export function buildBuySellLists({
  rosters = [],
  meRosterId = null,
  weekRows,
  valueOf,
  positionOf,
  ageOf,
  teamState = "middle",
  minGames = BUY_SELL_MIN_GAMES,
  limit = BUY_SELL_LIMIT,
} = {}) {
  const scoring = seasonScoring(weekRows);
  const teams = Math.max(1, rosters.length);
  const players = [];
  for (const roster of rosters) {
    for (const asset of roster?.assets || []) {
      if (asset?.assetType !== "player") continue;
      const position = String(positionOf?.(asset) || "").toUpperCase();
      if (!BUY_SELL_POSITIONS.includes(position)) continue;
      const playerId = String(asset.assetId || "").replace(/^player:/, "");
      const score = scoring.get(playerId);
      const value = Number(valueOf?.(asset)) || 0;
      if (!score || score.games < minGames || value <= 0) continue;
      const age = Number(ageOf?.(asset));
      players.push({
        assetId: asset.assetId,
        name: asset.name || "",
        position,
        value,
        ppg: score.points / score.games,
        games: score.games,
        age: Number.isFinite(age) && age > 0 ? age : null,
        rosterId: roster.rosterId,
        owner: roster.manager?.displayName || "",
      });
    }
  }
  const buy = [];
  const sell = [];
  for (const position of BUY_SELL_POSITIONS) {
    const group = players.filter((row) => row.position === position);
    if (group.length < 6) continue;
    const valueRank = rankBy(group, "value");
    const ppgRank = rankBy(group, "ppg");
    const depth = Math.round(teams * (DEPTH_PER_TEAM[position] || 3));
    for (const row of group) {
      const priced = valueRank.get(row.assetId);
      const scored = ppgRank.get(row.assetId);
      const mine = String(row.rosterId) === String(meRosterId ?? "");
      const entry = { ...row, priceRank: priced, pointsRank: scored };
      // Buy low: scores like a starter, priced well below that, on another team.
      if (!mine && scored <= depth && priced - scored >= Math.max(MIN_GAP, Math.round(priced * GAP_SHARE))) {
        entry.gap = priced - scored;
        entry.why = `Scoring like ${ordinalRank(position, scored)} (${row.ppg.toFixed(1)} a game over ${row.games}), priced as ${ordinalRank(position, priced)}.`;
        buy.push(entry);
      }
      // Sell high: priced like a starter, scoring well below that, on your team.
      if (mine && priced <= depth && scored - priced >= Math.max(MIN_GAP, Math.round(scored * GAP_SHARE))) {
        entry.gap = scored - priced;
        entry.why = `Priced as ${ordinalRank(position, priced)}, scoring like ${ordinalRank(position, scored)} (${row.ppg.toFixed(1)} a game over ${row.games}).`;
        sell.push(entry);
      }
    }
  }
  // The window decides who is worth chasing. A rebuild does not buy a
  // 28-year-old's hot streak; a contender does not sell young players for a slump.
  const buyFits = (row) => teamState !== "rebuilding" || row.age == null || row.age <= (row.position === "RB" ? 25 : 26);
  const sellFits = (row) => teamState !== "contending" || row.age == null || row.age >= 27;
  const byGap = (a, b) => b.gap - a.gap || b.value - a.value;
  return {
    buy: buy.filter(buyFits).sort(byGap).slice(0, limit),
    sell: sell.filter(sellFits).sort(byGap).slice(0, limit),
    scoredPlayers: players.length,
  };
}
