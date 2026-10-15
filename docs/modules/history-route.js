import { DEFAULT_PAGE, DEFAULT_ROOMS } from "./constants.js";
import { isRankAssetId } from "./ranks.js";

// Every pathname is built from this prefix. Empty means the site root.
export const BASE = "";

// Boot home. Unknown paths and `/` open this view.
export const HOME_PLACE = Object.freeze({
  page: DEFAULT_PAGE,
  room: DEFAULT_ROOMS[DEFAULT_PAGE],
});

// One line per route. Add a future section by appending a line.
// :slug? is cosmetic. Closest current desk place is page + room.
export const ROUTES = Object.freeze([
  { name: "home", pattern: "/", page: "players", room: "ranks" },
  { name: "players", pattern: "/players", page: "players", room: "ranks" },
  { name: "trade", pattern: "/trade", page: "trades", room: "calculator" },
  { name: "connect", pattern: "/connect", page: "players", room: "ranks" },
  { name: "league", pattern: "/l/:leagueId", page: "league", room: "team" },
  { name: "team", pattern: "/l/:leagueId/team", page: "league", room: "team" },
  { name: "ideas", pattern: "/l/:leagueId/ideas", page: "trades", room: "find" },
  { name: "leagueBoard", pattern: "/l/:leagueId/league", page: "league", room: "board" },
  { name: "player", pattern: "/player/:sleeperId/:slug?", page: "players", room: "ranks" },
]);

const ROUTE_ID = /^(?:\d{1,12}|player:\d+|pick:\d{4}:r\d+:(?:any|early|mid|late))$/;
// "0" is not a Sleeper player. Faces already skip it.
const SLEEPER_ID = /^(?!0$)\d{1,12}$/;
const LEAGUE_ID = /^\d{1,20}$/;
const ASSET_ID = /^(?:player:\d{1,12}|pick:\d{4}:r\d+:(?:any|early|mid|late))$/;

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

