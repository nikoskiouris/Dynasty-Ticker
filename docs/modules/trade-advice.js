import { escapeHtml, formatNumber } from "./html.js";
import { draftVerdictModel } from "./trade-draft.js";
import { formatGenericPickAssetLabel, getGlobalMaxPlayerValue, parsePickAssetId } from "./values.js";
import { verdictLineNamed } from "./verdict-copy.js";

// "Give real trade advice" (ticket 030). Rules only, no AI: the calculator's
// own verdict and even-up search, put in plain words.
// buildTradeAdvice() is the seam a later AI section can extend: it returns
// sections, and the panel renders whatever sections it is given.

// Vary one unspecified pick at a time. Repeated copies on the same side have
// the same effect. A later year's unsplit round keeps its published price.
function pickSlotAdvice({ draft, priceOf, values, teamNames }) {
  const lines = [];
  const unsplit = new Set();
  const base = { left: draft.left.map(priceOf), right: draft.right.map(priceOf) };
  const globalMaxValue = getGlobalMaxPlayerValue(values);
  for (const side of ["left", "right"]) {
    const seen = new Set();
    draft[side].forEach(({ assetId }, index) => {
      if (!assetId.endsWith(":any") || !parsePickAssetId(assetId) || seen.has(assetId)) return;
      seen.add(assetId);
      const name = formatGenericPickAssetLabel(assetId);
      const prefix = assetId.slice(0, assetId.lastIndexOf(":") + 1);
      const slots = ["early", "late"].filter(bucket => Number.isFinite(values[prefix + bucket]) && values[prefix + bucket] > 0);
      if (!slots.length) {
        unsplit.add(name);
        return;
      }
      const receiver = side === "left" ? teamNames.Give : teamNames.Get;
      for (const bucket of slots) {
        const adjusted = [...base[side]];
        adjusted[index] = values[prefix + bucket];
        const sides = { ...base, [side]: adjusted };
        const { verdict } = draftVerdictModel(sides.left, sides.right, { globalMaxValue });
        lines.push(`${receiver} ${bucket === "early" ? "an early" : "a late"} ${name} — ${verdictLineNamed(verdict, teamNames)}.`);
      }
    });
  }
  const note = lines.length ? "Each scenario changes one pick and re-prices the full trade." : "";
  if (unsplit.size) lines.push(`The board has no early or late estimates for ${[...unsplit].join(", ")}.`);
  if (!lines.length) return null;
  return { id: "pick-slots", title: "Where the picks land", lines, note };
}

const ppr = value => formatNumber(Math.round(value * 10) / 10);

// Compare individual players with replacement at their eligible position.
// Adding their projected points would imply every player enters an open slot.
function lineupAdvice({ draft, players, replacements, teamNames }) {
  const lines = [];
  const playerCounts = {};
  let clipped = false;
  for (const side of ["left", "right"]) {
    const incoming = draft[side].filter(item => item.assetId.startsWith("player:"));
    playerCounts[side] = incoming.length;
    const receiver = side === "left" ? teamNames.Give : teamNames.Get;
    const forecasts = [];
    for (const { assetId, name } of incoming) {
      const player = players?.[assetId];
      const { season, remainingGames, remainingPpr } = player?.projection || {};
      const baseline = replacements?.[player?.position];
      if (!season || !(remainingGames > 0) || !Number.isFinite(remainingPpr) || !Number.isFinite(baseline)) continue;
      const margin = remainingPpr - baseline;
      const comparison = Math.abs(margin) < 0.05 ? "level with" : `${ppr(Math.abs(margin))} ${margin > 0 ? "above" : "below"}`;
      forecasts.push({
        margin,
        line: `${receiver} ${name}, projected for ${ppr(remainingPpr)} PPR points over ${remainingGames} remaining ${season} regular-season ${remainingGames === 1 ? "game" : "games"}. That is ${comparison} the model’s replacement ${player.position}.`,
      });
    }
    forecasts.sort((a, b) => b.margin - a.margin);
    clipped ||= forecasts.length > 2;
    lines.push(...forecasts.slice(0, 2).map(row => row.line));
  }
  if (!lines.length) return null;
  const picksOnly = !playerCounts.left || !playerCounts.right;
  const title = picksOnly ? "Lineup now or picks later" : "Starting lineup and depth";
  if (picksOnly) {
    const picks = playerCounts.left ? draft.right : draft.left;
    const drafts = [...new Set(picks.map(item => parsePickAssetId(item.assetId)?.season).filter(Boolean))].sort();
    if (drafts.length) lines.push(`The draft capital can be traded now or used in ${drafts.join(" and ")}.`);
  }
  const extraPlayers = Math.abs(playerCounts.left - playerCounts.right);
  if (extraPlayers) {
    const receiver = playerCounts.left > playerCounts.right ? teamNames.Give : teamNames.Get;
    lines.push(`${receiver} ${extraPlayers} more ${extraPlayers === 1 ? "player" : "players"} than it sends. A full roster may need to make room.`);
  }
  const note = `${clipped ? "Showing the two largest projected margins per side. " : ""}Compare each forecast with the starter that player would replace on your roster. A player who stays on the bench adds depth.`;
  return { id: "lineup", title, lines, note };
}

/**
 * @param {object} input
 * @param {string} input.verdictLine   Same line as the Market verdict headline.
 * @param {boolean} input.fair         Already inside the fair band.
 * @param {object|null} input.evenUp   { line, side, assetId, name, closes } from the even-up search.
 *
 * No "For your team" section: Trade Calculator is never team-specific (owner
 * rule, Nov 19, 2026), so the panel never offers team advice or asks to connect.
 */
