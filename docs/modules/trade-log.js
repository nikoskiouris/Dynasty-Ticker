import { renderPlayerLabel } from "./player-face.js";
import { roundPrice } from "./price-units.js";
import { escapeHtml, formatNumber, ownerPossessive } from "./html.js";
import { gradeTrade, tradeAssets } from "./trade-grade.js";
import { loadTradeDatePrices } from "./trade-date-price.js";
import { resolveRosterIdentity } from "./franchise.js";
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

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
});

function dateLabel(timestamp) {
  const date = new Date(Number(timestamp) || NaN);
  return Number.isFinite(date.getTime()) ? dateFormat.format(date) : "Date unavailable";
}

function managerFor(entry, rosterId, archive) {
  const roster = (entry.rosters || []).find((row) => text(row.roster_id) === text(rosterId));
  return resolveRosterIdentity(archive.franchiseIndex, {
    leagueId: entry.leagueId, rosterId, userId: roster?.owner_id,
  });
}

function selectedSeasons(archive, season) {
  return (archive?.seasons || []).filter((entry) => season === "all" || text(entry.season) === season);
}

// Search, sort and page changes reuse the same grade. A refreshed archive or
// price board can change a pick outcome or grade, even for an old transaction.
const gradeCache = new WeakMap();
function currentGrade(trade, context) {
  const { values, valueNames, archive } = context;
  const cached = gradeCache.get(trade);
  if (cached && cached.values === values && cached.valueNames === valueNames && cached.archive === archive) return cached.grade;
  const grade = gradeTrade(trade, { values, valueNames, archive });
  gradeCache.set(trade, { values, valueNames, archive, grade });
  return grade;
}

function matchingTrades(context) {
  const { archive, season, team, query } = context;
  const search = text(query).toLowerCase();
  const want = foldSearch(search);
  const rows = [];
  const seen = new Set();
  for (const entry of selectedSeasons(archive, season)) {
    for (const trade of completedLeagueTrades(archive.transactions?.[entry.season])) {
      const transactionId = text(trade.transaction_id);
      if (transactionId && seen.has(transactionId)) continue;
      if (transactionId) seen.add(transactionId);
      const graded = currentGrade(trade, context);
      if (team && !graded.sides.some((side) => season === "all"
        ? managerFor(entry, side.rosterId, archive).managerKey === team : side.rosterId === team)) continue;
      const labels = { ...context, entry };
      if (search && !graded.sides.some((side) => [...side.received, ...side.sent].some((asset) =>
        (want && foldSearch(assetLabel(asset, labels)).includes(want)) || asset.assetId.toLowerCase().includes(search)))) continue;
      const gain = graded.available ? Math.max(...graded.sides.map((side) => side.net)) : null;
      rows.push({ entry, trade, graded, gain, date: Number(trade.status_updated || trade.created) || 0 });
    }
  }
  return rows.sort((a, b) => {
    if (context.sort === "gains" && a.gain !== b.gain) {
      if (a.gain === null) return 1;
      if (b.gain === null) return -1;
      return b.gain - a.gain;
    }
    return b.date - a.date || text(b.trade.transaction_id).localeCompare(text(a.trade.transaction_id));
  });
}

function calculatorLink(trade, sides) {
  if (sides.length !== 2 || sides.some((side) => !side.received.length)
    || (trade.waiver_budget || []).some((transfer) => Number(transfer.amount) > 0)) return "";
  const complete = tradeAssets(trade).assets.every((asset) =>
    asset.sender && asset.receiver && asset.sender !== asset.receiver);
  if (!complete) return "";
  // A spent pick opens as its drafted player; do not send an incomplete trade.
  const [get, give] = sides.map((side) => side.received.map((asset) => asset.pricedAs));
  const players = [...give, ...get].filter((assetId) => assetId?.startsWith("player:"));
  if (new Set(players).size !== players.length) return "";
  const representable = [give, get].every((ids) => parseAssetList(ids.join(",")).length === ids.length);
  return representable ? tradeHref(give, get) : "";
}

