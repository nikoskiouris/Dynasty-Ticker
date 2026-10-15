import { DEFAULT_PAGE, DEFAULT_ROOMS } from "./constants.js";
import { isRankAssetId } from "./ranks.js";

// Every pathname is built from this prefix. Empty means the site root.
export const BASE = "";

// Boot home. A reserved path with no desk section opens this view.
export const HOME_PLACE = Object.freeze({
  page: DEFAULT_PAGE,
  room: DEFAULT_ROOMS[DEFAULT_PAGE],
});

// One line per top-level section. page null → no desk section yet → home.
export const ROUTES = Object.freeze([
  { path: "trade", page: "trades", room: "calculator" },
  { path: "team", page: "league", room: "team" },
  { path: "history", page: "league", room: "history" },
  { path: "plan", page: null, room: null },
]);

// Sleeper player ids are digits. Picks keep their asset id. Nothing else is a route.
const ROUTE_ID = /^(?:\d{1,12}|player:\d+|pick:\d{4}:r\d+:(?:any|early|mid|late))$/;
const PLAYER_SEGMENT = "player";

export function urlPath(...segments) {
  const base = String(BASE).replace(/\/+$/g, "");
  const tail = segments
    .flat()
    .map((part) => String(part ?? "").replace(/^\/+|\/+$/g, ""))
    .filter(Boolean);
  return tail.length ? `${base}/${tail.join("/")}` : `${base}/`;
}

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
  return urlPath(PLAYER_SEGMENT, encodeURIComponent(id));
}

export function matchRoute(pathname) {
  const raw = String(pathname || "").split("?")[0];
  const base = String(BASE).replace(/\/+$/g, "");
  let path = raw;
  if (base) {
    if (path !== base && !path.startsWith(`${base}/`)) return null;
    path = path.slice(base.length) || "/";
  }
  const bits = path.split("/").filter(Boolean);
  if (bits[0] === PLAYER_SEGMENT && bits.length === 2) {
    let id = "";
    try {
      id = decodeURIComponent(bits[1]);
    } catch {
      return null;
    }
    if (!isPlayerRouteId(id)) return null;
    return { path: PLAYER_SEGMENT, page: "players", room: "ranks", playerId: id, home: false };
  }
  if (bits.length !== 1) return null;
  const row = ROUTES.find((route) => route.path === bits[0]);
  if (!row) return null;
  if (!row.page) {
    return { path: row.path, page: HOME_PLACE.page, room: HOME_PLACE.room, playerId: "", home: true };
  }
  return { path: row.path, page: row.page, room: row.room, playerId: "", home: false };
}

export function pathForPlace({ page = "", room = "", playerId = "" } = {}) {
  const id = isPlayerRouteId(playerId) ? String(playerId).trim() : "";
  if (id) return urlPath(PLAYER_SEGMENT, encodeURIComponent(id));
  const row = ROUTES.find((route) => route.page === page && route.room === room);
  if (row) return urlPath(row.path);
  return urlPath();
}

export function playerIdFromPathname(pathname) {
  return matchRoute(pathname)?.playerId || "";
}

export function isSpaPath(pathname) {
  return Boolean(matchRoute(pathname));
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
