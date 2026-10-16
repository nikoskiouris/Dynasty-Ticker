// Shared verdict bars. /trade, a cold /t, and the landing all read this so the
// hatch, the credited totals, and the pointer are one implementation.
import { escapeHtml, formatNumber } from "./html.js";
import { FEWER_BETTER_LABEL, fewerBetterBody } from "./verdict-copy.js";

// Bar segments: listed price plus a separate stars segment. Pass meters to
// keep a private /trade bar on the listed totals, with no stars segment.
export function sharedBarSegments(model, meters = null) {
  const adj = model?.adjustment;
  const side = (key, listed) => {
    const stars = !meters && adj && (adj.side === "left") === (key === "give") ? Math.round(Number(adj.amount) || 0) : 0;
    const base = Math.round(Number(meters ? meters[key] : listed) || 0);
    return { listed: base, stars, total: base + stars };
  };
  return { give: side("give", model?.give), get: side("get", model?.get) };
}

export function meterTrack(seg, maxSide) {
  const pct = (value) => Math.round((value / maxSide) * 1000) / 10;
  if (!seg.stars) return `<div class="meter-track"><span style="width:${pct(seg.listed)}%"></span></div>`;
  return `<div class="meter-track meter-split"><span style="width:${pct(seg.listed)}%"></span><span class="meter-stars" style="width:${pct(seg.stars)}%" title="${escapeHtml(FEWER_BETTER_LABEL)}"></span></div>`;
}

// ◀/▶ beside the bigger side on wide layouts; a plain dot on phones.
export function calcPointer(arrow) {
  return `<b class="calc-pointer" aria-hidden="true"><span class="calc-pointer-wide">${arrow}</span><span class="calc-pointer-narrow">●</span></b>`;
}

// Why the verdict moved: fewer, better players are worth extra. Listed prices stay in the rows.
export function starsPremiumMarkup(model, { side = "", detail = "" } = {}) {
  const adj = model?.adjustment;
  if (!adj || !(adj.amount > 0)) return "";
  const who = side || (adj.side === "left" ? "Give" : "Get");
  const after = detail ? ` After that: ${escapeHtml(detail)}.` : "";
  return `<p class="draft-package"><strong>${escapeHtml(FEWER_BETTER_LABEL)}:</strong> ${escapeHtml(fewerBetterBody(formatNumber(adj.amount), who))}${after}</p>`;
}

// One comparison bar. Each side's flex is its credited total, so the wider
// side is the one the verdict percentage is about. The hatch is the stars.
export function compareMetersMarkup(model) {
  const bars = sharedBarSegments(model, null);
  const meter = (team, seg) => {
    const total = Math.max(seg.total, 0);
    return `<div class="launch-meter meter-${team}" style="flex:${total} 1 0">${meterTrack(seg, Math.max(total, 1))}</div>`;
  };
  return `<div class="launch-meters" data-give="${bars.give.total}" data-get="${bars.get.total}">${meter("give", bars.give)}${meter("get", bars.get)}</div>`;
}
