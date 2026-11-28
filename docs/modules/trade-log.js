import { renderPlayerLabel } from "./player-face.js";
import { roundPrice } from "./price-units.js";
import { escapeHtml, formatNumber, ownerPossessive } from "./html.js";
import { gradeTrade, tradeAssets } from "./trade-grade.js";
import { parseAssetList, tradeHref } from "./history-route.js";
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

// Same text as assetLabel, with each player as a link to his player page.
const playerButton = (playerId, context) => `<button type="button" class="link-btn player-link" data-action="open-player" data-asset-id="player:${escapeHtml(playerId)}">${renderPlayerLabel(playerLabel(playerId, context), playerId)}</button>`;
const assetHtml = (asset, context) => asset.kind === "player"
  ? playerButton(asset.playerId, context)
  : asset.draftedPlayerId
    ? `${escapeHtml(pickLabel(asset, context))} → ${playerButton(asset.draftedPlayerId, context)} (drafted)`
    : escapeHtml(pickLabel(asset, context));

// The calculator's column total says "incl. +31.89 extra" when the fewer,
// better pieces extra is counted; the grade uses the same total, so say so here
// too. Otherwise "Received 253.83" does not add up from the pieces listed.
function receivedExtra(side) {
  const extra = roundPrice(Number(side?.valueReceived) - Number(side?.listedReceived));
  return Number.isFinite(extra) && extra > 0 ? ` (incl. +${formatNumber(extra)} extra)` : "";
}

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

const ORDINAL_WORDS = { first: "1st", second: "2nd", third: "3rd", fourth: "4th", fifth: "5th" };
function foldSearch(value) {
  return text(value).toLowerCase()
    .replace(/\b(first|second|third|fourth|fifth)s?\b/g, (word, base) => ORDINAL_WORDS[base])
    .replace(/[^a-z0-9]/g, "");
}

