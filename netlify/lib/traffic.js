import { createHash } from "node:crypto";

export const DEFAULT_SALT = "dynasty-ticker-traffic-v1";
export const DEFAULT_ORIGINS = Object.freeze([
  "https://dynastyticker.com",
  "https://www.dynastyticker.com",
]);
export const STATE_KEY = "state";
export const TRAFFIC_MAX_WRITE_RETRIES = 8;
export const TRAFFIC_PERIODS = Object.freeze(["today", "week", "year", "all"]);
export const TRAFFIC_LINES = Object.freeze([
  ["today", "views"],
  ["today", "people"],
  ["week", "views"],
  ["week", "people"],
  ["year", "views"],
  ["year", "people"],
  ["all", "views"],
  ["all", "people"],
]);
export const VISIT_TIME_ZONE = "America/New_York";
export const TRAFFIC_HISTORY_DAYS = 14;

const BOT_RE = /(bot|crawler|spider|crawling|prerender|lighthouse|pagespeed|headless|pingdom|uptimerobot|facebookexternalhit|slackbot|twitterbot|linkedinbot|telegrambot|discordbot|google-inspection|bingpreview|curl\/|python-urllib|go-http-client|ahrefs|semrush|bytespider|dataforseo)/i;
const KEEP_DAYS = 40;
const MAX_SOURCE_HOSTS = 40;
const EVENT_KEEP_MS = 48 * 60 * 60 * 1000;
const EVENT_MAX = 4000;
const SITE_HOST = "dynastyticker.com";

function pad2(value) {
  return String(value).padStart(2, "0");
}

export function utcIsoWeek(now = new Date()) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekday);
  const weekYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return { year: weekYear, week };
}

export function zonedYmd(now = new Date(), timeZone = VISIT_TIME_ZONE) {
  const parts = {};
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)) {
    if (part.type === "year" || part.type === "month" || part.type === "day") parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

function isoWeekFromYmd(year, month, day) {
  return utcIsoWeek(new Date(Date.UTC(year, month - 1, day)));
}

export function visitPeriodKeys(now = new Date()) {
  const { year, month, day } = zonedYmd(now);
  const iso = isoWeekFromYmd(year, month, day);
  return {
    day: `${year}-${pad2(month)}-${pad2(day)}`,
    week: `${iso.year}-W${pad2(iso.week)}`,
    year: String(year),
  };
}

export function recentDayKeys(now = new Date(), count = TRAFFIC_HISTORY_DAYS) {
  const { year, month, day } = zonedYmd(now);
  let cursor = Date.UTC(year, month - 1, day, 16, 0, 0);
  const keys = [];
  const total = Math.max(1, Math.floor(Number(count) || 1));
  for (let i = 0; i < total; i += 1) {
    keys.push(visitPeriodKeys(new Date(cursor)).day);
    cursor -= 86400000;
  }
  keys.reverse();
  return keys;
}

export function cleanVisitorId(value) {
  const id = String(value || "").trim().toLowerCase();
  return /^[a-f0-9]{32}$/.test(id) ? id : "";
}

export function cleanEventId(value) {
  const id = String(value || "").trim();
  if (!id || id.length > 80 || !/^[a-zA-Z0-9_-]+$/.test(id)) return "";
  return id;
}

export function cleanSourceHost(value) {
  const raw = String(value || "").trim().toLowerCase().replace(/^www\./, "");
  if (!raw || raw === "direct") return "direct";
  if (raw === SITE_HOST || raw.endsWith(".netlify.app")) return "direct";
  if (!/^[a-z0-9.-]{1,120}$/.test(raw)) return "direct";
  if (raw.startsWith(".") || raw.endsWith(".") || raw.includes("..")) return "direct";
  return raw;
}

export function landingFromReferer(referer) {
  const raw = String(referer || "").trim();
  if (!raw) return "home";
  let url;
  try {
    url = new URL(raw);
  } catch {
    return "home";
  }
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path === "/privacy" || path === "/privacy.html" || path === "/terms" || path === "/terms.html") return "legal";
  const league = String(url.searchParams.get("league") || "").trim();
  if (league) return "shared";
  return "home";
}

export function visitorHash(ip, userAgent, salt = DEFAULT_SALT, visitorId = "") {
  const secret = salt || DEFAULT_SALT;
  const id = cleanVisitorId(visitorId);
  if (id) {
    return createHash("sha256").update(`${secret}\nvisitor\n${id}`).digest("hex").slice(0, 32);
  }
  return createHash("sha256")
    .update(`${secret}\n${String(ip || "").trim()}\n${String(userAgent || "").trim()}`)
    .digest("hex")
    .slice(0, 32);
}

