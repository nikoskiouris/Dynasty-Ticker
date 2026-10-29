import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  COLLECT_EVENTS,
  UNIQUES_MAX_PER_DAY,
  applyBeacon,
  classifyReferrer,
  cleanPagePath,
  createCollectHandler,
  createRateLimiter,
  createStatsHandler,
  dailyUniqueHash,
  emptyDay,
  tokenMatches,
  validateBeacon,
} from "../netlify/lib/site-analytics.js";

const SALT = "test-only-salt-not-a-real-value";
const TOKEN = "t".repeat(32);
const NOW = new Date("2026-10-15T16:00:00Z");
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/605.1";

// Multi-key Blobs stand-in with etags and onlyIfMatch / onlyIfNew.
function memoryStore({ conflicts = 0, failWrite = false } = {}) {
  const data = new Map();
  let version = 0;
  let pendingConflicts = conflicts;
  return {
    data,
    writes: 0,
    async getWithMetadata(key) {
      const row = data.get(key);
      return row ? { data: structuredClone(row.value), etag: row.etag } : null;
    },
    async get(key) {
      const row = data.get(key);
      return row ? structuredClone(row.value) : null;
    },
    async setJSON(key, value, options = {}) {
      if (failWrite) throw new Error("down");
      this.writes += 1;
      const row = data.get(key);
      if (pendingConflicts > 0) {
        pendingConflicts -= 1;
        return { modified: false };
      }
      if (options.onlyIfNew && row) return { modified: false };
      if (options.onlyIfMatch && options.onlyIfMatch !== row?.etag) return { modified: false };
      version += 1;
      data.set(key, { value: structuredClone(value), etag: `e${version}` });
      return { modified: true, etag: `e${version}` };
    },
  };
}

function beacon(body, { headers = {}, method = "POST" } = {}) {
  return new Request("https://dynastyticker.com/api/collect", {
    method,
    headers: { origin: "https://dynastyticker.com", "user-agent": UA, ...headers },
    body: method === "POST" ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
  });
}

function collector(store, over = {}) {
  return createCollectHandler({ getStore: () => store, nowFn: () => NOW, salt: SALT, rateLimit: () => true, ...over });
}

const day = () => "day/2026-10-15";

test("allowlist: events, props, and paths are validated", () => {
  assert.deepEqual(COLLECT_EVENTS, ["visit", "landing_view", "trade_checked", "share_tapped", "t_opened", "league_connected", "trade_described"]);
  assert.equal(validateBeacon({ e: "purchase" }), null);
  assert.equal(validateBeacon({ e: "trade_checked", props: { mode: "everything" } }), null);
  assert.equal(validateBeacon({ e: "trade_checked", props: { mode: "league", user: "niko" } }), null);
  assert.equal(validateBeacon([]), null);
  assert.deepEqual(validateBeacon({ e: "share_tapped", p: "/trade", props: { method: "copy" } }).props, { method: "copy" });
  // League ids, player ids, share codes never survive; unknown paths are /other.
  assert.equal(cleanPagePath("/l/1180000000000000/week"), "/l/:id/week");
  assert.equal(cleanPagePath("/t/SECRET?u=1"), "/t/:code");
  assert.equal(cleanPagePath("/niko@example.com"), "/other");
  assert.equal(cleanPagePath("https://evil.example/l/1"), "/other");
  assert.equal(cleanPagePath("/l/:id/history"), "/l/:id/history");
});

test("referrers: social, search, other, direct; own and junk hosts are direct", () => {
  const ch = (host) => classifyReferrer(host).channel;
  for (const host of ["x.com", "t.co", "twitter.com", "old.reddit.com", "m.facebook.com", "l.instagram.com", "bsky.app", "discord.com", "threads.net", "linkedin.com", "youtube.com", "sleeper.com"]) {
    assert.equal(ch(host), "social", host);
  }
  for (const host of ["google.com", "google.co.uk", "bing.com", "duckduckgo.com"]) assert.equal(ch(host), "search", host);
  assert.equal(ch("fantasypros.com"), "other");
  for (const host of ["", "dynastyticker.com", "www.dynastyticker.com", "develop--x.netlify.app", "not a host", "a/b.com", "localhost"]) {
    assert.equal(ch(host), "direct", host);
  }
  assert.equal(classifyReferrer("WWW.Reddit.com").host, "reddit.com");
});

test("daily unique hash: salted, rotates daily, empty without a usable salt", () => {
  const base = { salt: SALT, day: "2026-10-15", ip: "203.0.113.9", userAgent: UA };
  const a = dailyUniqueHash(base);
  assert.match(a, /^[a-f0-9]{16}$/);
  assert.equal(dailyUniqueHash(base), a);
  assert.notEqual(dailyUniqueHash({ ...base, day: "2026-10-16" }), a);
  assert.notEqual(dailyUniqueHash({ ...base, userAgent: "other" }), a);
  assert.notEqual(dailyUniqueHash({ ...base, salt: `${SALT}2` }), a);
  assert.equal(dailyUniqueHash({ ...base, salt: "" }), "");
  assert.equal(dailyUniqueHash({ ...base, salt: undefined }), "");
  assert.equal(dailyUniqueHash({ ...base, salt: "dynasty-ticker-traffic-v1" }), "");
  assert.equal(dailyUniqueHash({ ...base, ip: "" }), "");
  assert.equal(a.includes("203"), false);
});

