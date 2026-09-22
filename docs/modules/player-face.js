const SLEEPER_PLAYER_THUMB_BASE = "https://sleepercdn.com/content/nfl/players/thumb/";
const FACE_SIZES = new Set(["xs", "sm", "md"]);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export { SLEEPER_PLAYER_THUMB_BASE };

export function playerIdFromAssetId(assetId) {
  const value = String(assetId || "");
  return value.startsWith("player:") ? value.slice("player:".length) : "";
}

export function sleeperPlayerThumbUrl(playerId) {
  const id = String(playerId || "").trim().replace(/^player:/, "");
  return id && id !== "0" ? `${SLEEPER_PLAYER_THUMB_BASE}${encodeURIComponent(id)}.jpg` : "";
}

export function playerInitials(name) {
  const parts = String(name || "")
    .replaceAll(/['’.]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

export function facePlayerId(record) {
  if (record == null || record === "") return "";
  if (typeof record !== "object") {
    const id = String(record).replace(/^player:/, "").trim();
    return id && id !== "0" ? id : "";
  }
  if (record.assetType === "pick" || record.kind === "pick") return "";
  const direct = String(record.playerId || "").replace(/^player:/, "").trim();
  if (direct && direct !== "0") return direct;
  return playerIdFromAssetId(record.assetId);
}

export function renderPlayerFace(playerId, name = "", { size = "sm" } = {}) {
  const id = String(playerId || "").replace(/^player:/, "").trim();
  if (!id || id === "0") return "";
  const faceSize = FACE_SIZES.has(size) ? size : "sm";
  const src = sleeperPlayerThumbUrl(id);
  if (!src) return "";
  return `<span class="player-face player-face-${faceSize}" aria-hidden="true"><img class="player-face-photo" src="${escapeHtml(src)}" alt="" width="64" height="64" loading="lazy" decoding="async"><span class="player-face-initials">${escapeHtml(playerInitials(name))}</span></span>`;
}

export function renderPlayerLabel(name, playerId, { size = "sm", tag = "span" } = {}) {
  const safeTag = tag === "strong" ? "strong" : "span";
  const text = escapeHtml(name || "");
  const face = renderPlayerFace(playerId, name, { size });
  if (!face) return safeTag === "strong" ? `<strong>${text}</strong>` : text;
  return `<${safeTag} class="player-name">${face}<span class="player-name-text">${text}</span></${safeTag}>`;
}