export function isBot(userAgent) {
  return BOT_RE.test(String(userAgent || ""));
}

function emptyLandings() {
  return { home: 0, shared: 0, legal: 0 };
}

export function emptyBucket() {
  return {
    views: 0,
    people: 0,
    active: 0,
    seen: {},
    activeSeen: {},
    sources: {},
    landings: emptyLandings(),
  };
}

export function emptyState() {
  return {
    all: emptyBucket(),
    days: {},
    weeks: {},
    years: {},
    events: {},
  };
}

function asCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.floor(number);
}

function asSeen(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return { ...value };
}

function asSources(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const [key, count] of Object.entries(value)) {
    const host = cleanSourceHost(key);
    out[host] = asCount(out[host]) + asCount(count);
  }
  return out;
}

function asLandings(value) {
  return {
    home: asCount(value?.home),
    shared: asCount(value?.shared),
    legal: asCount(value?.legal),
  };
}

function asBucket(value) {
  if (!value || typeof value !== "object") return emptyBucket();
  return {
    views: asCount(value.views),
    people: asCount(value.people),
    active: asCount(value.active),
    seen: asSeen(value.seen),
    activeSeen: asSeen(value.activeSeen),
    sources: asSources(value.sources),
    landings: asLandings(value.landings),
  };
}

function asBucketMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const [key, bucket] of Object.entries(value)) {
    out[key] = asBucket(bucket);
  }
  return out;
}

function asEvents(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const [key, stamp] of Object.entries(value)) {
    const id = cleanEventId(key);
    const at = Number(stamp);
    if (!id || !Number.isFinite(at) || at <= 0) continue;
    out[id] = at;
  }
  return out;
}

export function normalizeState(raw) {
  if (!raw || typeof raw !== "object") return emptyState();
  return {
    all: asBucket(raw.all),
    days: asBucketMap(raw.days),
    weeks: asBucketMap(raw.weeks),
    years: asBucketMap(raw.years),
    events: asEvents(raw.events),
  };
}

function pickPeriod(bucket) {
  const sources = {};
  for (const [key, value] of Object.entries(bucket?.sources || {})) {
    sources[key] = asCount(value);
  }
  return {
    views: asCount(bucket?.views),
    people: asCount(bucket?.people),
    active: asCount(bucket?.active),
    sources,
    landings: asLandings(bucket?.landings),
  };
}

export function summarize(state, now = new Date()) {
  const periods = visitPeriodKeys(now);
  const current = normalizeState(state);
  return {
    today: pickPeriod(current.days[periods.day]),
    week: pickPeriod(current.weeks[periods.week]),
    year: pickPeriod(current.years[periods.year]),
    all: pickPeriod(current.all),
    days: recentDayKeys(now).map((day) => ({
      day,
      views: asCount(current.days[day]?.views),
      people: asCount(current.days[day]?.people),
      active: asCount(current.days[day]?.active),
    })),
  };
}

export function flattenTrafficCounts(summary) {
  return TRAFFIC_LINES.map(([period, metric]) => asCount(summary?.[period]?.[metric]));
}

function pruneMap(map, keepKey, maxKeys) {
  const keys = Object.keys(map).sort();
  for (const key of keys) {
    if (key !== keepKey) {
      delete map[key].seen;
      delete map[key].activeSeen;
    }
  }
  if (keys.length <= maxKeys) return;
  for (const key of keys.slice(0, keys.length - maxKeys)) {
    delete map[key];
  }
}

function pruneEvents(state, now) {
  const cutoff = now.getTime() - EVENT_KEEP_MS;
  for (const [key, stamp] of Object.entries(state.events)) {
    if (stamp < cutoff) delete state.events[key];
  }
  const keys = Object.keys(state.events);
  if (keys.length <= EVENT_MAX) return;
  keys.sort((a, b) => state.events[a] - state.events[b] || a.localeCompare(b));
  for (const key of keys.slice(0, keys.length - EVENT_MAX)) delete state.events[key];
}

export function pruneState(state, now = new Date()) {
  const current = normalizeState(state);
  const periods = visitPeriodKeys(now);
  pruneMap(current.days, periods.day, KEEP_DAYS);
  pruneMap(current.weeks, periods.week, 12);
  pruneMap(current.years, periods.year, 3);
  pruneEvents(current, now);
  return current;
}

