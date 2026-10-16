// First-party, cookieless site analytics (launch item 5).
//
// /api/collect takes one small JSON beacon per event from docs/modules/analytics.js
// and adds it to a per-day counter document in Netlify Blobs. Nothing is stored
// per person except, when ANALYTICS_SALT is set, a truncated daily hash of
// salt + day + ip + user agent used only to count uniques for that day. The day
// is part of the hash, so the same person is a different hash tomorrow.
// ANALYTICS_SALT unset (or a rejected public value) means no uniques; counts
// still work. /api/analytics-stats reads the counters behind ANALYTICS_READ_TOKEN.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { ANALYTICS_EVENTS, cleanProps, placeholderRoute } from "../../docs/modules/analytics.js";
import {
  DEFAULT_ORIGINS,
  acceptSalt,
  clientIp,
  isAllowedWrite,
  isBot,
  readJsonObject,
  recentDayKeys,
  visitPeriodKeys,
} from "./traffic.js";

export const COLLECT_STORE = "site-analytics";
export const COLLECT_BODY_MAX = 800;
export const COLLECT_MAX_WRITE_RETRIES = 8;
export const RATE_LIMIT_MAX = 120;
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
export const RATE_LIMIT_TRACKED = 5000;
export const UNIQUES_MAX_PER_DAY = 50000;
export const MAX_REF_HOSTS = 60;
export const MAX_UTM_SOURCES = 40;
export const STATS_MAX_DAYS = 90;
export const READ_TOKEN_MIN_LENGTH = 24;

// "visit" is the pageview. The rest are the #167 events, same names and props.
export const COLLECT_EVENTS = Object.freeze(["visit", ...Object.keys(ANALYTICS_EVENTS)]);
export const PAGE_TEMPLATES = Object.freeze([
  "/", "/players", "/trade", "/connect",
  "/l/:id", "/l/:id/team", "/l/:id/ideas", "/l/:id/league", "/l/:id/week", "/l/:id/activity", "/l/:id/history",
  "/player/:id", "/t/:code", "/other",
]);
export const CHANNELS = Object.freeze(["direct", "social", "search", "other"]);

// Host suffixes. A referrer host matches when it equals one or ends in ".<suffix>".
const SOCIAL_HOSTS = Object.freeze([
  "x.com", "t.co", "twitter.com", "reddit.com", "redd.it", "facebook.com", "fb.com", "m.me", "messenger.com",
  "instagram.com", "threads.net", "threads.com", "bsky.app", "discord.com", "discordapp.com", "discord.gg",
  "linkedin.com", "lnkd.in", "tiktok.com", "youtube.com", "youtu.be", "snapchat.com", "pinterest.com",
  "tumblr.com", "mastodon.social", "telegram.org", "t.me", "whatsapp.com", "wa.me", "slack.com", "groupme.com",
  "sleeper.com", "sleeper.app",
]);
const SEARCH_HOSTS = Object.freeze([
  "google.com", "bing.com", "duckduckgo.com", "search.yahoo.com", "yahoo.com", "ecosia.org", "brave.com",
  "search.brave.com", "startpage.com", "kagi.com", "yandex.com", "baidu.com", "perplexity.ai", "chatgpt.com",
]);
const OWN_HOSTS = Object.freeze(["dynastyticker.com"]);
const UTM_VALUE = /^[a-z0-9][a-z0-9._-]{0,39}$/;
const HOST_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?)+$/;

function hostMatches(host, list) {
  return list.some((entry) => host === entry || host.endsWith(`.${entry}`));
}

// google.co.uk, google.de, ... count as search too.
function isSearchHost(host) {
  return hostMatches(host, SEARCH_HOSTS) || /(^|\.)google\.[a-z.]{2,6}$/.test(host);
}

export function cleanRefHost(value) {
  const host = String(value || "").trim().toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  if (!host || host.length > 120 || !HOST_RE.test(host)) return "";
  if (hostMatches(host, OWN_HOSTS) || host.endsWith(".netlify.app") || host === "localhost") return "";
  return host;
}

export function classifyReferrer(value) {
  const host = cleanRefHost(value);
  if (!host) return { channel: "direct", host: "" };
  if (hostMatches(host, SOCIAL_HOSTS)) return { channel: "social", host };
  if (isSearchHost(host)) return { channel: "search", host };
  return { channel: "other", host };
}

export function cleanUtmSource(value) {
  const raw = String(value || "").trim().toLowerCase();
  return UTM_VALUE.test(raw) ? raw : "";
}

export function cleanPagePath(value) {
  const raw = String(value || "");
  if (!raw.startsWith("/") || raw.length > 200) return "/other";
  const template = PAGE_TEMPLATES.includes(raw) ? raw : placeholderRoute(raw);
  return PAGE_TEMPLATES.includes(template) ? template : "/other";
}