// Remember an explicit price lookup when a filter or background update redraws a card.
const dateGrades = new WeakMap();
function tradeDateResult(trade, entry) {
  const state = dateGrades.get(trade);
  const button = (label) => `<button type="button" class="link-btn" data-trade-date="${escapeHtml(trade.transaction_id)}" data-season="${escapeHtml(entry.season)}">${label}</button>`;
  if (!state) return button("Check trade-date grade");
  if (state.loading) return '<p class="muted small">Looking up prices from the trade date…</p>';
  if (state.retry) return `<p class="muted small">Archived prices could not be loaded. ${button("Retry")}</p>`;
  if (!state.grade?.available) return `<p class="muted small">Trade-date grade unavailable. ${escapeHtml(state.reason)}</p>`;
  const sides = state.grade.sides.map((side) => `<li>${escapeHtml(rosterLabel(side.rosterId, entry))} ·
    <strong>${escapeHtml(side.grade)}</strong> · received ${priceLabel(side.valueReceived)}${receivedExtra(side)}, sent ${priceLabel(side.valueSent)}</li>`);
  return `<h4>Trade-date grades</h4><p class="muted small">Prices from ${escapeHtml(dateLabel(Date.parse(state.asOf)))}.</p><ul>${sides.join("")}</ul>`;
}

export async function showTradeDateGrade(button, archive) {
  const id = button.dataset.tradeDate;
  const season = button.dataset.season;
  const entry = archive?.seasons?.find((row) => text(row.season) === season);
  const trade = archive?.transactions?.[season]?.find((row) => text(row.transaction_id) === id);
  if (!entry || !trade || dateGrades.get(trade)?.loading) return;
  const paint = () => {
    const host = document.getElementById(`trade-${id}`)?.querySelector("[data-trade-date-result]");
    if (host?.dataset.season === season) host.innerHTML = tradeDateResult(trade, entry);
  };
  dateGrades.set(trade, { loading: true });
  paint();
  try {
    const { snapshot, reason } = await loadTradeDatePrices(trade);
    const grade = snapshot ? gradeTrade(trade, { basis: "at-time", history: [snapshot] }) : null;
    dateGrades.set(trade, { grade, reason: reason || grade?.reason, asOf: snapshot?.asOf || snapshot?.date });
  } catch {
    dateGrades.set(trade, { retry: true });
  }
  paint();
}

function tradeCard(row, context, rank) {
  const { entry, trade, graded, gain, date } = row;
  const labels = { ...context, entry };
  const names = graded.sides.map((side) => rosterLabel(side.rosterId, entry));
  const ranked = context.sort === "gains" && gain !== null;
  let title = names.join(" / ") || "Incomplete transaction";
  if (ranked) {
    const gainers = graded.sides.filter((side) => side.net === gain).map((side) => rosterLabel(side.rosterId, entry));
    const gainLabel = gain > 0 ? `${gainers.join(" & ")} gained ${priceLabel(gain)}` : "Even exchange";
    title = `#${rank} · ${gainLabel}`;
  }
  const parties = graded.sides.map((side) => {
    const received = side.received.map((asset) => assetHtml(asset, labels));
    if (side.faabReceived) received.push(`$${formatNumber(side.faabReceived)} FAAB`);
    const winner = graded.available && graded.winnerRosterId === side.rosterId;
    return `<div class="trade-log-side">
      <h3>${escapeHtml(rosterLabel(side.rosterId, entry))} received${winner ? ' <span class="mini-chip">Higher value</span>' : ""}</h3>
      <p>${received.length ? received.map((item) => `<span class="received-asset">${item}</span>`).join("") : "No assets received"}</p>
      ${graded.available ? `<p class="muted small">Received ${priceLabel(side.valueReceived)}${receivedExtra(side)} · Sent ${priceLabel(side.valueSent)} · Grade <strong>${escapeHtml(side.grade)}</strong></p>` : ""}
    </div>`;
  }).join("");
  const calcHref = calculatorLink(trade, graded.sides);
  const tier = graded.available ? TIER_LABELS[graded.tier] || "Multi-team" : "Ungraded";
  const id = text(trade.transaction_id);
  return `<article class="workspace-panel trade-log-card" id="trade-${escapeHtml(id)}" tabindex="-1">
    <details${context.focusTradeId === id ? " open" : ""}><summary>
      <strong>${escapeHtml(title)}</strong> <span class="muted small">${escapeHtml(dateLabel(date))} · ${escapeHtml(entry.season)} season · ${escapeHtml(tier)}</span>
    </summary>
    <div class="trade-log-parties">${parties}</div>
    ${graded.reason ? `<p class="muted small">${escapeHtml(graded.reason)}.</p>` : ""}
    ${calcHref ? `<p><a href="${escapeHtml(calcHref)}" target="_blank" rel="noopener noreferrer">Open in calculator (new tab)</a></p>` : ""}
    <details class="trade-grade-details"><summary>How this was graded</summary>
      ${graded.notes.map((note) => `<p class="muted small">${escapeHtml(note)}</p>`).join("")}
    </details>
    <div data-trade-date-result data-season="${escapeHtml(entry.season)}" aria-live="polite">${tradeDateResult(trade, entry)}</div>
    </details></article>`;
}