export function buildTradeAdvice({ verdictLine = "", fair = false, alreadyClose = false, evenUp = null, lighter = "", context = null } = {}) {
  const sections = [{
    id: "verdict",
    title: "Verdict",
    lines: [verdictLine],
    note: "Based on Dynasty Ticker prices (12-team Superflex PPR). A price gap is not a probability that either side wins the trade.",
  }];
  if (context) sections.push(...[lineupAdvice(context), pickSlotAdvice(context)].filter(Boolean));
  if (fair) {
    sections.push({ id: "fair", title: "How to make it fair", lines: ["It is already inside the fair band. No add needed."] });
  } else if (evenUp?.line) {
    sections.push({
      id: "fair",
      title: "How to make it fair",
      lines: [evenUp.line],
      action: evenUp.assetId ? { side: evenUp.side, assetId: evenUp.assetId, name: evenUp.name, label: `Add ${evenUp.name} to ${evenUp.receiver}` } : null,
      note: evenUp.closes ? "" : "This addition narrows the gap. More value is needed to reach Even or Close.",
    });
  } else {
    sections.push({ id: "fair", title: "How to make it fair", lines: [alreadyClose ? "The offer is already Close. You can leave it as proposed." : `Try a different package for ${lighter || "the side that gets less"}.`] });
  }
  return sections;
}

export function renderTradeAdviceButton({ ready = false } = {}) {
  return `<button type="button" class="ghost-btn btn-sm trade-advice-btn" data-action="trade-advice-open"${ready ? "" : ' disabled aria-describedby="trade-advice-hint"'}>Get trade advice</button>${ready ? "" : '<span id="trade-advice-hint" class="muted small trade-advice-hint">Add a player or pick to both sides first.</span>'}`;
}

export function renderTradeAdvicePanel(sections = []) {
  return `<div class="trade-advice-backdrop" data-action="trade-advice-close"></div>
  <aside class="trade-advice-panel" role="dialog" aria-modal="true" aria-labelledby="trade-advice-title" tabindex="-1">
    <header><h2 id="trade-advice-title">Trade advice</h2><button type="button" class="ghost-btn btn-sm" data-action="trade-advice-close" aria-label="Close trade advice">✕</button></header>
    <p class="muted small">From Dynasty Ticker prices. No AI.</p>
    ${sections.map((section) => `<section class="trade-advice-section" data-advice="${escapeHtml(section.id)}">
      <h3>${escapeHtml(section.title)}</h3>
      ${section.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
      ${section.action ? `<button type="button" class="ghost-btn btn-sm" data-action="trade-advice-apply" data-side="${section.action.side === "right" ? "right" : "left"}" data-asset-id="${escapeHtml(section.action.assetId)}" data-name="${escapeHtml(section.action.name)}">${escapeHtml(section.action.label)}</button>` : ""}
      ${section.link ? `<a href="${escapeHtml(section.link.href)}">${escapeHtml(section.link.label)}</a>` : ""}
      ${section.note ? `<p class="muted small">${escapeHtml(section.note)}</p>` : ""}
    </section>`).join("")}
  </aside>`;
}

// Panel host plus Back handling. Opening adds one history entry; Back, Esc
// and ✕ all close the panel and leave the trade as it is.
let host = null;
let returnFocus = null;
let onBack = null;

export function tradeAdviceOpen() { return Boolean(host && !host.hidden); }

export function openTradeAdvice(html, { trigger = null } = {}) {
  if (!host) {
    host = document.createElement("div");
    host.id = "trade-advice";
    host.className = "trade-advice";
    document.body.appendChild(host);
  }
  const wasOpen = tradeAdviceOpen();
  host.innerHTML = html;
  host.hidden = false;
  if (!wasOpen) {
    returnFocus = trigger;
    try { history.pushState({ ...(history.state || {}), tradeAdvice: true }, "", window.location.href); } catch { /* panel still works without Back */ }
  }
  host.querySelector(".trade-advice-panel")?.focus({ preventScroll: true });
}

function hide() {
  if (!host) return;
  host.hidden = true;
  host.innerHTML = "";
  const target = returnFocus?.isConnected ? returnFocus : document.querySelector(".trade-advice-btn");
  returnFocus = null;
  target?.focus?.({ preventScroll: true });
}

export function closeTradeAdvice() {
  if (!tradeAdviceOpen()) return;
  if (history.state?.tradeAdvice) history.back(); // popstate below hides it
  else hide();
}

export function onTradeAdviceBack(callback) { onBack = callback; }

if (typeof window !== "undefined") {
  // Registered before the app's own popstate handler (this module loads first),
  // so leaving the panel is not treated as a route change.
  window.addEventListener("popstate", (event) => {
    if (tradeAdviceOpen()) {
      event.stopImmediatePropagation();
      hide();
      onBack?.();
      return;
    }
    if (event.state?.tradeAdvice) {
      // Forward into a closed panel's entry: step back over it.
      event.stopImmediatePropagation();
      history.back();
    }
  });
  window.addEventListener("keydown", (event) => {
    if (!tradeAdviceOpen()) return;
    if (event.key === "Escape") { event.preventDefault(); closeTradeAdvice(); return; }
    if (event.key !== "Tab") return;
    // aria-modal: keep Tab inside the panel.
    const panel = host.querySelector(".trade-advice-panel");
    const items = [...panel.querySelectorAll("button, a[href]")].filter((node) => !node.disabled);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === panel || !panel.contains(active))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (active === last || !panel.contains(active))) { event.preventDefault(); first.focus(); }
  });
}
