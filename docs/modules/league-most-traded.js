import { countLabel, escapeHtml } from "./html.js";
import { playerPathname } from "./history-route.js";

const id = (value) => String(value ?? "").trim();
const e = (value) => escapeHtml(String(value ?? ""));
const fullName = (raw) => String(raw?.full_name || [raw?.first_name, raw?.last_name].filter(Boolean).join(" ")).trim();

// A player counts once per completed trade he moved in, however many sides
// listed him. Draft picks and FAAB are not players and are not counted.
export function mostTradedPlayers(archive = {}, { valueNames = {}, players = {}, limit = 5 } = {}) {
  const counts = new Map();
  const seen = new Set();
  let tradesRead = 0;
  let seasonsRead = 0;
  for (const entry of archive.seasons || []) {
    const moves = archive.transactions?.[id(entry.season)];
    if (!Array.isArray(moves)) continue;
    seasonsRead += 1;
    for (const transaction of moves) {
      if (transaction?.type !== "trade" || transaction?.status !== "complete") continue;
      const tradeId = id(transaction.transaction_id) || `${id(entry.leagueId)}:${tradesRead}`;
      if (seen.has(tradeId)) continue;
      seen.add(tradeId);
      tradesRead += 1;
      const moved = new Set([...Object.keys(transaction.adds || {}), ...Object.keys(transaction.drops || {})]
        .map(id).filter((playerId) => /^\d+$/.test(playerId)));
      for (const playerId of moved) counts.set(playerId, (counts.get(playerId) || 0) + 1);
    }
  }
  const rows = [...counts].map(([playerId, trades]) => ({
    playerId, trades,
    name: id(valueNames[`player:${playerId}`]) || fullName(players[playerId]) || `Player ${playerId}`,
  })).sort((a, b) => b.trades - a.trades || a.name.localeCompare(b.name) || a.playerId.localeCompare(b.playerId));
  return { rows: rows.slice(0, limit), tradesRead, seasonsRead };
}

export function renderMostTraded(archive, options = {}) {
  const { rows, tradesRead, seasonsRead } = mostTradedPlayers(archive, options);
  const heading = "<h2>Most traded players</h2>";
  if (!seasonsRead) return `<section class="workspace-panel">${heading}
    <p class="muted">Trades are not available from Sleeper for these seasons.</p></section>`;
  if (!rows.length) return `<section class="workspace-panel">${heading}
    <p class="muted">No completed trades with players in ${countLabel(seasonsRead, "loaded season")}.</p></section>`;
  const items = rows.map((row, index) => {
    const href = playerPathname(row.playerId, row.name);
    const name = href ? `<a href="${e(href)}">${e(row.name)}</a>` : e(row.name);
    return `<li><span class="league-most-traded-rank">${index + 1}</span>
      <span class="league-most-traded-name">${name}</span>
      <span class="league-most-traded-count muted">${countLabel(row.trades, "trade")}</span></li>`;
  }).join("");
  return `<section class="workspace-panel">${heading}
    <p class="muted small">Times each player moved in a completed trade, from ${countLabel(tradesRead, "trade")} across ${countLabel(seasonsRead, "loaded season")}. Ties sort by name.</p>
    <ol class="league-most-traded">${items}</ol></section>`;
}
