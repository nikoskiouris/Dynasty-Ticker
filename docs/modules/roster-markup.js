import { escapeHtml } from "./html.js";
import { sleeperAvatarUrl } from "./sleeper.js";

const AVATAR_SIZES = new Set(["xs", "sm", "md", "lg"]);

function classToken(value) {
  return String(value || "").replace(/[^A-Za-z0-9_-]/g, "");
}

export function hashHue(text) {
  let hash = 0;
  const value = String(text || "");
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash % 360;
}

export function renderPowerStat(label, value) {
  return `
    <section class="power-stat">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </section>
  `;
}

export function renderPositionMeter(position) {
  const width = Math.max(0, Math.min(100, Math.round(Number(position?.percentile) * 100) || 0));
  return `
    <div class="position-meter">
      <div class="position-meter-top">
        <strong>${escapeHtml(position?.position)}</strong>
        <span>${escapeHtml(position?.rankLabel)}</span>
      </div>
      <div class="meter-track" aria-hidden="true">
        <span style="width:${width}%"></span>
      </div>
      <p>${escapeHtml(position?.label)}</p>
    </div>
  `;
}

export function renderSleeperInsight(insight) {
  const tone = classToken(insight?.tone);
  return `
    <section class="insight-item ${tone}">
      <strong>${escapeHtml(insight?.title)}</strong>
      <span>${escapeHtml(insight?.body)}</span>
    </section>
  `;
}

export function renderPowerHero({ score, managerName, grade, tierClass, badges } = {}) {
  const numeric = Number(score);
  const safeScore = Number.isFinite(numeric) ? Math.max(0, Math.min(100, Math.round(numeric))) : 0;
  const tier = classToken(tierClass);
  const badgeHtml = (Array.isArray(badges) ? badges : [])
    .map((badge) => `<span class="power-badge">${escapeHtml(badge)}</span>`)
    .join("");
  return `
    <div class="power-hero">
      <div class="power-score-ring" style="--score:${safeScore}">
        <strong>${safeScore}</strong>
        <span>/100</span>
      </div>
      <div class="power-hero-copy">
        <div class="power-title-row">
          <h3>${escapeHtml(managerName)}</h3>
          <span class="power-tier ${tier}">${escapeHtml(grade)}</span>
        </div>
        <div class="power-badge-row">
          ${badgeHtml}
        </div>
      </div>
    </div>
  `;
}

export function renderMultiTeamPartyTitle(displayName, isMe = false) {
  return isMe ? "You" : escapeHtml(displayName);
}

export function renderAvatar(manager, { size = "md", className = "" } = {}) {
  const name = String(manager?.displayName || manager?.name || "?");
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const safeSize = AVATAR_SIZES.has(size) ? size : "md";
  const extraClass = classToken(className);
  const hue = hashHue(name);
  const src = sleeperAvatarUrl(manager?.avatar);
  const classes = `avatar avatar-${safeSize}${extraClass ? ` ${extraClass}` : ""}`;
  if (!src) {
    return `<span class="${classes}" style="--hue:${hue}"><span>${escapeHtml(initial)}</span></span>`;
  }
  return `<span class="${classes}" style="--hue:${hue}"><img src="${escapeHtml(src)}" alt="${escapeHtml(name)}" loading="lazy" /></span>`;
}
