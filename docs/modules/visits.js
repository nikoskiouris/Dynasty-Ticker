import { SITE_ORIGIN } from "./site.js";

export const SEARCHED_USER_PATH = "/api/searched-user";
export const VISIT_RETRY_LIMIT = 2;
export const VISIT_RETRY_DELAY_MS = 40;

function canonicalHost(hostname) {
  return String(hostname || "").trim().toLowerCase().replace(/^www\./, "");
}

export function visitSiteHost() {
  try {
    return canonicalHost(new URL(SITE_ORIGIN).hostname);
  } catch {
    return "dynastyticker.com";
  }
}

export function isLiveDeskHost(location = globalThis.location) {
  return canonicalHost(location?.hostname) === visitSiteHost();
}

function originFrom(location) {
  if (location?.origin) return String(location.origin).replace(/\/+$/, "");
  const host = location?.hostname;
  if (host) {
    const protocol = location.protocol
      || (host === "localhost" || host === "127.0.0.1" ? "http:" : "https:");
    return `${protocol}//${host}`;
  }
  return SITE_ORIGIN;
}

export function searchedUserUrl(location = globalThis.location) {
  return `${originFrom(location)}${SEARCHED_USER_PATH}`;
}

export function shouldTrackVisit({
  location = globalThis.location,
} = {}) {
  return isLiveDeskHost(location);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postDeskEvent(body, {
  fetchFn,
  location,
  retryDelayMs = VISIT_RETRY_DELAY_MS,
  url = searchedUserUrl(location),
} = {}) {
  const payload = JSON.stringify(body);
  for (let attempt = 0; attempt <= VISIT_RETRY_LIMIT; attempt += 1) {
    try {
      const ping = await fetchFn(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
        keepalive: true,
      });
      if (ping?.ok) return true;
      if (Number(ping?.status) !== 503) return false;
    } catch {
      if (attempt >= VISIT_RETRY_LIMIT) return false;
    }
    if (attempt < VISIT_RETRY_LIMIT) await delay(retryDelayMs * (attempt + 1));
  }
  return false;
}

// Only a league from the searched user's own results counts, and only once
// that league has loaded. A typo never loads a league. The saved name is the
// one Sleeper returned, so a misspelling cannot become its own person.
export function searchedUserPick({ sleeperUser, userLeagues, leagueId } = {}) {
  const username = String(sleeperUser?.username ?? "").trim();
  const id = String(leagueId ?? "").trim();
  if (!username || !id) return null;
  const listed = (Array.isArray(userLeagues) ? userLeagues : [])
    .some((league) => String(league?.league_id ?? "") === id);
  if (!listed) return null;
  return { username, userId: String(sleeperUser?.user_id ?? "").trim() };
}

export async function recordSearchedUser({
  username,
  userId = "",
  fetchFn = globalThis.fetch,
  location = globalThis.location,
  retryDelayMs,
} = {}) {
  if (typeof fetchFn !== "function") return false;
  if (!shouldTrackVisit({ location })) return false;
  const name = String(username ?? "").trim();
  if (!name) return false;
  return postDeskEvent({
    username: name,
    userId: String(userId ?? "").trim(),
  }, { fetchFn, location, retryDelayMs, url: searchedUserUrl(location) });
}