function bumpPerson(bucket, hash) {
  if (!bucket.seen[hash]) {
    bucket.seen[hash] = 1;
    bucket.people += 1;
  }
}

function bumpActive(bucket, hash) {
  bumpPerson(bucket, hash);
  if (!bucket.activeSeen[hash]) {
    bucket.activeSeen[hash] = 1;
    bucket.active += 1;
  }
}

function bumpSource(bucket, host) {
  const key = host || "direct";
  bucket.sources[key] = asCount(bucket.sources[key]) + 1;
  const extras = Object.keys(bucket.sources).filter((name) => name !== "direct");
  if (extras.length + (bucket.sources.direct == null ? 0 : 1) <= MAX_SOURCE_HOSTS) return;
  extras.sort((a, b) => bucket.sources[a] - bucket.sources[b] || a.localeCompare(b));
  while (Object.keys(bucket.sources).length > MAX_SOURCE_HOSTS && extras.length) {
    delete bucket.sources[extras.shift()];
  }
}

function bumpLanding(bucket, landing) {
  const key = landing === "shared" || landing === "legal" ? landing : "home";
  bucket.landings[key] += 1;
}

function periodBuckets(state, now) {
  const periods = visitPeriodKeys(now);
  if (!state.days[periods.day]) state.days[periods.day] = emptyBucket();
  if (!state.weeks[periods.week]) state.weeks[periods.week] = emptyBucket();
  if (!state.years[periods.year]) state.years[periods.year] = emptyBucket();
  return [
    state.all,
    state.days[periods.day],
    state.weeks[periods.week],
    state.years[periods.year],
  ];
}

export function applyVisit(state, {
  hash,
  now = new Date(),
  eventId = "",
  kind = "open",
  source = "direct",
  landing = "home",
} = {}) {
  const current = pruneState(state, now);
  const event = cleanEventId(eventId);
  if (event && current.events[event]) return current;
  const id = String(hash || "").trim();
  if (!id) return current;
  const buckets = periodBuckets(current, now);
  if (kind === "active") {
    for (const bucket of buckets) bumpActive(bucket, id);
  } else {
    const host = cleanSourceHost(source);
    const land = landing === "shared" || landing === "legal" ? landing : "home";
    for (const bucket of buckets) {
      bucket.views += 1;
      bumpPerson(bucket, id);
      bumpSource(bucket, host);
      bumpLanding(bucket, land);
    }
  }
  if (event) current.events[event] = now.getTime();
  pruneEvents(current, now);
  return current;
}

export function originOf(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

export function isAllowedWrite(req, allowedOrigins = DEFAULT_ORIGINS) {
  const allowed = new Set(allowedOrigins);
  const origin = originOf(req?.headers?.get?.("origin"));
  if (origin && allowed.has(origin)) return true;
  const referer = originOf(req?.headers?.get?.("referer"));
  return Boolean(referer && allowed.has(referer));
}

export function clientIp(req, context = {}) {
  if (context?.ip) return String(context.ip).trim();
  const headers = req?.headers;
  const forwarded = headers?.get?.("x-nf-client-connection-ip")
    || headers?.get?.("x-forwarded-for")
    || "";
  return String(forwarded).split(",")[0].trim();
}

function jsonResponse(body, { status = 200, cors = false } = {}) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  };
  if (cors) headers["access-control-allow-origin"] = "*";
  return new Response(JSON.stringify(body), { status, headers });
}

export function lambdaEventToRequest(event) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(event?.headers || {})) {
    if (value == null) continue;
    headers.set(key, String(value));
  }
  const host = headers.get("host") || "dynastyticker.com";
  const proto = headers.get("x-forwarded-proto") || "https";
  const path = event?.path || "/";
  const query = event?.rawQuery
    || new URLSearchParams(event?.queryStringParameters || {}).toString();
  const url = `${proto}://${host}${path}${query ? `?${query}` : ""}`;
  const method = String(event?.httpMethod || "GET").toUpperCase();
  const init = { method, headers };
  if (method !== "GET" && method !== "HEAD") {
    init.body = event?.isBase64Encoded && event?.body
      ? Buffer.from(event.body, "base64").toString("utf8")
      : (event?.body ?? "");
  }
  return new Request(url, init);
}