export function renderTradeLogRows(context = {}) {
  const { archive, season, sort, query, team, limit = 50, focusTradeId } = context;
  const rows = matchingTrades(context);
  const entries = selectedSeasons(archive, season);
  if (!rows.length) {
    if (query || team) return '<p role="status">No trades match these filters.</p>';
    const partial = (archive?.issues || []).some((issue) => issue.resource?.startsWith("transactions/") &&
      entries.some((entry) => text(entry.season) === text(issue.season)));
    return `<p role="status">${partial ? "No completed trades found in the available weeks." :
      `No completed trades in ${season === "all" ? "the available seasons" : escapeHtml(season)}.`}</p>`;
  }
  const gradedCount = rows.filter((row) => row.graded.available).length;
  const years = entries.map((entry) => text(entry.season)).sort();
  const range = years.length > 1 ? `${years[0]}–${years.at(-1)}` : years[0];
  const pageSize = Math.max(limit, focusTradeId ? rows.findIndex((row) => text(row.trade.transaction_id) === focusTradeId) + 1 : 0);
  const cards = rows.slice(0, pageSize).map((row, index) => tradeCard(row, context, index + 1));
  return `<p class="muted small">${gradedCount} of ${rows.length} ${rows.length === 1 ? "trade" : "trades"} graded · ${escapeHtml(range)}${sort === "gains" ? " · Ranked by the largest net value gained by one team." : ""}</p>
    ${cards.join("")}
    ${rows.length > pageSize ? `<button type="button" data-show-more-trades>Show more trades (${rows.length - pageSize} remaining)</button>` : ""}`;
}

function teamFilter(archive, season) {
  const teams = new Map();
  for (const entry of selectedSeasons(archive, season)) {
    for (const roster of entry.rosters || []) {
      const id = text(roster.roster_id);
      if (season === "all") {
        const manager = managerFor(entry, id, archive);
        if (!teams.has(manager.managerKey)) teams.set(manager.managerKey, manager.managerName);
      } else {
        teams.set(id, rosterLabel(id, entry));
      }
    }
  }
  return [...teams.entries()].sort(([, a], [, b]) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
}

export function renderTradeLog(context = {}) {
  const { archive, season, seasons = [], sort, query, team, caveat, loadingMessage } = context;
  const option = (id, label, selected) => `<option value="${escapeHtml(id)}"${id === selected ? " selected" : ""}>${escapeHtml(label)}</option>`;
  const choices = [option("all", "All seasons", season), ...seasons.map((year) => option(text(year), year, season))];
  const teamOptions = teamFilter(archive, season).map(([id, label]) => option(id, label, team));
  const issues = archive?.issues || [];
  const missingWeeks = issues.filter((issue) => issue.resource?.startsWith("transactions/") && (season === "all" || text(issue.season) === season));
  const notices = issues.filter((issue) => issue.resource === "nflState" ||
    (season === "all" && ["season", "historyLimit"].includes(issue.resource))).map((issue) => issue.message);
  if (missingWeeks.length) notices.push(`Sleeper did not return ${missingWeeks.length} ${missingWeeks.length === 1 ? "week" : "weeks"} of transactions. Some trades may be missing.`);
  if (archive?.stale) notices.push("Sleeper could not refresh some data. Showing saved results.");
  return `<p><a class="league-back" href="/l/${encodeURIComponent(archive?.leagueId || "")}">← League</a></p>
    ${caveat ? `<p class="muted small calc-market-caveat">${escapeHtml(caveat)}</p>` : ""}
    ${loadingMessage ? "" : '<p class="muted small">Grades and gains use today’s 12-team Superflex PPR dynasty values.</p>'}
    ${loadingMessage ? "" : notices.map((notice) => `<p role="status">${escapeHtml(notice)}</p>`).join("")}
    <div class="trade-log-filters">
      <label for="league-trade-search">Player or pick
      <input id="league-trade-search" type="search" autocomplete="off" value="${escapeHtml(query || "")}"></label>
      <label for="league-trade-season">Season
      <select id="league-trade-season">${choices.join("")}</select></label>
      <label for="league-trade-team">${season === "all" ? "Manager" : "Team"}
      <select id="league-trade-team"><option value="">${season === "all" ? "All managers" : "All teams"}</option>${teamOptions.join("")}</select></label>
      <label for="league-trade-sort">Sort by
      <select id="league-trade-sort">${option("newest", "Newest first", sort)}${option("gains", "Biggest value gains", sort)}</select></label>
    </div>
    <div id="league-trade-results" aria-live="polite">${loadingMessage ? `<p role="status">${escapeHtml(loadingMessage)}</p>` : renderTradeLogRows(context)}</div>`;
}
