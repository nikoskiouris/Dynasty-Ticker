import { countLabel, escapeHtml, formatNumber } from "./html.js";
import { playerPathname } from "./history-route.js";

const id = (value) => String(value ?? "").trim();
const e = (value) => escapeHtml(String(value ?? ""));
const fullName = (raw) => String(raw?.full_name || [raw?.first_name, raw?.last_name].filter(Boolean).join(" ")).trim();

// A player counts once per completed trade he moved in, however many sides
// listed him. Draft picks and FAAB are not players and are not counted.
export function mostTradedPlayers(archive = {}, { values = {}, valueNames = {}, players = {}, limit = 5 } = {}) {
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
  const prices = values?.sf || values || {};
  const all = [...counts].map(([playerId, trades]) => {
    const value = Number(prices[`player:${playerId}`]);
    return {
      playerId, trades, value: Number.isFinite(value) && value > 0 ? value : null,
      name: id(valueNames[`player:${playerId}`]) || fullName(players[playerId]) || `Player ${playerId}`,
    };
  });
  const byName = (a, b) => a.name.localeCompare(b.name) || a.playerId.localeCompare(b.playerId);
  const rows = all.slice().sort((a, b) => b.trades - a.trades || byName(a, b)).slice(0, limit);
  // Today's price only ranks the list; a player without one is left out.
  const major = all.filter((row) => row.value != null)
    .sort((a, b) => b.value - a.value || b.trades - a.trades || byName(a, b)).slice(0, limit);
  return { rows, major, tradesRead, seasonsRead };
}

function playerItem(row, index, detail) {
  const href = playerPathname(row.playerId, row.name);
  const name = href ? `<a href="${e(href)}">${e(row.name)}</a>` : e(row.name);
  return `<li><span class="league-most-traded-rank">${index + 1}</span>
    <span class="league-most-traded-name">${name}</span>
    <span class="league-most-traded-count muted">${detail}</span></li>`;
}

export function renderMostTraded(archive, options = {}) {
  const { rows, major, tradesRead, seasonsRead } = mostTradedPlayers(archive, options);
  const heading = "<h2>Most traded players</h2>";
  if (!seasonsRead) return `<section class="workspace-panel">${heading}
    <p class="muted">Trades are not available from Sleeper for these seasons.</p></section>`;
  if (!rows.length) return `<section class="workspace-panel">${heading}
    <p class="muted">No completed trades with players in ${countLabel(seasonsRead, "loaded season")}.</p></section>`;
  const mostItems = rows.map((row, index) => playerItem(row, index, countLabel(row.trades, "trade"))).join("");
  const majorItems = major.map((row, index) => playerItem(row, index,
    `${formatNumber(Math.round(row.value))} · ${countLabel(row.trades, "trade")}`)).join("");
  return `<section class="workspace-panel">${heading}
    <p class="muted small">From ${countLabel(tradesRead, "completed trade")} across ${countLabel(seasonsRead, "loaded season")}.</p>
    <div class="league-most-traded-lists">
      <div><h3>By times traded</h3>
        <ol class="league-most-traded">${mostItems}</ol></div>
      <div><h3>Major players traded</h3>
        ${majorItems ? `<ol class="league-most-traded">${majorItems}</ol>` : '<p class="muted">None of the traded players has a current value.</p>'}</div>
    </div></section>`;
}
