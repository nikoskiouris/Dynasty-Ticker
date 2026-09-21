import {
  DEFAULT_PAGE,
  DEFAULT_ROOMS,
  PAGE_ALIASES,
  PAGE_IDS,
  PAGE_ROOMS,
  PLACE_ALIASES,
  SCOPED_ROOM_ALIASES,
} from "./constants.js";

const SLEEPER_LEAGUE_PATH = /leagues\/(\d+)/i;
const SLEEPER_USER_PATH = /sleeper\.app\/(?:u|user)\/([^/?#]+)/i;
const LONG_NUMERIC_ID = /\d{8,}/;

export function parseLeagueId(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";

  const leaguePathMatch = value.match(SLEEPER_LEAGUE_PATH);
  if (leaguePathMatch) return leaguePathMatch[1];

  if (/^\d+$/.test(value)) return value;

  const embeddedId = value.match(LONG_NUMERIC_ID);
  if (embeddedId) return embeddedId[1];

  return "";
}

export function normalizeUsername(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  const urlMatch = value.match(SLEEPER_USER_PATH);
  if (urlMatch) return decodeURIComponent(urlMatch[1]).replace(/^@/, "");
  return value.replace(/^@/, "").replace(/\s+/g, "");
}

export function classifyLeagueInput(raw) {
  const value = String(raw || "").trim();
  if (!value) return { kind: "empty", leagueId: "", username: "" };

  const leaguePathMatch = value.match(SLEEPER_LEAGUE_PATH);
  if (leaguePathMatch) {
    return { kind: "league", leagueId: leaguePathMatch[1], username: "" };
  }

  if (/^\d+$/.test(value)) {
    return { kind: "league", leagueId: value, username: "" };
  }

  const userUrl = normalizeUsername(value);
  if (SLEEPER_USER_PATH.test(value) && userUrl) {
    return { kind: "username", leagueId: "", username: userUrl };
  }

  const embeddedId = value.match(LONG_NUMERIC_ID);
  if (embeddedId && /sleeper\.app/i.test(value)) {
    return { kind: "league", leagueId: embeddedId[1], username: "" };
  }

  return { kind: "username", leagueId: "", username: normalizeUsername(value) };
}

export function uniqueSeasons(currentSeason, extra = 1) {
  const season = Number(currentSeason);
  const base = Number.isFinite(season) && season > 2000 ? season : new Date().getUTCFullYear();
  const seasons = [];
  for (let offset = 0; offset <= extra; offset += 1) {
    seasons.push(String(base - offset));
  }
  return seasons;
}

export function sortUserLeagues(leagues, currentSeason) {
  const current = String(currentSeason || "");
  return [...(leagues || [])].sort((a, b) => {
    const aCurrent = String(a?.season || "") === current ? 0 : 1;
    const bCurrent = String(b?.season || "") === current ? 0 : 1;
    if (aCurrent !== bCurrent) return aCurrent - bCurrent;
    const statusRank = (league) => {
      const status = String(league?.status || "");
      if (status === "in_season") return 0;
      if (status === "pre_draft" || status === "drafting") return 1;
      if (status === "complete") return 2;
      return 3;
    };
    if (statusRank(a) !== statusRank(b)) return statusRank(a) - statusRank(b);
    const rosterDelta = Number(b?.total_rosters || 0) - Number(a?.total_rosters || 0);
    if (rosterDelta) return rosterDelta;
    return String(a?.name || "").localeCompare(String(b?.name || ""));
  });
}

function cleanToken(value) {
  return String(value || "").trim().toLowerCase().replace(/^#/, "").replace(/^league-/, "");
}

export function isDeskPage(page) {
  return PAGE_IDS.includes(page);
}

export function defaultRoomFor(page) {
  return DEFAULT_ROOMS[page] || DEFAULT_ROOMS[DEFAULT_PAGE];
}

export function isRoomOf(page, room) {
  return Boolean(room) && (PAGE_ROOMS[page] || []).includes(room);
}

/**
 * Turn a tab token (from a URL, a hash, or old share links) into a page id.
 * Tokens that used to be tabs but are now rooms (e.g. `calculator`, `awards`)
 * resolve to the page that owns that room.
 */
export function normalizeDeskTab(tab) {
  const value = cleanToken(tab);
  if (!value) return "";
  if (PAGE_ALIASES[value]) return PAGE_ALIASES[value];
  if (PLACE_ALIASES[value]) return PLACE_ALIASES[value].page;
  return isDeskPage(value) ? value : "";
}

/**
 * Turn a room token into a room id for the given page. Returns "" when the
 * token does not belong to that page (callers may then try resolveDeskPlace).
 */
export function normalizeRoom(page, view) {
  const value = cleanToken(view);
  if (!value || !isDeskPage(page)) return "";
  const scoped = SCOPED_ROOM_ALIASES[page]?.[value];
  if (scoped && isRoomOf(page, scoped)) return scoped;
  if (isRoomOf(page, value)) return value;
  const place = PLACE_ALIASES[value];
  if (place && place.page === page && isRoomOf(page, place.room)) return place.room;
  return "";
}

/**
 * Resolve any combination of tab + view tokens to a concrete desk place.
 * Cross-page room tokens win over the tab (e.g. `tab=league&view=hall` opens
 * League History because the old History page now lives there), so every historical link lands
 * on the content it used to point at.
 */
export function resolveDeskPlace({ tab = "", view = "" } = {}) {
  const page = normalizeDeskTab(tab);
  const viewToken = cleanToken(view);
  const tabToken = cleanToken(tab);

  if (page && viewToken) {
    const room = normalizeRoom(page, viewToken);
    if (room) return { page, room };
    const place = PLACE_ALIASES[viewToken];
    if (place) return { page: place.page, room: place.room };
    return { page, room: defaultRoomFor(page) };
  }
  if (page) {
    // The tab token itself may name a room (old `tab=recap` links).
    const roomFromTab = normalizeRoom(page, tabToken);
    return { page, room: roomFromTab || defaultRoomFor(page) };
  }
  if (viewToken) {
    const place = PLACE_ALIASES[viewToken];
    if (place) return { page: place.page, room: place.room };
    const leagueRoom = normalizeRoom(DEFAULT_PAGE, viewToken);
    return { page: DEFAULT_PAGE, room: leagueRoom || defaultRoomFor(DEFAULT_PAGE) };
  }
  return { page: DEFAULT_PAGE, room: defaultRoomFor(DEFAULT_PAGE) };
}

export function buildShareParams({
  leagueId,
  meRosterId = null,
  tab = "",
  view = "",
  week = null,
  tone = "",
} = {}) {
  const params = new URLSearchParams();
  if (leagueId) params.set("league", String(leagueId));
  if (meRosterId) params.set("me", String(meRosterId));
  const place = resolveDeskPlace({ tab, view });
  if (place.page !== DEFAULT_PAGE) params.set("tab", place.page);
  if (place.room !== defaultRoomFor(place.page)) params.set("view", place.room);
  if (Number.isFinite(Number(week)) && Number(week) > 0) params.set("week", String(week));
  if (tone && tone !== "desk") params.set("tone", String(tone));
  return params;
}

export function parseShareParams(search) {
  const params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  const league = String(params.get("league") || "").trim();
  const me = Number(params.get("me"));
  const rawTab = params.get("tab") || "";
  const rawView = params.get("view") || "";
  const week = Number(params.get("week"));
  const tone = String(params.get("tone") || "").trim();
  const hasPlace = Boolean(cleanToken(rawTab) || cleanToken(rawView));
  const place = resolveDeskPlace({ tab: rawTab, view: rawView });
  return {
    leagueId: parseLeagueId(league) || league,
    meRosterId: Number.isFinite(me) && me > 0 ? me : null,
    // `tab` stays "" when the URL did not ask for a place, so boot can fall
    // back to the hash or the default without treating it as a request.
    tab: hasPlace ? place.page : "",
    view: place.room,
    week: Number.isFinite(week) && week > 0 ? week : null,
    tone: tone || "",
  };
}

export function bootSearchFieldValues({ leagueFromUrl = "" } = {}) {
  return {
    username: "",
    leagueId: String(leagueFromUrl || "").trim(),
  };
}

export function buildShareUrl({ origin, pathname, ...rest }) {
  const params = buildShareParams(rest);
  const path = pathname || "/";
  const query = params.toString();
  return `${origin || ""}${path}${query ? `?${query}` : ""}`;
}
