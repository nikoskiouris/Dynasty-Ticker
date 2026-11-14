import { escapeHtml, formatNumber } from "./html.js";

// "Give real trade advice" (ticket 030). Rules only, no AI: the calculator's
// own verdict, even-up search and team-impact model, put in plain words.
// buildTradeAdvice() is the seam a later AI section can extend: it returns
// sections, and the panel renders whatever sections it is given.

const ordinalSuffix = (n) => {
  const v = Math.abs(Math.round(n)) % 100;
  if (v >= 11 && v <= 13) return "th";
  return ["th", "st", "nd", "rd"][v % 10] || "th";
};
const place = (rank) => Number.isFinite(Number(rank)) && Number(rank) > 0 ? `${rank}${ordinalSuffix(Number(rank))}` : "—";

/**
 * @param {object} input
 * @param {string} input.verdictLine   Same line as the Market verdict headline.
 * @param {boolean} input.fair         Already inside the fair band.
 * @param {object|null} input.evenUp   { line, side, assetId, name, closes } from the even-up search.
 * @param {object|null} input.team     { connected, ready, waiting, mySide, partnerName }.
 */
export function buildTradeAdvice({ verdictLine = "", fair = false, evenUp = null, team = null, lighter = "" } = {}) {
  const sections = [{
    id: "verdict",
    title: "Verdict",
    lines: [verdictLine],
    note: "Based on Dynasty Ticker prices (12-team Superflex PPR). A price gap is not a probability that either side wins the trade.",
  }];
  if (fair) {
    sections.push({ id: "fair", title: "How to make it fair", lines: ["It is already inside the fair band. No add needed."] });
  } else if (evenUp?.line) {
    sections.push({
      id: "fair",
      title: "How to make it fair",
      lines: [evenUp.line],
      action: evenUp.assetId ? { side: evenUp.side, assetId: evenUp.assetId, name: evenUp.name, label: `Add ${evenUp.name} to ${evenUp.receiver}` } : null,
      note: evenUp.closes ? "" : "No single pick lands it in the fair band. Adding a player may get closer.",
    });
  } else {
    sections.push({ id: "fair", title: "How to make it fair", lines: [`No single pick gets this near fair. Try adding a player for ${lighter || "the side that gets less"}.`] });
  }
  if (!team?.connected) {
    sections.push({ id: "team", title: "For your team", lines: ["Connect your league for team-specific advice."], link: { href: "/leagues", label: "Connect your league" } });
  } else if (!team.ready) {
    sections.push({ id: "team", title: "For your team", lines: [team.waiting || "Pick your team and a trade partner to see lineup impact."] });
  } else if (team.mySide) {
    const { before, after } = team.mySide;
    const moved = Number(after.rank) < Number(before.rank) ? "goes up" : Number(after.rank) > Number(before.rank) ? "drops" : "stays";
    const total = Number(after.totalTeams) || Number(before.totalTeams) || 0;
    const delta = Math.round(Number(after.starterValue) - Number(before.starterValue));
    sections.push({
      id: "team",
      title: "For your team",
      lines: [
        moved === "stays"
          ? `Your starting lineup stays ${place(before.rank)}${total ? ` of ${total}` : ""} in the league.`
          : `Your starting lineup ${moved} from ${place(before.rank)} to ${place(after.rank)}${total ? ` of ${total}` : ""} in the league.`,
        `Starter value ${delta >= 0 ? "+" : "−"}${formatNumber(Math.abs(delta))} (${formatNumber(before.starterValue)} → ${formatNumber(after.starterValue)}).`,
        Number.isFinite(Number(after.benchValue) - Number(before.benchValue))
          ? `Bench ${Number(after.benchValue) >= Number(before.benchValue) ? "+" : "−"}${formatNumber(Math.abs(Math.round(Number(after.benchValue) - Number(before.benchValue))))}.` : "",
      ].filter(Boolean),
      note: `Lineup rank sums our prices for your best starters against the other teams in your league. It is an estimate, not a forecast of wins.${team.partnerName ? ` Trade partner: ${team.partnerName}.` : ""}`,
    });
  }
  return sections;
}

export function renderTradeAdviceButton({ ready = false } = {}) {
  return `<button type="button" class="ghost-btn btn-sm trade-advice-btn" data-action="trade-advice-open"${ready ? "" : ' disabled aria-describedby="trade-advice-hint"'}><span class="mini-chip">New</span> Give real trade advice</button>${ready ? "" : '<span id="trade-advice-hint" class="muted small trade-advice-hint">Add a player or pick to both sides first.</span>'}`;
}

export function renderTradeAdvicePanel(sections = []) {
  return `<div class="trade-advice-backdrop" data-action="trade-advice-close"></div>
  <aside class="trade-advice-panel" role="dialog" aria-modal="true" aria-labelledby="trade-advice-title" tabindex="-1">
    <header><h2 id="trade-advice-title">Trade advice</h2><button type="button" class="ghost-btn btn-sm" data-action="trade-advice-close" aria-label="Close trade advice">✕</button></header>
    <p class="muted small">From our prices and your league data. No AI.</p>
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