test("collect counts a visit, page, channel, ref host, utm and a unique", async () => {
  const store = memoryStore();
  const handler = collector(store);
  const res = await handler(beacon({ e: "visit", p: "/t/:code", r: "t.co", u: "x" }), { ip: "203.0.113.9" });
  assert.equal(res.status, 204);
  await handler(beacon({ e: "visit", p: "/trade" }), { ip: "203.0.113.9" });
  await handler(beacon({ e: "visit", p: "/trade" }), { ip: "198.51.100.4" });
  await handler(beacon({ e: "trade_checked", p: "/trade", props: { mode: "public" } }), { ip: "198.51.100.4" });
  await handler(beacon({ e: "share_tapped", p: "/trade", props: { method: "webshare" } }), { ip: "198.51.100.4" });
  await handler(beacon({ e: "t_opened", p: "/t/:code", props: { drift: "no" } }), { ip: "198.51.100.4" });
  await handler(beacon({ e: "league_connected", p: "/l/:id", props: { sample: "no" } }), { ip: "198.51.100.4" });
  const doc = store.data.get(day()).value;
  assert.equal(doc.events.visit, 3);
  assert.equal(doc.events.trade_checked, 1);
  assert.equal(doc.events["trade_checked.mode=public"], 1);
  assert.equal(doc.events.share_tapped, 1);
  assert.equal(doc.events.t_opened, 1);
  assert.equal(doc.events.league_connected, 1);
  assert.deepEqual(doc.pages, { "/t/:code": 1, "/trade": 2 });
  assert.deepEqual(doc.channels, { social: 1, direct: 2 });
  assert.deepEqual(doc.refs, { "t.co": 1 });
  assert.deepEqual(doc.utm, { x: 1 });
  assert.equal(doc.uniques, 2);
  // Nothing identifying is stored: no IP, no UA, only 16-hex daily hashes.
  const raw = JSON.stringify(doc);
  assert.doesNotMatch(raw, /203\.0\.113|198\.51|iPhone|Mozilla/);
  for (const key of Object.keys(doc.seen)) assert.match(key, /^[a-f0-9]{16}$/);
});

test("salt unset: counts still work, uniques are skipped", async () => {
  const store = memoryStore();
  const handler = collector(store, { salt: undefined });
  assert.equal((await handler(beacon({ e: "visit", p: "/" }), { ip: "203.0.113.9" })).status, 204);
  const doc = store.data.get(day()).value;
  assert.equal(doc.events.visit, 1);
  assert.equal(doc.uniques, 0);
  assert.deepEqual(doc.seen, {});
});

test("DNT, GPC, bots, foreign origins, bad bodies and other methods store nothing", async () => {
  const store = memoryStore();
  const handler = collector(store);
  const ip = { ip: "203.0.113.9" };
  assert.equal((await handler(beacon({ e: "visit" }, { headers: { dnt: "1" } }), ip)).status, 204);
  assert.equal((await handler(beacon({ e: "visit" }, { headers: { "sec-gpc": "1" } }), ip)).status, 204);
  assert.equal((await handler(beacon({ e: "visit" }, { headers: { "user-agent": "Googlebot/2.1" } }), ip)).status, 204);
  assert.equal((await handler(beacon({ e: "visit" }, { headers: { origin: "https://evil.example" } }), ip)).status, 403);
  assert.equal((await handler(beacon({ e: "nope" }), ip)).status, 400);
  assert.equal((await handler(beacon("{not json"), ip)).status, 400);
  assert.equal((await handler(beacon({ e: "visit", pad: "x".repeat(2000) }), ip)).status, 413);
  assert.equal((await handler(beacon(null, { method: "GET" }), ip)).status, 405);
  assert.equal(store.data.size, 0);
});

test("rate limit: per IP, windowed, bounded", async () => {
  const allow = createRateLimiter({ max: 3, windowMs: 1000, tracked: 2 });
  assert.deepEqual([1, 2, 3, 4].map(() => allow("203.0.113.9", 0)), [true, true, true, false]);
  assert.equal(allow("198.51.100.4", 10), true);
  assert.equal(allow("203.0.113.9", 1001), true);
  const store = memoryStore();
  const handler = collector(store, { rateLimit: createRateLimiter({ max: 2 }) });
  const statuses = [];
  for (let i = 0; i < 3; i += 1) statuses.push((await handler(beacon({ e: "visit" }), { ip: "203.0.113.9" })).status);
  assert.deepEqual(statuses, [204, 204, 429]);
  assert.equal(store.data.get(day()).value.events.visit, 2);
});

