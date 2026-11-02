import { facePlayerId, renderPlayerFace } from "./player-face.js";

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return numeric.toLocaleString();
}

export function playersAndPicksLabel(count) {
  const n = Math.max(0, Math.round(Number(count) || 0));
  return n === 1 ? "1 player or pick" : `${formatNumber(n)} players & picks`;
}

export function formatSignedNumber(value) {
  const numericValue = Number(value) || 0;
  return `${numericValue > 0 ? "+" : ""}${formatNumber(numericValue)}`;
}

function ordinalLabel(rank) {
  const value = Number(rank);
  if (!Number.isFinite(value)) return "";
  const rounded = Math.trunc(value);
  const mod100 = rounded % 100;
  if (mod100 >= 10 && mod100 <= 20) return `${rounded}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[rounded % 10] || "th";
  return `${rounded}${suffix}`;
}

export function formatStarterRankLabel(rank, totalTeams) {
  const label = ordinalLabel(rank);
  if (!label) return "";
  const total = Number(totalTeams);
  if (!Number.isFinite(total) || total <= 0) return label;
  return `${label}/${total}`;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function tradeFaceSize(options) {
  const size = options?.faceSize;
  return size === "sm" || size === "md" || size === "xs" ? size : "xs";
}

export function renderTradeAssetLabel(item, formatValue = formatNumber, options = {}) {
  const faceSize = tradeFaceSize(options);
  if (item?.draftedPlayerName) {
    const pickLabel = escapeHtml(item.pickLabel || item.name || "Pick");
    const extraValue = Number(item.draftedPlayerValue) > 0
      ? `, ${formatValue(Math.round(item.draftedPlayerValue))}`
      : "";
    const face = renderPlayerFace(item.draftedPlayerId, item.draftedPlayerName, { size: faceSize });
    return `${pickLabel} <span class="pick-selection">(${face}${escapeHtml(item.draftedPlayerName)}${extraValue})</span>`;
  }
  const name = escapeHtml(item?.name || "Asset");
  const face = renderPlayerFace(facePlayerId(item), item?.name, { size: faceSize });
  if (!face) return name;
  return `${face}<span class="player-name-text">${name}</span>`;
}

export function renderTradeMoveSide(items, formatValue = formatNumber) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) return `<span class="trade-chip trade-chip-empty">picks</span>`;
  return list.map((item) => {
    const label = renderTradeAssetLabel(item, formatValue);
    const faced = label.startsWith("<span class=\"player-face");
    return `<span class="trade-chip${faced ? " has-face" : ""}">${label}</span>`;
  }).join("");
}

export function renderTradeMove(row, formatValue = formatNumber) {
  return `<span class="trade-row-move"><span class="trade-move-side">${renderTradeMoveSide(row?.received, formatValue)}</span><span class="trade-arrow" aria-hidden="true">←</span><span class="trade-move-side">${renderTradeMoveSide(row?.sent, formatValue)}</span></span>`;
}

export function renderConnectGate({
  copy = "Connect my league to open this.",
  label = "Connect my league",
  action = "draft-connect",
} = {}) {
  return `
    <section class="connect-gate">
      <p>${escapeHtml(copy)}</p>
      <button type="button" data-action="${escapeHtml(action)}">${escapeHtml(label)}</button>
    </section>
  `;
}

export async function copyTextToClipboard(text, clipboard = globalThis.navigator?.clipboard, doc = globalThis.document) {
  try {
    if (clipboard?.writeText) {
      await clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }
  if (!doc?.body) return false;
  try {
    const tempInput = doc.createElement("textarea");
    tempInput.value = text;
    tempInput.setAttribute("readonly", "");
    tempInput.style.position = "absolute";
    tempInput.style.left = "-9999px";
    doc.body.appendChild(tempInput);
    tempInput.select();
    const copied = doc.execCommand("copy");
    doc.body.removeChild(tempInput);
    return copied;
  } catch {
    return false;
  }
}