export function lambdaIp(event, context = {}) {
  if (context?.ip) return String(context.ip).trim();
  const headers = event?.headers || {};
  const forwarded = headers["x-nf-client-connection-ip"]
    || headers["X-Nf-Client-Connection-Ip"]
    || headers["x-forwarded-for"]
    || headers["X-Forwarded-For"]
    || "";
  return String(forwarded).split(",")[0].trim();
}

export function wrapLambdaHandler(visitHandler) {
  return async function handler(event, context = {}) {
    const response = await visitHandler(lambdaEventToRequest(event), {
      ip: lambdaIp(event, context),
    });
    const body = await response.text();
    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return { statusCode: response.status, headers, body };
  };
}

export async function readVisitBody(req) {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > 2000) return {};
  let text = "";
  try {
    text = await req.text();
  } catch {
    return {};
  }
  if (!text || text.length > 2000) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function readTrafficSnapshot(store) {
  if (!store || typeof store.getWithMetadata !== "function") throw new Error("durable store unavailable");
  const snapshot = await store.getWithMetadata(STATE_KEY, {
    type: "json",
    consistency: "strong",
  });
  if (!snapshot) return { state: emptyState(), etag: "", exists: false };
  return {
    state: normalizeState(snapshot.data),
    etag: typeof snapshot.etag === "string" ? snapshot.etag : "",
    exists: true,
  };
}

async function writeTrafficSnapshot(store, state, snapshot) {
  if (!store || typeof store.setJSON !== "function") throw new Error("durable store unavailable");
  if (snapshot.exists && !snapshot.etag) throw new Error("missing etag for existing traffic state");
  const condition = snapshot.exists
    ? { onlyIfMatch: snapshot.etag }
    : { onlyIfNew: true };
  const result = await store.setJSON(STATE_KEY, state, condition);
  return result?.modified === true && typeof result?.etag === "string" && result.etag.length > 0;
}

export function createVisitHandler({
  getStore,
  nowFn = () => new Date(),
  salt = process.env.VISIT_SALT || DEFAULT_SALT,
  allowedOrigins = DEFAULT_ORIGINS,
} = {}) {
  return async function visitHandler(req, context = {}) {
    if (req.method === "OPTIONS") {
      return new Response("", {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-max-age": "86400",
        },
      });
    }

    if (req.method !== "GET" && req.method !== "POST") {
      return jsonResponse({ error: "method" }, { status: 405 });
    }

    if (req.method === "POST" && !isAllowedWrite(req, allowedOrigins)) {
      return jsonResponse({ error: "forbidden" }, { status: 403 });
    }

    const userAgent = req.headers.get("user-agent") || "";
    if (req.method === "POST" && isBot(userAgent)) {
      return jsonResponse({ ok: true, skipped: "bot" });
    }

    const body = req.method === "POST" ? await readVisitBody(req) : {};

    let store;
    try {
      store = typeof getStore === "function" ? getStore() : null;
      if (!store) throw new Error("store unavailable");
    } catch {
      return jsonResponse({ error: "store", retryable: true }, { status: 503 });
    }

    if (req.method === "GET") {
      try {
        const snapshot = await readTrafficSnapshot(store);
        return jsonResponse(summarize(snapshot.state, nowFn()), { cors: true });
      } catch {
        return jsonResponse({ error: "store", retryable: true }, { status: 503, cors: true });
      }
    }

    const eventId = cleanEventId(body.eventId);
    const hash = visitorHash(clientIp(req, context), userAgent, salt, body.visitorId);
    const now = nowFn();
    const kind = body.kind === "active" ? "active" : "open";
    const source = cleanSourceHost(body.source);
    const landing = landingFromReferer(req.headers.get("referer"));
    for (let attempt = 0; attempt < TRAFFIC_MAX_WRITE_RETRIES; attempt += 1) {
      let snapshot;
      try {
        snapshot = await readTrafficSnapshot(store);
      } catch {
        return jsonResponse({ error: "store", retryable: true }, { status: 503 });
      }
      if (eventId && snapshot.state.events[eventId]) return jsonResponse({ ok: true });
      const next = applyVisit(snapshot.state, { hash, now, eventId, kind, source, landing });
      try {
        if (await writeTrafficSnapshot(store, next, snapshot)) return jsonResponse({ ok: true });
      } catch {
        return jsonResponse({ error: "store", retryable: true }, { status: 503 });
      }
    }

    return jsonResponse({ error: "conflict", retryable: true }, { status: 503 });
  };
}
