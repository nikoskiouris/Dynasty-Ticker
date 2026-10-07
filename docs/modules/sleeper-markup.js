import { SLEEPER_AVATAR_BASE } from "./constants.js";
import { escapeHtml } from "./html.js";

const AVATAR_ID = /^[A-Za-z0-9_-]{1,80}$/;
const CLASS_TOKEN = /^[A-Za-z0-9_-]{1,48}$/;

export function safeClassToken(value) {
  const token = String(value ?? "").trim();
  return CLASS_TOKEN.test(token) ? token : "";
}

// Sleeper avatar ids are a path segment. Anything else is dropped so a
// display name or quote cannot break out of src.
export function safeAvatarUrl(avatarId, base = SLEEPER_AVATAR_BASE) {
  const id = String(avatarId ?? "").trim();
  if (!AVATAR_ID.test(id)) return "";
  return `${base}${id}`;
}

export function hashHue(text) {
  let hash = 0;
  const value = String(text ?? "");
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash % 360;
}

export function renderAvatarMarkup(manager, { size = "md", className = "", base = SLEEPER_AVATAR_BASE } = {}) {
  const name = String(manager?.displayName || manager?.name || "?");
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const src = safeAvatarUrl(manager?.avatar, base);
  const sizeToken = safeClassToken(size) || "md";
  const extra = String(className ?? "")
    .split(/\s+/)
    .map((token) => safeClassToken(token))
    .filter(Boolean)
    .join(" ");
  const classes = `avatar avatar-${sizeToken}${extra ? ` ${extra}` : ""}`;
  const hue = hashHue(name);
  if (src) {
    return `<span class="${classes}" style="--hue:${hue}"><img src="${escapeHtml(src)}" alt="${escapeHtml(name)}" loading="lazy" /></span>`;
  }
  return `<span class="${classes}" style="--hue:${hue}"><span>${escapeHtml(initial)}</span></span>`;
}

export function renderBadgeRow(badges, className = "power-badge") {
  const cls = safeClassToken(className) || "power-badge";
  return (Array.isArray(badges) ? badges : [])
    .map((badge) => `<span class="${cls}">${escapeHtml(badge)}</span>`)
    .join("");
}

export function renderInsightMarkup(insight) {
  const tone = safeClassToken(insight?.tone);
  return `<section class="insight-item${tone ? ` ${tone}` : ""}"><strong>${escapeHtml(insight?.title)}</strong><span>${escapeHtml(insight?.body)}</span></section>`;
}

export function renderEscapedNameList(items, pick = (item) => item) {
  return (Array.isArray(items) ? items : [])
    .map((item) => escapeHtml(typeof pick === "function" ? pick(item) : item))
    .join(", ");
}