// Validates a beacon body. Returns null for anything not on the allowlist.
export function validateBeacon(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const event = String(body.e || "");
  if (!COLLECT_EVENTS.includes(event)) return null;
  const page = cleanPagePath(body.p);
  if (event === "visit") {
    const { channel, host } = classifyReferrer(body.r);
    return { event, page, props: {}, channel, host, utm: cleanUtmSource(body.u) };
  }
  const rawProps = body.props && typeof body.props === "object" && !Array.isArray(body.props) ? body.props : {};
  for (const key of Object.keys(rawProps)) {
    if (!(key in ANALYTICS_EVENTS[event])) return null;
  }
  const props = cleanProps(event, rawProps);
  if (!props) return null;
  return { event, page, props, channel: "", host: "", utm: "" };
}

export function privacyHeadersOn(req) {
  const dnt = String(req?.headers?.get?.("dnt") || "").trim();
  const gpc = String(req?.headers?.get?.("sec-gpc") || "").trim();
  return dnt === "1" || gpc === "1";
}

// Daily unique hash. Empty when the salt is unset or a rejected public value.
export function dailyUniqueHash({ salt, day, ip, userAgent }) {
  const secret = acceptSalt(salt);
  const host = String(ip || "").trim();
  if (!secret || !host || !day) return "";
  return createHash("sha256")
    .update(`${secret}\nanalytics-unique\n${day}\n${host}\n${String(userAgent || "").trim()}`)
    .digest("hex")
    .slice(0, 16);
}

// Per-instance, in-memory limiter. The IP is hashed with a key that lives only
// in this process and is never stored, so the limiter works without a salt.
export function createRateLimiter({ max = RATE_LIMIT_MAX, windowMs = RATE_LIMIT_WINDOW_MS, tracked = RATE_LIMIT_TRACKED } = {}) {
  const key = randomBytes(16).toString("hex");
  const buckets = new Map();
  return function allow(ip, nowMs = Date.now()) {
    const id = createHash("sha256").update(`${key}\n${String(ip || "").trim() || "unknown"}`).digest("hex").slice(0, 24);
    let bucket = buckets.get(id);
    if (!bucket || nowMs - bucket.start >= windowMs) bucket = { start: nowMs, count: 0 };
    bucket.count += 1;
    buckets.delete(id);
    buckets.set(id, bucket);
    while (buckets.size > tracked) buckets.delete(buckets.keys().next().value);
    return bucket.count <= max;
  };
}

export function dayKey(day) {
  return `day/${day}`;
}

export function emptyDay(day) {
  return { v: 1, day, events: {}, pages: {}, channels: {}, refs: {}, utm: {}, uniques: 0, uniquesCapped: false, seen: {} };
}

function countMap(value) {
  const out = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  for (const [key, count] of Object.entries(value)) {
    const n = Math.floor(Number(count));
    if (Number.isFinite(n) && n > 0) out[key] = n;
  }
  return out;
}

export function normalizeDay(raw, day) {
  const base = emptyDay(day);
  if (!raw || typeof raw !== "object") return base;
  return {
    ...base,
    events: countMap(raw.events),
    pages: countMap(raw.pages),
    channels: countMap(raw.channels),
    refs: countMap(raw.refs),
    utm: countMap(raw.utm),
    uniques: Math.max(0, Math.floor(Number(raw.uniques) || 0)),
    uniquesCapped: raw.uniquesCapped === true,
    seen: raw.seen && typeof raw.seen === "object" && !Array.isArray(raw.seen) ? { ...raw.seen } : {},
  };
}

function bump(map, key, cap = Infinity) {
  if (!key) return;
  if (!(key in map) && Object.keys(map).length >= cap) {
    map["(other)"] = (map["(other)"] || 0) + 1;
    return;
  }
  map[key] = (map[key] || 0) + 1;
}

export function applyBeacon(dayDoc, beacon, uniqueHash = "") {
  const next = normalizeDay(dayDoc, dayDoc?.day);
  bump(next.events, beacon.event);
  for (const [key, value] of Object.entries(beacon.props || {})) bump(next.events, `${beacon.event}.${key}=${value}`);
  if (beacon.event === "visit") {
    bump(next.pages, beacon.page);
    bump(next.channels, beacon.channel || "direct");
    if (beacon.host) bump(next.refs, beacon.host, MAX_REF_HOSTS);
    if (beacon.utm) bump(next.utm, beacon.utm, MAX_UTM_SOURCES);
    if (uniqueHash && !next.seen[uniqueHash]) {
      if (Object.keys(next.seen).length < UNIQUES_MAX_PER_DAY) {
        next.seen[uniqueHash] = 1;
        next.uniques += 1;
      } else {
        next.uniquesCapped = true;
      }
    }
  }
  return next;
}

export function publicDay(dayDoc) {
  const { seen: _seen, ...rest } = normalizeDay(dayDoc, dayDoc?.day);
  return rest;
}