export function playerSlug(name) {
  return String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function sleeperIdFrom(value) {
  const id = String(value || "").trim().replace(/^player:/, "");
  return SLEEPER_ID.test(id) ? id : "";
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
  if (SLEEPER_ID.test(id)) return `player:${id}`;
  return isRankAssetId(id) ? id : "";
}

export function parseAssetList(raw) {
  return String(raw || "")
    .split(",")
    .map((part) => part.trim())
    .filter((id) => ASSET_ID.test(id))
    .slice(0, 12);
}

export function tradeHref(give = [], get = [], leagueId = "") {
  const params = new URLSearchParams();
  const giveIds = parseAssetList(Array.isArray(give) ? give.join(",") : give);
  const getIds = parseAssetList(Array.isArray(get) ? get.join(",") : get);
  if (giveIds.length) params.set("give", giveIds.join(","));
  if (getIds.length) params.set("get", getIds.join(","));
  if (LEAGUE_ID.test(String(leagueId || ""))) params.set("league", String(leagueId));
  const query = params.toString();
  return `${urlPath("trade")}${query ? `?${query}` : ""}`;
}

export function playerPathname(routeId, name = "") {
  const id = sleeperIdFrom(routeId);
  if (!id) return "";
  const slug = playerSlug(name);
  return slug ? urlPath("player", id, slug) : urlPath("player", id);
}

function pathBits(pathname) {
  const raw = String(pathname || "").split("?")[0];
  const base = String(BASE).replace(/\/+$/g, "");
  let path = raw || "/";
  if (base) {
    if (path !== base && !path.startsWith(`${base}/`)) return null;
    path = path.slice(base.length) || "/";
  }
  return path.split("/").filter(Boolean);
}

function decodePart(value) {
  try {
    return decodeURIComponent(String(value || ""));
  } catch {
    return "";
  }
}

function patternScore(pattern) {
  const parts = String(pattern || "").split("/").filter(Boolean);
  const fixed = parts.filter((part) => !part.startsWith(":")).length;
  return fixed * 10 + parts.length;
}

function matchPattern(bits, pattern) {
  const parts = String(pattern || "").split("/").filter(Boolean);
  const params = {};
  let index = 0;
  for (const token of parts) {
    const optional = token.endsWith("?");
    const name = token.replace(/^\??:/, "").replace(/\?$/, "");
    if (token.startsWith(":")) {
      if (index >= bits.length) {
        if (optional) return params;
        return null;
      }
      params[name] = bits[index];
      index += 1;
      continue;
    }
    if (bits[index] !== token) return null;
    index += 1;
  }
  if (index !== bits.length) return null;
  return params;
}

function blankRoute(extra = {}) {
  return {
    name: "home",
    page: HOME_PLACE.page,
    room: HOME_PLACE.room,
    leagueId: "",
    playerId: "",
    slug: "",
    give: [],
    get: [],
    next: "",
    unknown: false,
    legacy: "",
    ...extra,
  };
}

const ORDERED_ROUTES = Object.freeze(
  [...ROUTES].sort((left, right) => patternScore(right.pattern) - patternScore(left.pattern)),
);

export function matchRoute(pathname, search = "") {
  const bits = pathBits(pathname);
  if (!bits) return null;
  const params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  for (const row of ORDERED_ROUTES) {
    const found = matchPattern(bits, row.pattern);
    if (!found) continue;
    const leagueId = found.leagueId ? decodePart(found.leagueId) : "";
    const playerId = found.sleeperId ? decodePart(found.sleeperId) : "";
    const slug = found.slug ? decodePart(found.slug) : "";
    if (found.leagueId && !LEAGUE_ID.test(leagueId)) return null;
    if (found.sleeperId && !SLEEPER_ID.test(playerId)) return null;
    return blankRoute({
      name: row.name,
      page: row.page,
      room: row.room,
      leagueId,
      playerId,
      slug,
      give: row.name === "trade" ? parseAssetList(params.get("give")) : [],
      get: row.name === "trade" ? parseAssetList(params.get("get")) : [],
      next: row.name === "connect" ? safeNext(params.get("next")) : "",
    });
  }
  return null;
}

// Same-site path only. Rejects connect loops and off-site targets.
export function safeNext(value) {
  const raw = String(value || "").trim();
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "";
  let url;
  try {
    url = new URL(raw, "http://desk.local");
  } catch {
    return "";
  }
  if (url.origin !== "http://desk.local") return "";
  const hit = matchRoute(url.pathname, url.search);
  if (!hit || hit.name === "home" || hit.name === "connect") return "";
  if (hit.name === "player") return playerPathname(hit.playerId, hit.slug);
  if (hit.name === "trade") return tradeHref(hit.give, hit.get);
  if (hit.name === "players") return urlPath("players");
  if (hit.name === "ideas") return urlPath("l", hit.leagueId, "ideas");
  if (hit.name === "leagueBoard") return urlPath("l", hit.leagueId, "league");
  if (hit.leagueId) return urlPath("l", hit.leagueId, "team");
  return "";
}

// Legacy `?ranks=1` opens /players. Anything else unknown opens home.
export function resolveLocation(pathname = "/", search = "") {
  const [pathOnly, inline = ""] = String(pathname || "/").split("?");
  const params = new URLSearchParams(String(search || inline).replace(/^\?/, ""));
  if (params.get("ranks") === "1") {
    return blankRoute({ name: "players", legacy: "ranks" });
  }
  const hit = matchRoute(pathOnly, search || inline) || blankRoute({ unknown: true });
  // Old player links were `?asset=<id>` on the page you were already on.
  const assetId = sleeperIdFrom(params.get("asset") || "");
  if (assetId && (hit.name === "home" || hit.name === "players" || hit.unknown)) {
    return blankRoute({ name: "player", playerId: assetId, legacy: "asset" });
  }
  return hit;
}

// Keep a connected league on routes that do not already name it.
// Home (`/`) stays bare so a cold home visit does not reopen a league.
function rememberLeague(path, leagueId) {
  const id = String(leagueId || "");
  if (!path || path === urlPath() || !LEAGUE_ID.test(id)) return path;
  const leagueRoot = urlPath("l", id);
  if (path === leagueRoot || path.startsWith(`${leagueRoot}/`) || path.startsWith(`${leagueRoot}?`)) return path;
  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  if (params.get("league") === id) return path;
  params.set("league", id);
  const next = params.toString();
  return next ? `${pathname}?${next}` : pathname;
}

export function pathForPlace({
  page = "",
  room = "",
  playerId = "",
  playerName = "",
  leagueId = "",
  give = [],
  get = [],
  landing = false,
} = {}) {
  const sleeperId = sleeperIdFrom(playerId);
  let href = "";
  if (sleeperId) href = playerPathname(sleeperId, playerName);
  else if (page === "trades" && room === "calculator") href = tradeHref(give, get, leagueId);
  else if (page === "trades" && room === "find" && LEAGUE_ID.test(String(leagueId || ""))) {
    href = urlPath("l", leagueId, "ideas");
  } else if (page === "league" && room === "board" && LEAGUE_ID.test(String(leagueId || ""))) {
    href = urlPath("l", leagueId, "league");
  } else if (page === "league" && room === "team" && LEAGUE_ID.test(String(leagueId || ""))) {
    href = urlPath("l", leagueId, "team");
  } else if (page === "players" && room === "ranks" && !landing) href = urlPath("players");
  else if (page === "players" && room === "ranks" && landing) href = urlPath();
  return rememberLeague(href, leagueId);
}

// The phone menu sits on top of a player card. Back closes that layer only.
export function topOverlay({
  rail = false,
  help = false,
  player = false,
  trade = false,
  publicRanks = false,
} = {}) {
  if (rail) return "rail";
  if (help) return "help";
  if (player) return "player";
  if (trade) return "trade";
  if (publicRanks) return "public-ranks";
  return "";
}

export function playerIdFromPathname(pathname) {
  const hit = matchRoute(pathname);
  return hit?.name === "player" ? hit.playerId : "";
}

// Documented Netlify rewrites: a fixed path or one :placeholder per segment.
// A placeholder matches any single segment, including "x.js". The route
// table still rejects a non-numeric player id and a league id that contains
// a dot, and the desk replaceState's those to BASE. Trailing-slash forms
// are their own rules so /players/ is not left to the 404 catch-all.
export const SPA_REWRITES = Object.freeze([
  "/player/:id",
  "/player/:id/:slug",
  "/l/:id",
  "/l/:id/:view",
  "/players",
  "/trade",
  "/connect",
  "/players/",
  "/trade/",
  "/connect/",
  "/l/:id/",
  "/l/:id/:view/",
  "/player/:id/",
  "/player/:id/:slug/",
]);

function rewriteParts(pattern) {
  const raw = String(pattern || "");
  return {
    slash: raw.length > 1 && raw.endsWith("/"),
    bits: raw.split("/").filter(Boolean),
  };
}

export function isSpaPath(pathname) {
  const raw = String(pathname || "").split("?")[0];
  if (!raw.startsWith("/")) return false;
  const path = rewriteParts(raw);
  return SPA_REWRITES.some((pattern) => {
    const rule = rewriteParts(pattern);
    if (rule.slash !== path.slash || rule.bits.length !== path.bits.length) return false;
    return rule.bits.every((part, index) => part.startsWith(":") || part === path.bits[index]);
  });
}

// Choosing a section replaces the open menu entry so Back does not reopen it.
export function historyModeAfterMenuChoice({ overlay = "", pushed = false } = {}) {
  return overlay === "rail" && pushed ? "replace" : "push";
}

// Cold deep links have no pushed entry, so the header arrow goes home.
export function backTarget({ pushed = false } = {}) {
  return pushed ? "history" : "home";
}

export function buildHistoryPlace({
  tab = "",
  view = "",
  playerId = "",
  overlay = "",
  selectedTradeId = "",
  selectedTradeManagerKey = "",
  scrollY = 0,
  landing = false,
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
    landing: Boolean(landing),
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
    row.landing ? "1" : "",
  ].join("|");
}

export function sameHistoryPlace(left, right) {
  return historyPlaceKey(left) === historyPlaceKey(right);
}

// Screen changes and overlay opens push. Filters and give/get edits replace.
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
  const fromPath = playerIdFromPathname(pathname);
  const fromState = isPlayerRouteId(historyState?.playerId)
    ? String(historyState.playerId).trim().replace(/^player:/, "")
    : "";
  const routeId = fromPath || fromState;
  const assetId = assetIdFromRoute(routeId);
  const overlay = String(historyState?.overlay || "");
  const tab = String(historyState?.tab || "");
  const view = String(historyState?.view || "");
  const sheet = Boolean(routeId) && (
    overlay === "help"
    || (!fromPath && overlay === "player" && tab === "league" && view === "team")
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
    playerOpen: Boolean(fromPath) && !sheet && overlay !== "rail",
  };
}
