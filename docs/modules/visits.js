import { SITE_ORIGIN } from "./site.js";

export const VISIT_TRACK_PATH = "/api/visit";
export const VISIT_COUNT_PATH = "/api/views";
export const SEARCHED_USER_PATH = "/api/searched-user";
export const VISITOR_STORAGE_KEY = "dynasty_ticker_visitor";
export const VISIT_RETRY_LIMIT = 2;
export const VISIT_RETRY_DELAY_MS = 40;
export const TRAFFIC_LINES = [
  ["today", "views"],
  ["today", "people"],
  ["week", "views"],
  ["week", "people"],
  ["year", "views"],
  ["year", "people"],
  ["all", "views"],
  ["all", "people"],
];

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

export function isSecretNumbersPath(location = globalThis.location) {
  return /\/secret-numbers\/?$/.test(String(location?.pathname || ""));
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

export function visitTrackUrl(location = globalThis.location) {
  return `${originFrom(location)}${VISIT_TRACK_PATH}`;
}

export function visitCountUrl(location = globalThis.location) {
  return `${originFrom(location)}${VISIT_COUNT_PATH}`;
}

export function searchedUserUrl(location = globalThis.location) {
  return `${originFrom(location)}${SEARCHED_USER_PATH}`;
}

export function shouldTrackVisit({
  location = globalThis.location,
} = {}) {
  return isLiveDeskHost(location) && !isSecretNumbersPath(location);
}

function asCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.floor(number);
}

export function parseTrafficCounts(payload) {
  return TRAFFIC_LINES.map(([period, metric]) => asCount(payload?.[period]?.[metric]));
}

export function createEventId() {
  try {
    if (typeof globalThis.crypto?.randomUUID === "function") {
      const value = globalThis.crypto.randomUUID();
      if (value) return String(value);
    }
  } catch {
    // Fall through to a collision-resistant fallback.
  }
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function readOrCreateVisitorId(storage = globalThis.localStorage) {
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") return "";
  try {
    const existing = String(storage.getItem(VISITOR_STORAGE_KEY) || "");
    if (/^[a-f0-9]{32}$/.test(existing)) return existing;
    const bytes = new Uint8Array(16);
    if (typeof globalThis.crypto?.getRandomValues === "function") globalThis.crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    const next = [...bytes].map((part) => part.toString(16).padStart(2, "0")).join("");
    storage.setItem(VISITOR_STORAGE_KEY, next);
    return next;
  } catch {
    return "";
  }
}

export function sourceHost(referrer, siteHost = visitSiteHost()) {
  const raw = String(referrer || "").trim();
  if (!raw) return "direct";
  try {
    const host = canonicalHost(new URL(raw).hostname);
    if (!host || host === siteHost || host.endsWith(".netlify.app")) return "direct";
    if (!/^[a-z0-9.-]+$/.test(host)) return "direct";
    return host;
  } catch {
    return "direct";
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postDeskEvent(body, {
  fetchFn,
  location,
  retryDelayMs = VISIT_RETRY_DELAY_MS,
  url = visitTrackUrl(location),
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

export async function recordDeskVisit({
  fetchFn = globalThis.fetch,
  location = globalThis.location,
  storage = globalThis.localStorage,
  referrer = globalThis.document?.referrer,
  retryDelayMs,
} = {}) {
  if (typeof fetchFn !== "function") return false;
  if (!shouldTrackVisit({ location })) return false;
  return postDeskEvent({
    eventId: createEventId(),
    visitorId: readOrCreateVisitorId(storage),
    kind: "open",
    source: sourceHost(referrer),
  }, { fetchFn, location, retryDelayMs });
}

export async function recordDeskUse({
  fetchFn = globalThis.fetch,
  location = globalThis.location,
  storage = globalThis.localStorage,
  retryDelayMs,
} = {}) {
  if (typeof fetchFn !== "function") return false;
  if (!shouldTrackVisit({ location })) return false;
  return postDeskEvent({
    eventId: createEventId(),
    visitorId: readOrCreateVisitorId(storage),
    kind: "active",
  }, { fetchFn, location, retryDelayMs });
}

// Only a league from the searched user's own results counts, so a typo that
// never reaches a league pick is never saved.
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

function raceTimeout(promise, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function loadSecretNumbers({
  fetchFn = globalThis.fetch,
  location = globalThis.location,
  timeoutMs = 5000,
} = {}) {
  if (typeof fetchFn !== "function") return null;
  try {
    const response = await raceTimeout(fetchFn(visitCountUrl(location)), Math.max(0, Number(timeoutMs) || 0));
    if (!response?.ok) return null;
    const payload = await response.json();
    return payload && typeof payload === "object" ? payload : null;
  } catch {
    return null;
  }
}

export function renderSecretNumbers(numbers) {
  const list = Array.isArray(numbers) ? numbers : [];
  return TRAFFIC_LINES.map((_, index) => String(asCount(list[index]))).join("\n");
}

function bucketOf(payload, period) {
  const bucket = payload?.[period];
  return bucket && typeof bucket === "object" ? bucket : {};
}

function padCount(value) {
  return String(asCount(value)).padEnd(6, " ");
}

export function renderTrafficReport(payload) {
  const data = payload && typeof payload === "object" ? payload : {};
  const lines = ["US Eastern. Week is Monday-Sunday.", ""];
  for (const period of ["today", "week", "year", "all"]) {
    const bucket = bucketOf(data, period);
    lines.push(`${period.padEnd(5, " ")} views ${padCount(bucket.views)} people ${padCount(bucket.people)} active ${asCount(bucket.active)}`);
  }
  const days = Array.isArray(data.days) ? data.days : [];
  lines.push("", "days");
  if (!days.length) lines.push("none");
  for (const row of days) {
    if (!row || typeof row !== "object") continue;
    lines.push(`${row.day || "unknown"}  views ${padCount(row.views)} people ${padCount(row.people)} active ${asCount(row.active)}`);
  }
  for (const period of ["today", "week"]) {
    const bucket = bucketOf(data, period);
    const sources = bucket.sources && typeof bucket.sources === "object" && !Array.isArray(bucket.sources)
      ? bucket.sources
      : {};
    const landings = bucket.landings && typeof bucket.landings === "object" ? bucket.landings : {};
    const hosts = Object.keys(sources).sort((a, b) => asCount(sources[b]) - asCount(sources[a]) || a.localeCompare(b));
    lines.push("", `${period} sources`);
    if (!hosts.length) lines.push("direct 0");
    for (const host of hosts) lines.push(`${host} ${asCount(sources[host])}`);
    lines.push(`${period} landings`);
    for (const key of ["home", "shared", "legal"]) lines.push(`${key} ${asCount(landings[key])}`);
  }
  return lines.join("\n");
}
