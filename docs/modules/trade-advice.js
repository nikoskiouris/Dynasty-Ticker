import { escapeHtml, formatNumber } from "./html.js";
import { draftVerdictModel } from "./trade-draft.js";
import { formatGenericPickAssetLabel, getGlobalMaxPlayerValue, parsePickAssetId } from "./values.js";
import { verdictLineNamed } from "./verdict-copy.js";

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
      const outcomes = slots.map(bucket => {
        const adjusted = [...base[side]];
        adjusted[index] = values[prefix + bucket];
        const sides = { ...base, [side]: adjusted };
        const { verdict } = draftVerdictModel(sides.left, sides.right, { globalMaxValue });
        return verdictLineNamed(verdict, teamNames);
      });
      if (outcomes.length === 2 && outcomes[0] === outcomes[1]) {
        lines.push(`${receiver} an early or late ${name} — ${outcomes[0]}.`);
      } else {
        slots.forEach((bucket, i) => lines.push(`${receiver} ${bucket === "early" ? "an early" : "a late"} ${name} — ${outcomes[i]}.`));
      }
    });
  }
  const note = lines.length ? "Each estimate changes one pick at a time." : "";
  if (unsplit.size) lines.push(`The board has no early or late estimates for ${[...unsplit].join(", ")}.`);
  if (!lines.length) return null;
  return { id: "pick-slots", title: "Early and late pick scenarios", lines, note, collapsed: true };
}

const ppr = value => formatNumber(Math.round(value * 10) / 10);

// Compare individual projections with replacement at the same position.
// Projected points from separate roster slots cannot simply be added together.
function lineupAdvice({ draft, players, replacements, receivers }) {
  const rows = [];
  const counts = {};
  const notes = [];
  let clipped = false;
  for (const side of ["right", "left"]) {
    const incoming = draft[side].filter(item => item.assetId.startsWith("player:"));
    counts[side] = incoming.length;
    const forecasts = [];
    for (const { assetId, name } of incoming) {
      const player = players?.[assetId];
      const { season, remainingGames, remainingPpr } = player?.projection || {};
      if (!season || !name || !(remainingGames > 0) || !Number.isFinite(remainingPpr)) continue;
      const baseline = replacements?.[player.position];
      const margin = Number.isFinite(baseline) ? remainingPpr - baseline : null;
      forecasts.push({ name, position: player.position, receiver: receivers[side], season, remainingGames, remainingPpr, margin });
    }
    forecasts.sort((a, b) => (b.margin ?? -Infinity) - (a.margin ?? -Infinity) || b.remainingPpr - a.remainingPpr);
    clipped ||= forecasts.length > 2;
    rows.push(...forecasts.slice(0, 2));
  }
  if (clipped) notes.push("Showing the top two available projections per team by margin over replacement.");
  const extra = counts.left - counts.right;
  if (extra) {
    const side = extra > 0 ? "left" : "right";
    const slots = Math.abs(extra);
    notes.push(`${receivers[side]} takes on ${slots} extra roster ${slots === 1 ? "spot" : "spots"}.`);
  }
  if (!rows.length && !notes.length) return null;
  return { id: "lineup", title: rows.length ? "Rest-of-season projections" : "Roster spots", rows, lines: [], note: notes.join(" ") };
}

export function buildTradeAdvice({ verdictLine = "", fair, alreadyClose, evenUp, lighter = "the side receiving less", context } = {}) {
  let title = "Keep the offer as written";
  let reason = verdictLine;
  let action = null;
  if (fair) {
    reason = "The two sides are within 5% on dynasty value.";
  } else if (evenUp) {
    title = `Add ${evenUp.name} for ${evenUp.receiver}`;
    reason = `Revised offer · ${evenUp.outcome}`;
    if (evenUp.assetId) action = { ...evenUp, label: "Apply change" };
  } else if (!alreadyClose) {
    title = `Rework the package for ${lighter}`;
  }
  return [
    { id: "recommendation", title, lines: [reason], action },
    context && lineupAdvice(context),
    context && pickSlotAdvice(context),
  ].filter(Boolean);
}

function renderProjections(rows) {
  if (!rows?.length) return "";
  return `<table class="advice-forecasts"><thead><tr><th scope="col">Player</th><th scope="col">PPR pts</th><th scope="col">vs. position<br>replacement</th></tr></thead><tbody>
    ${rows.map(row => {
      const gameLabel = row.remainingGames === 1 ? "game" : "games";
      const rounded = row.margin == null ? null : Math.round(row.margin * 10) / 10;
      const delta = rounded == null ? "—" : `${rounded > 0 ? "+" : ""}${ppr(rounded)}`;
      return `<tr><th scope="row">${escapeHtml(row.name)}<small>${escapeHtml(row.receiver)} · ${escapeHtml(row.position)} · ${escapeHtml(row.remainingGames)} ${gameLabel} in ${escapeHtml(row.season)}</small></th><td>${ppr(row.remainingPpr)}</td><td>${delta}</td></tr>`;
    }).join("")}
  </tbody></table>`;
}

export function renderTradeAdviceButton({ ready = false } = {}) {
  return `<button type="button" class="ghost-btn btn-sm trade-advice-btn" data-action="trade-advice-open"${ready ? "" : ' disabled aria-describedby="trade-advice-hint"'}>Get trade advice</button>${ready ? "" : '<span id="trade-advice-hint" class="muted small trade-advice-hint">Add a player or pick to both sides first.</span>'}`;
}

export function renderTradeAdvicePanel(sections = []) {
  return `<div class="trade-advice-backdrop" data-action="trade-advice-close"></div>
  <aside class="trade-advice-panel" role="dialog" aria-modal="true" aria-labelledby="trade-advice-title" tabindex="-1">
    <header><h2 id="trade-advice-title">Trade advice</h2><button type="button" class="ghost-btn btn-sm" data-action="trade-advice-close" aria-label="Close trade advice">✕</button></header>
    ${sections.map(section => {
      const content = `${section.lines.map(line => `<p>${escapeHtml(line)}</p>`).join("")}
        ${renderProjections(section.rows)}
        ${section.action ? `<button type="button" class="ghost-btn btn-sm" data-action="trade-advice-apply" data-side="${section.action.side === "right" ? "right" : "left"}" data-asset-id="${escapeHtml(section.action.assetId)}" data-name="${escapeHtml(section.action.name)}">${escapeHtml(section.action.label)}</button>` : ""}
        ${section.note ? `<p class="muted small">${escapeHtml(section.note)}</p>` : ""}`;
      return section.collapsed
        ? `<details class="trade-advice-section"><summary>${escapeHtml(section.title)}</summary>${content}</details>`
        : `<section class="trade-advice-section" data-advice="${escapeHtml(section.id)}"><h3>${escapeHtml(section.title)}</h3>${content}</section>`;
    }).join("")}
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
    const items = [...panel.querySelectorAll("button, a[href], summary")].filter((node) => !node.disabled);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === panel || !panel.contains(active))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (active === last || !panel.contains(active))) { event.preventDefault(); first.focus(); }
  });
}