test("write conflicts retry; store failures are a retryable 503", async () => {
  const store = memoryStore({ conflicts: 3 });
  assert.equal((await collector(store)(beacon({ e: "visit" }), { ip: "203.0.113.9" })).status, 204);
  assert.equal(store.data.get(day()).value.events.visit, 1);
  const stuck = memoryStore({ conflicts: 100 });
  assert.equal((await collector(stuck)(beacon({ e: "visit" }), { ip: "203.0.113.9" })).status, 503);
  const down = memoryStore({ failWrite: true });
  assert.equal((await collector(down)(beacon({ e: "visit" }), { ip: "203.0.113.9" })).status, 503);
});

test("ref hosts and uniques are capped", () => {
  let doc = emptyDay("2026-10-15");
  for (let i = 0; i < 70; i += 1) doc = applyBeacon(doc, { event: "visit", page: "/", props: {}, channel: "other", host: `site${i}.example`, utm: "" });
  assert.equal(Object.keys(doc.refs).length, 61);
  assert.equal(doc.refs["(other)"], 10);
  const seen = {};
  for (let i = 0; i < UNIQUES_MAX_PER_DAY; i += 1) seen[i.toString(16).padStart(16, "0")] = 1;
  const full = applyBeacon({ ...emptyDay("2026-10-15"), seen, uniques: UNIQUES_MAX_PER_DAY }, { event: "visit", page: "/", props: {}, channel: "direct", host: "", utm: "" }, "f".repeat(16));
  assert.equal(full.uniques, UNIQUES_MAX_PER_DAY);
  assert.equal(full.uniquesCapped, true);
});

test("stats: 404 without a token, 401 on a wrong one, counts without hashes on the right one", async () => {
  const store = memoryStore();
  await collector(store)(beacon({ e: "visit", p: "/trade", r: "reddit.com" }), { ip: "203.0.113.9" });
  const req = (auth, path = "/api/analytics-stats?days=3") => new Request(`https://dynastyticker.com${path}`, { headers: auth ? { authorization: auth } : {} });
  const off = createStatsHandler({ getStore: () => store, nowFn: () => NOW, token: "" });
  assert.equal((await off(req(`Bearer ${TOKEN}`))).status, 404);
  const short = createStatsHandler({ getStore: () => store, nowFn: () => NOW, token: "short" });
  assert.equal((await short(req("Bearer short"))).status, 404);
  const stats = createStatsHandler({ getStore: () => store, nowFn: () => NOW, token: TOKEN });
  assert.equal((await stats(req(""))).status, 401);
  assert.equal((await stats(req(`Bearer ${TOKEN}x`))).status, 401);
  const res = await stats(req(`Bearer ${TOKEN}`));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const body = await res.json();
  assert.deepEqual(body.days.map((d) => d.day), ["2026-10-13", "2026-10-14", "2026-10-15"]);
  assert.equal(body.days[2].events.visit, 1);
  assert.equal(body.days[2].uniques, 1);
  assert.equal(body.totals.channels.social, 1);
  assert.equal(JSON.stringify(body).includes("seen"), false);
  assert.equal(tokenMatches(TOKEN, TOKEN), true);
  assert.equal(tokenMatches("", ""), false);
  const many = await stats(req(`Bearer ${TOKEN}`, "/api/analytics-stats?days=9999"));
  assert.equal((await many.json()).days.length, 90);
});

test("wiring: redirects, functions, CSP stays self-only, no salt or token value committed", () => {
  const toml = readFileSync(new URL("../netlify.toml", import.meta.url), "utf8");
  assert.match(toml, /from = "\/api\/collect"\s*\n\s*to = "\/\.netlify\/functions\/collect"\s*\n\s*status = 200\s*\n\s*force = true/);
  assert.match(toml, /from = "\/api\/analytics-stats"\s*\n\s*to = "\/\.netlify\/functions\/analytics-stats"\s*\n\s*status = 200\s*\n\s*force = true/);
  assert.ok(toml.indexOf('from = "/api/collect"') < toml.indexOf('from = "/*"'));
  const redirects = readFileSync(new URL("../docs/_redirects", import.meta.url), "utf8");
  assert.match(redirects, /\/api\/collect\s+\/\.netlify\/functions\/collect\s+200!/);
  assert.match(redirects, /\/api\/analytics-stats\s+\/\.netlify\/functions\/analytics-stats\s+200!/);
  const csp = /connect-src ([^;]+);/.exec(toml)[1];
  assert.equal(csp.trim(), "'self' https://api.sleeper.app");
  for (const file of ["../netlify.toml", "../netlify/functions/collect.js", "../netlify/functions/analytics-stats.js", "../netlify/lib/site-analytics.js"]) {
    const src = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(src, /ANALYTICS_(SALT|READ_TOKEN)\s*=\s*["'][^"']/, file);
  }
});