function jsonResponse(body, { status = 200 } = {}) {
  return new Response(body == null ? null : JSON.stringify(body), {
    status,
    headers: body == null
      ? { "cache-control": "no-store" }
      : { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function readDay(store, key, day) {
  const snapshot = await store.getWithMetadata(key, { type: "json", consistency: "strong" });
  if (!snapshot) return { doc: emptyDay(day), etag: "", exists: false };
  return { doc: normalizeDay(snapshot.data, day), etag: typeof snapshot.etag === "string" ? snapshot.etag : "", exists: true };
}

async function writeDay(store, key, doc, snapshot) {
  if (snapshot.exists && !snapshot.etag) throw new Error("missing etag");
  const result = await store.setJSON(key, doc, snapshot.exists ? { onlyIfMatch: snapshot.etag } : { onlyIfNew: true });
  return result?.modified === true;
}

export function createCollectHandler({
  getStore,
  nowFn = () => new Date(),
  salt = process.env.ANALYTICS_SALT,
  allowedOrigins = DEFAULT_ORIGINS,
  rateLimit = createRateLimiter(),
} = {}) {
  return async function collectHandler(req, context = {}) {
    if (req.method !== "POST") return jsonResponse({ error: "method" }, { status: 405 });
    if (!isAllowedWrite(req, allowedOrigins)) return jsonResponse({ error: "forbidden" }, { status: 403 });
    // DNT / GPC: drop before reading anything else. The client also opts out.
    if (privacyHeadersOn(req)) return jsonResponse(null, { status: 204 });
    const userAgent = req.headers.get("user-agent") || "";
    if (!userAgent || isBot(userAgent)) return jsonResponse(null, { status: 204 });
    const ip = clientIp(req, context);
    const now = nowFn();
    if (!rateLimit(ip, now.getTime())) return jsonResponse({ error: "limit" }, { status: 429 });
    const parsed = await readJsonObject(req, { maxBytes: COLLECT_BODY_MAX });
    if (!parsed.ok) return jsonResponse({ error: parsed.error }, { status: parsed.error === "size" ? 413 : 400 });
    const beacon = validateBeacon(parsed.value);
    if (!beacon) return jsonResponse({ error: "event" }, { status: 400 });

    let store;
    try {
      store = typeof getStore === "function" ? getStore() : null;
      if (!store) throw new Error("store unavailable");
    } catch {
      return jsonResponse({ error: "store", retryable: true }, { status: 503 });
    }
    const { day } = visitPeriodKeys(now);
    const key = dayKey(day);
    const uniqueHash = beacon.event === "visit" ? dailyUniqueHash({ salt, day, ip, userAgent }) : "";
    for (let attempt = 0; attempt < COLLECT_MAX_WRITE_RETRIES; attempt += 1) {
      try {
        const snapshot = await readDay(store, key, day);
        const next = applyBeacon(snapshot.doc, beacon, uniqueHash);
        if (await writeDay(store, key, next, snapshot)) return jsonResponse(null, { status: 204 });
      } catch {
        return jsonResponse({ error: "store", retryable: true }, { status: 503 });
      }
    }
    return jsonResponse({ error: "conflict", retryable: true }, { status: 503 });
  };
}

export function acceptReadToken(value) {
  const token = String(value ?? "").trim();
  return token.length >= READ_TOKEN_MIN_LENGTH ? token : "";
}

export function tokenMatches(presented, expected) {
  const want = acceptReadToken(expected);
  if (!want) return false;
  const a = createHash("sha256").update(String(presented || "")).digest();
  const b = createHash("sha256").update(want).digest();
  return timingSafeEqual(a, b);
}

function bearer(req) {
  const header = String(req.headers.get("authorization") || "");
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : "";
}

export function sumDays(days) {
  const totals = { events: {}, pages: {}, channels: {}, refs: {}, utm: {}, uniques: 0 };
  for (const day of days) {
    for (const field of ["events", "pages", "channels", "refs", "utm"]) {
      for (const [key, count] of Object.entries(day[field] || {})) totals[field][key] = (totals[field][key] || 0) + count;
    }
    // Daily uniques do not add up to period uniques (hashes rotate daily).
    totals.uniques += day.uniques || 0;
  }
  totals.uniquesNote = "sum of daily uniques; the same person on two days counts twice";
  return totals;
}

export function createStatsHandler({
  getStore,
  nowFn = () => new Date(),
  token = process.env.ANALYTICS_READ_TOKEN,
} = {}) {
  return async function statsHandler(req) {
    // No token configured: the endpoint does not exist.
    if (!acceptReadToken(token)) return jsonResponse({ error: "not found" }, { status: 404 });
    if (req.method !== "GET") return jsonResponse({ error: "method" }, { status: 405 });
    if (!tokenMatches(bearer(req), token)) return jsonResponse({ error: "unauthorized" }, { status: 401 });
    const url = new URL(req.url);
    const requested = Math.floor(Number(url.searchParams.get("days") || 14));
    const count = Math.min(STATS_MAX_DAYS, Math.max(1, Number.isFinite(requested) ? requested : 14));
    let store;
    try {
      store = typeof getStore === "function" ? getStore() : null;
      if (!store) throw new Error("store unavailable");
      const days = [];
      for (const day of recentDayKeys(nowFn(), count)) {
        const raw = await store.get(dayKey(day), { type: "json", consistency: "strong" });
        days.push(publicDay(raw ? { ...raw, day } : emptyDay(day)));
      }
      return jsonResponse({ days, totals: sumDays(days) });
    } catch {
      return jsonResponse({ error: "store", retryable: true }, { status: 503 });
    }
  };
}
