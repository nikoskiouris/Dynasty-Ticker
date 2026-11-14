import { escapeHtml, formatNumber, ownerPossessive } from "./html.js";
import { gradeTrade, tradeAssets } from "./trade-grade.js";
import { tradeHref } from "./history-route.js";
import { TIER_LABELS } from "./verdict-copy.js";

const text = (value) => String(value ?? "").trim();
const fullName = (raw) => text(raw?.full_name || [raw?.first_name, raw?.last_name].filter(Boolean).join(" "));
const playerLabel = (playerId, { valueNames = {}, players = {} } = {}) =>
  text(valueNames[`player:${playerId}`] || fullName(players[playerId]) || `Player ${playerId}`);
// "2026 1st (Burger King's pick)": a pick is named by its original team, not a roster number.
const pickLabel = (asset, context) => {
  const base = asset.name || asset.assetId;
  if (!asset.originalRosterId || !context.entry) return base;
  return `${base} (${ownerPossessive(rosterLabel(asset.originalRosterId, context.entry))} pick)`;
};
const assetLabel = (asset, context) => asset.kind === "player"
  ? playerLabel(asset.playerId, context)
  : asset.draftedPlayerId
    ? `${pickLabel(asset, context)} → ${playerLabel(asset.draftedPlayerId, context)} (drafted)`
    : pickLabel(asset, context);

function rosterLabel(rosterId, entry) {
  const roster = (entry?.rosters || []).find((row) => text(row.roster_id) === text(rosterId));
  const user = (entry?.users || []).find((row) => text(row.user_id) === text(roster?.owner_id));
  return text(user?.metadata?.team_name || user?.display_name || user?.username || `Roster ${rosterId}`);
}

function priceLabel(value) {
  return Number.isFinite(value) ? formatNumber(value) : "Unavailable";
}

export function completedLeagueTrades(trades = []) {
  return (trades || [])
    .filter((trade) => trade?.type === "trade" && trade?.status === "complete")
    .slice()
    .sort((a, b) => Number(b.status_updated || b.created || 0) - Number(a.status_updated || a.created || 0));
}

export function renderTradeLogRows({
  trades = [], entry = null, archive = null, values = {}, valueNames = {}, players = {}, query = "", team = "",
} = {}) {
  const context = { valueNames, players, entry };
  const searchable = text(query).toLowerCase();
  const rows = completedLeagueTrades(trades).filter((trade) => {
    const snapshot = tradeAssets(trade);
    if (team && !snapshot.rosterIds.includes(team)) return false;
    if (!searchable) return true;
    return snapshot.assets.some((asset) => assetLabel(asset, context).toLowerCase().includes(searchable)
      || asset.assetId.toLowerCase().includes(searchable));
  });
  if (!rows.length) return `<p class="muted" role="status">${searchable || team ? "No trades match these filters." : "No completed trades yet this season."}</p>`;

  return rows.map((trade) => {
    const graded = gradeTrade(trade, { values, valueNames, archive });
    const snapshot = tradeAssets(trade);
    const sides = graded.sides.length ? graded.sides : snapshot.rosterIds.map((rosterId) => ({
      rosterId,
      received: snapshot.assets.filter((asset) => asset.receiver === rosterId),
      sent: snapshot.assets.filter((asset) => asset.sender === rosterId),
    }));
    const date = new Date(Number(trade.status_updated || trade.created || 0));
    const dateLabel = Number.isFinite(date.getTime())
      ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
      : "Date unavailable";
    const calcHref = (() => {
      if (sides.length !== 2 || !snapshot.assets.length) return "";
      const [first, second] = sides.map((side) => side.rosterId);
      if (snapshot.assets.some((asset) => ![first, second].includes(asset.receiver)
        || ![first, second].includes(asset.sender))) return "";
      const give = snapshot.assets.filter((asset) => asset.receiver === second).map((asset) => asset.assetId);
      const get = snapshot.assets.filter((asset) => asset.receiver === first).map((asset) => asset.assetId);
      return give.length && get.length ? tradeHref(give, get, archive?.leagueId || "") : "";
    })();
    const parties = sides.map((side) => {
      const received = side.received.map((asset) => assetLabel(asset, context));
      const isWinner = graded.available && graded.winnerRosterId === side.rosterId;
      return `<div class="trade-log-side">
        <h3>${escapeHtml(rosterLabel(side.rosterId, entry))}${isWinner ? ' <span class="mini-chip">Higher value</span>' : ""}</h3>
        <p>${escapeHtml(received.join(", ") || "No player or pick received")}</p>
        <p class="muted small">Received ${graded.available ? priceLabel(side.valueReceived) : "value unavailable"}
          · Sent ${graded.available ? priceLabel(side.valueSent) : "value unavailable"}
          · Trade grade: <strong>${graded.available ? escapeHtml(side.grade) : "Not graded"}</strong></p>
      </div>`;
    }).join("");
    return `<article class="workspace-panel trade-log-card">
      <div class="panel-heading"><div><span class="eyebrow">${escapeHtml(dateLabel)}</span>
        <h2>${escapeHtml(sides.map((side) => rosterLabel(side.rosterId, entry)).join(" / ") || "Trade")}</h2></div>
        <span class="mini-chip">${graded.available ? escapeHtml(TIER_LABELS[graded.tier] || (graded.tier === "multi-team" ? "Multi-team" : graded.tier)) : "Price unavailable"}</span></div>
      <div class="trade-log-parties">${parties}</div>
      ${calcHref ? `<p><a href="${escapeHtml(calcHref)}" target="_blank" rel="noopener noreferrer">Open in Trade Calc (new tab)</a> <span class="muted small">Keeps your current draft intact.</span></p>` : ""}
      <details><summary>How was this graded?</summary><p class="muted small">Today's 12-team Superflex PPR values, including any adjustment for fewer, better pieces. This measures value today, not whether the trade was a good decision at the time.</p>
        ${graded.notes.map((note) => `<p class="muted small">${escapeHtml(note)}</p>`).join("")}
        ${graded.reason ? `<p class="muted small">${escapeHtml(graded.reason)}</p>` : ""}
      </details>
    </article>`;
  }).join("");
}

export function renderTradeLog({ season = "", seasons = [], query = "", team = "", ...context } = {}) {
  const choices = seasons.map((item) => `<option value="${escapeHtml(item)}"${text(season) === text(item) ? " selected" : ""}>${escapeHtml(item)}</option>`).join("");
  const teams = (context.entry?.rosters || []).map((roster) => ({
    id: text(roster.roster_id), label: rosterLabel(roster.roster_id, context.entry),
  })).sort((a, b) => a.label.localeCompare(b.label));
  const teamOptions = teams.map((row) => `<option value="${escapeHtml(row.id)}"${row.id === team ? " selected" : ""}>${escapeHtml(row.label)}</option>`).join("");
  return `<p><a href="/l/${encodeURIComponent(context.archive?.leagueId || context.entry?.leagueId || "")}">← League</a></p>
    <div class="workspace-panel">
      <label for="league-trade-search">Search a player or pick</label>
      <input id="league-trade-search" type="search" placeholder="Search a player" autocomplete="off" value="${escapeHtml(query)}">
      <label for="league-trade-season">Season</label>
      <select id="league-trade-season">${choices}</select>
      <label for="league-trade-team">Team</label>
      <select id="league-trade-team"><option value="">All teams</option>${teamOptions}</select>
    </div>
    <div id="league-trade-results" aria-live="polite">${renderTradeLogRows({ ...context, query, team })}</div>`;
}