export function renderTradeLogRows({
  trades = [], entry = null, archive = null, values = {}, valueNames = {}, players = {}, query = "", team = "",
} = {}) {
  const context = { valueNames, players, entry };
  const searchable = text(query).toLowerCase();
  const want = foldSearch(searchable);
  const rows = completedLeagueTrades(trades).filter((trade) => {
    const snapshot = tradeAssets(trade);
    if (team && !snapshot.rosterIds.includes(team)) return false;
    if (!searchable) return true;
    // "dj moore" finds D.J. Moore, "2027 second" finds a 2027 2nd.
    return snapshot.assets.some((asset) => (want && foldSearch(assetLabel(asset, context)).includes(want))
      || asset.assetId.toLowerCase().includes(searchable));
  });
  // A finished season can't have trades "yet": say which season had none.
  const finished = entry?.league?.status === "complete" && entry?.season;
  const none = finished ? `No trades were made in the ${text(entry.season)} season.` : "No completed trades yet this season.";
  if (!rows.length) return `<p class="muted" role="status">${searchable || team ? "No trades match these filters." : escapeHtml(none)}</p>`;

  return rows.map((trade) => {
    const graded = gradeTrade(trade, { values, valueNames, archive });
    const sides = graded.sides;
    const date = new Date(Number(trade.status_updated || trade.created || 0));
    const dateLabel = Number.isFinite(date.getTime())
      ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
      : "Date unavailable";
    const calcHref = (() => {
      if (sides.length !== 2 || sides.some((side) => !side.received.length)
        || (trade.waiver_budget || []).some((transfer) => Number(transfer.amount) > 0)) return "";
      const complete = tradeAssets(trade).assets.every((asset) =>
        asset.sender && asset.receiver && asset.sender !== asset.receiver);
      if (!complete) return "";
      // An identifiable unpriced player can still open as unavailable. Use the
      // drafted player for a spent pick and preserve every piece in the URL.
      const [get, give] = sides.map((side) => side.received.map((asset) => asset.pricedAs));
      const players = [...give, ...get].filter((assetId) => assetId?.startsWith("player:"));
      if (new Set(players).size !== players.length) return "";
      const representable = [give, get].every((ids) => parseAssetList(ids.join(",")).length === ids.length);
      return representable ? tradeHref(give, get) : "";
    })();
    const parties = sides.map((side) => {
      const received = side.received.map((asset) => assetHtml(asset, context));
      if (side.faabReceived) received.push(`$${formatNumber(side.faabReceived)} FAAB`);
      const isWinner = graded.available && graded.winnerRosterId === side.rosterId;
      return `<div class="trade-log-side">
        <h3>${escapeHtml(rosterLabel(side.rosterId, entry))}${isWinner ? ' <span class="mini-chip">Higher value</span>' : ""}</h3>
        <p>${received.length ? received.map((item) => `<span class="received-asset">${item}</span>`).join("") : "No assets received"}</p>
        <p class="muted small">Received ${graded.available ? `${priceLabel(side.valueReceived)}${receivedExtra(side)}` : "value unavailable"}
          · Sent ${graded.available ? priceLabel(side.valueSent) : "value unavailable"}
          · Trade grade: <strong>${graded.available ? escapeHtml(side.grade) : "Not graded"}</strong></p>
      </div>`;
    }).join("");
    return `<article class="workspace-panel trade-log-card">
      <div class="panel-heading"><div><span class="eyebrow">${escapeHtml(dateLabel)}</span>
        <h2>${escapeHtml(sides.map((side) => rosterLabel(side.rosterId, entry)).join(" / ") || "Trade")}</h2></div>
        <span class="mini-chip">${graded.available ? escapeHtml(TIER_LABELS[graded.tier] || (graded.tier === "multi-team" ? "Multi-team" : graded.tier)) : "Not graded"}</span></div>
      <div class="trade-log-parties">${parties}</div>
      ${calcHref ? `<p><a href="${escapeHtml(calcHref)}" target="_blank" rel="noopener noreferrer">Open in Trade Calculator (new tab)</a> <span class="muted small">Keeps your current draft intact.</span></p>` : ""}
      <details><summary>How was this graded?</summary><p class="muted small">Graded on today's values, not what they were when the trade happened.</p>
        ${graded.notes.map((note) => `<p class="muted small">${escapeHtml(note)}</p>`).join("")}
        ${graded.reason ? `<p class="muted small">${escapeHtml(graded.reason)}</p>` : ""}
      </details>
    </article>`;
  }).join("");
}

export function renderTradeLog({ season = "", seasons = [], query = "", team = "", caveat = "", ...context } = {}) {
  const choices = seasons.map((item) => `<option value="${escapeHtml(item)}"${text(season) === text(item) ? " selected" : ""}>${escapeHtml(item)}</option>`).join("");
  const teams = (context.entry?.rosters || []).map((roster) => ({
    id: text(roster.roster_id), label: rosterLabel(roster.roster_id, context.entry),
  })).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" }));
  const teamOptions = teams.map((row) => `<option value="${escapeHtml(row.id)}"${row.id === team ? " selected" : ""}>${escapeHtml(row.label)}</option>`).join("");
  return `<p><a class="league-back" href="/l/${encodeURIComponent(context.archive?.leagueId || context.entry?.leagueId || "")}">← League</a></p>
    ${caveat ? `<p class="muted small calc-market-caveat">${escapeHtml(caveat)} Grades use those values.</p>` : ""}
    <div class="trade-log-filters">
      <label for="league-trade-search">Player or pick
      <input id="league-trade-search" type="search" placeholder="Search names or picks" autocomplete="off" value="${escapeHtml(query)}"></label>
      <label for="league-trade-season">Season
      <select id="league-trade-season">${choices}</select></label>
      <label for="league-trade-team">Team
      <select id="league-trade-team"><option value="">All teams</option>${teamOptions}</select></label>
    </div>
    <div id="league-trade-results" aria-live="polite">${renderTradeLogRows({ ...context, query, team })}</div>`;
}
