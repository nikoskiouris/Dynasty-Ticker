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

export function renderPowerStat(label, value, noteHtml = "") {
  return `
    <section class="power-stat">
      <span>${escapeHtml(label)}${noteHtml || ""}</span>
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


// The score and its tag ("Middle of the pack") rank roster value only. Say so,
// or an 8-0 team reads "Middle of the pack" as a judgment of its season.
export const POWER_SCORE_NOTE =
  "Dynasty roster value against this league: starters, bench, picks, position balance and age. It ignores your record. A rough score, not a probability.";


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
