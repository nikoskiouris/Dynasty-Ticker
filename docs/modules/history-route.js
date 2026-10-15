import { isRankAssetId } from "./ranks.js";

// Sleeper player ids are digits. Picks keep their asset id. Nothing else is a route.
const ROUTE_ID = /^(?:\d{1,12}|player:\d+|pick:\d{4}:r\d+:(?:any|early|mid|late))$/;
const PLAYER_PATH = /^\/player\/([^/]+)\/?$/;

export function isPlayerRouteId(value) {
  return ROUTE_ID.test(String(value || "").trim());
}

export function routeIdFromAsset(assetId) {
  const id = String(assetId || "").trim();
  if (/^player:\d+$/.test(id)) return id.slice("player:".length);
  if (isRankAssetId(id)) return id;
  return "";
}

export function routeIdFromPlayer(playerId) {
  const id = String(playerId || "").trim().replace(/^player:/, "");
  return isPlayerRouteId(id) ? id : "";
}

export function assetIdFromRoute(routeId) {
  const id = String(routeId || "").trim();
  if (!isPlayerRouteId(id)) return "";
  if (/^\d{1,12}$/.test(id)) return `player:${id}`;
  return isRankAssetId(id) ? id : "";
}

export function playerPathname(routeId) {
  const id = String(routeId || "").trim();
  if (!isPlayerRouteId(id)) return "";
  return `/player/${encodeURIComponent(id)}`;
}

export function playerIdFromPathname(pathname) {
  const path = String(pathname || "").split("?")[0];
  const match = path.match(PLAYER_PATH);
  if (!match) return "";
  let id = "";
  try {
    id = decodeURIComponent(match[1]);
  } catch {
    return "";
  }
  return isPlayerRouteId(id) ? id : "";
}

export function buildHistoryPlace({
  tab = "",
  view = "",
  playerId = "",
  overlay = "",
  selectedTradeId = "",
  selectedTradeManagerKey = "",
  scrollY = 0,
} = {}) {
  const routeId = isPlayerRouteId(playerId) ? String(playerId).trim() : "";
  return {
    tab: String(tab || ""),
    view: String(view || ""),
    playerId: routeId,
    overlay: String(overlay || ""),
    selectedTradeId: String(selectedTradeId || ""),
    selectedTradeManagerKey: String(selectedTradeManagerKey || ""),
    scrollY: Number(scrollY) || 0,
  };
}

export function historyPlaceKey(place = {}) {
  const row = buildHistoryPlace(place);
  return [
    row.tab,
    row.view,
    row.playerId,
    row.overlay,
    row.selectedTradeId,
    row.selectedTradeManagerKey,
  ].join("|");
}

export function sameHistoryPlace(left, right) {
  return historyPlaceKey(left) === historyPlaceKey(right);
}

// Re-rendering the same tab or the same open player must not push another entry.
export function decideHistoryWrite({ current, next, mode = "replace" } = {}) {
  if (mode === "silent") return "silent";
  if (mode === "push" && !sameHistoryPlace(current, next)) return "push";
  return "replace";
}

export function selectionFromLocation({
  pathname = "/",
  historyState = null,
  parsedAsset = "",
} = {}) {
  const routeId = playerIdFromPathname(pathname);
  const assetId = assetIdFromRoute(routeId);
  const overlay = String(historyState?.overlay || "");
  const tab = String(historyState?.tab || "");
  const view = String(historyState?.view || "");
  const sheet = Boolean(routeId) && (
    overlay === "help"
    || (overlay === "player" && tab === "league" && view === "team")
  );
  const rankAsset = assetId && !sheet
    ? assetId
    : (!routeId && isRankAssetId(parsedAsset) ? String(parsedAsset) : "");
  const sheetId = sheet ? routeId.replace(/^player:/, "") : "";
  return {
    rankAssetId: rankAsset,
    sheetPlayerId: isPlayerRouteId(sheetId) ? sheetId : "",
    helpOpen: overlay === "help",
    railOpen: overlay === "rail",
    publicRanks: overlay === "public-ranks",
    playerOpen: Boolean(routeId) && !sheet && overlay !== "rail",
  };
}
