import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ANALYTICS_EVENTS,
  COLLECT_URL,
  NOOP_ADAPTER,
  createBeaconAdapter,
  campaignFrom,
  cleanProps,
  isPreviewHost,
  optOutReason,
  pageview,
  placeholderRoute,
  referrerHost,
  resetAnalytics,
  setAnalyticsAdapter,
  track,
  trackShareTapped,
  trackTradeLinkOpened,
} from "../docs/modules/analytics.js";

const LIVE = { location: { hostname: "dynastyticker.com" }, nav: {}, win: {} };

function recorder() {
  const calls = [];
  return {
    calls,
    pageview(route, context) { calls.push(["pageview", route, context]); },
    event(name, props) { calls.push(["event", name, props]); },
  };
}

function withAdapter() {
  resetAnalytics();
  const rec = recorder();
  setAnalyticsAdapter(rec);
  return rec;
}

test("default adapter is a no-op; the only network path is a same-origin beacon", () => {
  resetAnalytics();
  assert.equal(typeof NOOP_ADAPTER.pageview, "function");
  const src = readFileSync(new URL("../docs/modules/analytics.js", import.meta.url), "utf8");
  for (const word of ["fetch(", "XMLHttpRequest", "WebSocket", "<script", "http://", "https://", "document.cookie", "localStorage", "sessionStorage"]) {
    assert.equal(src.includes(word), false, `analytics.js must not contain ${word}`);
  }
  assert.equal(src.match(/sendBeacon\(/g)?.length, 1);
  assert.equal(COLLECT_URL, "/api/collect");
});

test("opt-outs: DNT, GPC, automation, localhost, previews", () => {
  const on = (over) => optOutReason({ ...LIVE, ...over });
  assert.equal(on({}), "");
  assert.equal(on({ nav: { doNotTrack: "1" } }), "privacy-signal");
  assert.equal(on({ win: { doNotTrack: "1" } }), "privacy-signal");
  assert.equal(on({ nav: { globalPrivacyControl: true } }), "privacy-signal");
  assert.equal(on({ nav: { doNotTrack: "0" } }), "");
  assert.equal(on({ nav: { webdriver: true } }), "automation");
  for (const hostname of ["localhost", "127.0.0.1", "[::1]", "desk.local"]) {
    assert.equal(on({ location: { hostname } }), "localhost", hostname);
  }
  for (const hostname of ["deploy-preview-164--dynasty-ticker.netlify.app", "develop--dynasty-ticker.netlify.app", "abc123--dynasty-ticker.netlify.app"]) {
    assert.equal(isPreviewHost(hostname), true, hostname);
    assert.equal(on({ location: { hostname } }), "preview");
  }
  assert.equal(isPreviewHost("dynasty-ticker.netlify.app"), false);
});

test("opted-out environments never reach the adapter", () => {
  const rec = withAdapter();
  const env = { ...LIVE, nav: { globalPrivacyControl: true } };
  assert.equal(track("landing_view", {}, { env }), false);
  pageview("/players", { env });
  assert.deepEqual(rec.calls, []);
  track("landing_view", {}, { env: LIVE });
  assert.equal(rec.calls.length, 1);
});

test("routes are placeholdered and lose query strings", () => {
  const cases = {
    "/": "/",
    "/players": "/players",
    "/players/": "/players",
    "/trade?give=player:4046&get=player:9509&league=123": "/trade",
    "/connect?next=/l/1": "/connect",
    "/l/1180000000000000": "/l/:id",
    "/l/1180000000000000/team": "/l/:id/team",
    "/l/1180000000000000/ideas": "/l/:id/ideas",
    "/l/1180000000000000/league": "/l/:id/league",
    "/l/1180000000000000/week": "/l/:id/week",
    "/l/1180000000000000/activity": "/l/:id/activity",
    "/l/1180000000000000/history/": "/l/:id/history",
    "/player/9509": "/player/:id",
    "/player/9509/bijan-robinson": "/player/:id",
    "/t/AbC123xyz": "/t/:code",
    "/t/AbC123xyz?utm_source=x": "/t/:code",
    "https://dynastyticker.com/player/4046/x": "/player/:id",
    "/garbage/x": "/other",
    "/l/1/secret/extra": "/other",
  };
  for (const [input, want] of Object.entries(cases)) assert.equal(placeholderRoute(input), want, input);
});

test("pageview sends a template plus clean UTM and referrer host only", () => {
  const rec = withAdapter();
  pageview("/t/Secret99", {
    search: "?utm_source=X&utm_medium=social&utm_campaign=launch week&league=123&utm_term=bad",
    referrer: "https://t.co/abc?u=niko",
    env: LIVE,
  });
  assert.deepEqual(rec.calls, [["pageview", "/t/:code", { utm_source: "x", utm_medium: "social", referrer: "t.co" }]]);
  assert.deepEqual(campaignFrom("utm_source=a%40b.com"), {});
  assert.equal(referrerHost("https://www.dynastyticker.com/x", "dynastyticker.com"), "");
});

test("one pageview per route change", () => {
  const rec = withAdapter();
  assert.equal(pageview("/player/1", { env: LIVE }), true);
  assert.equal(pageview("/player/2/slug", { env: LIVE }), false);
  assert.equal(pageview("/players", { env: LIVE }), true);
  assert.equal(pageview("/player/1", { env: LIVE }), true);
  assert.deepEqual(rec.calls.map((c) => c[1]), ["/player/:id", "/players", "/player/:id"]);
});

test("allowlist: unknown events, unknown keys and free-text values are dropped", () => {
  const rec = withAdapter();
  assert.equal(track("signup", {}, { env: LIVE }), false);
  assert.equal(track("share_tapped", { method: "email me at a@b.com" }, { env: LIVE }), false);
  assert.equal(track("trade_checked", { mode: "public", leagueId: "123", user: "niko" }, { env: LIVE }), true);
  assert.deepEqual(rec.calls, [["event", "trade_checked", { mode: "public" }]]);
  assert.equal(cleanProps("league_connected", { sample: true }), null);
  assert.deepEqual(Object.keys(ANALYTICS_EVENTS).sort(), ["landing_view", "league_connected", "share_tapped", "t_opened", "trade_checked", "trade_described"]);
});

test("once-only: a repeated occurrence key is dropped, a new one fires", () => {
  const rec = withAdapter();
  const fire = (key) => track("trade_checked", { mode: "public" }, { once: key, env: LIVE });
  assert.equal(fire("a|b"), true);
  assert.equal(fire("a|b"), false);
  assert.equal(fire("a|c"), true);
  assert.equal(fire("a|b"), true);
  assert.equal(rec.calls.length, 3);
});

test("#164 hooks validate their props", () => {
  const rec = withAdapter();
  globalThis.location = { hostname: "dynastyticker.com" };
  try {
    trackShareTapped("webshare");
    trackShareTapped("sms");
    trackTradeLinkOpened({ drift: true });
    trackTradeLinkOpened();
  } finally {
    delete globalThis.location;
  }
  assert.deepEqual(rec.calls, [
    ["event", "share_tapped", { method: "webshare" }],
    ["event", "t_opened", { drift: "yes" }],
    ["event", "t_opened", { drift: "no" }],
  ]);
});

test("a throwing adapter never breaks the caller", () => {
  resetAnalytics();
  setAnalyticsAdapter({ pageview() { throw new Error("x"); }, event() { throw new Error("x"); } });
  assert.doesNotThrow(() => track("landing_view", {}, { env: LIVE }));
  assert.doesNotThrow(() => pageview("/players", { env: LIVE }));
});

test("injected test adapter is honoured only on a local host", () => {
  resetAnalytics();
  const rec = recorder();
  const nav = { webdriver: true };
  assert.equal(track("landing_view", {}, { env: { nav, win: { __dtAnalyticsTestAdapter: rec }, location: { hostname: "127.0.0.1" } } }), true);
  assert.equal(track("landing_view", {}, { env: { nav, win: { __dtAnalyticsTestAdapter: rec }, location: { hostname: "dynastyticker.com" } } }), false);
  assert.equal(rec.calls.length, 1);
});

test("app wires the #164 hooks: share_tapped after a completed share, t_opened from loadSharedTrade", async () => {
  const { readFileSync } = await import("node:fs");
  const app = readFileSync(new URL("../docs/app.js", import.meta.url), "utf8");
  assert.match(app, /await navigator\.share\([^)]*\);\s*trackShareTapped\("webshare"\);/);
  assert.match(app, /await navigator\.clipboard\.writeText\(url\);\s*trackShareTapped\("copy"\);/);
  // One t_opened per open, from the first render after the archive lookup settles.
  assert.match(app, /if \(entry\.settled && !entry\.reported\) \{\s*entry\.reported = true;\s*trackTradeLinkOpened\(\{ drift: moved \}\);/);
  assert.equal((app.match(/trackTradeLinkOpened\(/g) || []).length, 1);
  assert.equal((app.match(/trackShareTapped\(/g) || []).length, 2);
});

function beaconNav() {
  const sent = [];
  return {
    sent,
    nav: { sendBeacon(url, blob) { sent.push({ url, blob }); return true; } },
  };
}

async function bodies(sent) {
  return Promise.all(sent.map(async ({ url, blob }) => ({ url, type: blob.type, body: JSON.parse(await blob.text()) })));
}

test("beacon adapter: one same-origin beacon per call, templates only, no ids", async () => {
  const { sent, nav } = beaconNav();
  resetAnalytics();
  setAnalyticsAdapter(createBeaconAdapter({ nav, currentRoute: () => "/t/:code" }));
  pageview("/l/1180000000000000/week", { search: "?utm_source=reddit&league=1180000000000000", referrer: "https://www.reddit.com/r/DynastyFF/x", env: LIVE });
  pageview("/l/1180000000000000/week", { env: LIVE });
  trackShareTapped("copy");
  trackTradeLinkOpened({ drift: true });
  const ON_TRADE = { ...LIVE, location: { hostname: "dynastyticker.com", pathname: "/t/Secret99" } };
  track("trade_checked", { mode: "league" }, { env: ON_TRADE });
  track("league_connected", { sample: "no" }, { env: ON_TRADE });
  track("made_up", {}, { env: ON_TRADE });
  const got = await bodies(sent);
  for (const row of got) {
    assert.equal(row.url, "/api/collect");
    assert.match(row.type, /^text\/plain/);
    assert.doesNotMatch(JSON.stringify(row.body), /1180000000000000|DynastyFF/);
  }
  assert.deepEqual(got[0].body, { e: "visit", p: "/l/:id/week", r: "reddit.com", u: "reddit" });
  assert.deepEqual(got.slice(1).map((row) => row.body), [
    // trackShareTapped / trackTradeLinkOpened run with the global env (no window
    // in node), so they are opted out and send nothing. The env'd calls go out.
    { e: "trade_checked", p: "/t/:code", props: { mode: "league" } },
    { e: "league_connected", p: "/t/:code", props: { sample: "no" } },
  ]);
  resetAnalytics();
});

test("beacon adapter is a no-op without sendBeacon, stays switchable, and swallows errors", () => {
  assert.equal(createBeaconAdapter({ nav: {} }), NOOP_ADAPTER);
  const throwing = createBeaconAdapter({ nav: { sendBeacon() { throw new Error("blocked"); } } });
  assert.doesNotThrow(() => throwing.pageview("/", {}));
  assert.doesNotThrow(() => throwing.event("share_tapped", { method: "copy" }));
  const { sent, nav } = beaconNav();
  resetAnalytics();
  setAnalyticsAdapter(createBeaconAdapter({ nav }));
  setAnalyticsAdapter(NOOP_ADAPTER);
  track("trade_checked", { mode: "public" }, { env: LIVE });
  assert.equal(sent.length, 0);
  resetAnalytics();
});

test("beacon adapter never sends under DNT or GPC", () => {
  const { sent, nav } = beaconNav();
  resetAnalytics();
  setAnalyticsAdapter(createBeaconAdapter({ nav }));
  pageview("/trade", { env: { ...LIVE, nav: { doNotTrack: "1" } } });
  track("trade_checked", { mode: "public" }, { env: { ...LIVE, nav: { globalPrivacyControl: true } } });
  assert.equal(sent.length, 0);
  resetAnalytics();
});

test("app.js switches in the beacon adapter at boot", () => {
  const app = readFileSync(new URL("../docs/app.js", import.meta.url), "utf8");
  const set = app.indexOf("setAnalyticsAdapter(createBeaconAdapter());");
  // bootFromUrl can write the URL (updateUrlState -> reportRoute), so the
  // adapter must be live before it, not just before the boot-end reportRoute.
  const boot = app.indexOf("\nbootFromUrl();");
  const firstReport = app.indexOf("\nreportRoute();");
  assert.ok(set > 0 && boot > set && firstReport > set, "adapter is set before boot and the first pageview");
  assert.equal(app.includes("reportRoute({ first: true })"), false);
  // trade_checked waits for the URL write that follows the render.
  assert.match(app, /queueMicrotask\(\(\) => analyticsTrack\("trade_checked"/);
  // A league load does not write the landing URL before showAppPages.
  assert.match(app, /hydrateManagerSelector\(\{ syncUrl: false \}\);/);
});

test("no live adapter: the route is not marked reported, so the first real send still happens", () => {
  resetAnalytics();
  // Boot order bug (#178 r2): a pageview before the adapter was set used to
  // mark the route, and the real first pageview was then deduped away.
  assert.equal(pageview("/players", { env: LIVE }), false);
  assert.equal(pageview("/players", { env: { ...LIVE, nav: { doNotTrack: "1" } } }), false);
  const rec = recorder();
  setAnalyticsAdapter(rec);
  assert.equal(pageview("/players", { referrer: "https://t.co/x", env: LIVE }), true);
  assert.deepEqual(rec.calls, [["pageview", "/players", { referrer: "t.co" }]]);
  resetAnalytics();
});

test("the first pageview sent carries the page's own referrer and UTM, later ones carry none", () => {
  const rec = withAdapter();
  const env = { ...LIVE, location: { hostname: "dynastyticker.com", search: "?utm_source=reddit" }, doc: { referrer: "https://old.reddit.com/r/x" } };
  pageview("/players", { env });
  pageview("/trade", { env });
  assert.deepEqual(rec.calls, [
    ["pageview", "/players", { utm_source: "reddit", referrer: "old.reddit.com" }],
    ["pageview", "/trade", {}],
  ]);
  resetAnalytics();
});

test("events carry the route template they happened on", () => {
  const rec = withAdapter();
  const calls = [];
  setAnalyticsAdapter({ pageview() {}, event(name, props, context) { calls.push([name, props, context]); } });
  track("trade_checked", { mode: "public" }, { env: { ...LIVE, location: { hostname: "dynastyticker.com", pathname: "/t/AbC" } } });
  assert.deepEqual(calls, [["trade_checked", { mode: "public" }, { route: "/t/:code" }]]);
  assert.equal(rec.calls.length, 0);
  resetAnalytics();
});

test("the force-beacon flag works on a local host only and never beats DNT/GPC", () => {
  const rec = recorder();
  resetAnalytics();
  setAnalyticsAdapter(rec);
  const local = { location: { hostname: "127.0.0.1", pathname: "/" }, nav: { webdriver: true }, win: { __dtAnalyticsForceBeacon: true } };
  assert.equal(track("trade_checked", { mode: "public" }, { env: local }), true);
  assert.equal(track("league_connected", { sample: "no" }, { env: { ...local, nav: { webdriver: true, globalPrivacyControl: true } } }), false);
  assert.equal(track("share_tapped", { method: "copy" }, { env: { ...local, location: { hostname: "x--y.netlify.app" } } }), false);
  assert.equal(track("share_tapped", { method: "copy" }, { env: { ...local, win: {} } }), false);
  assert.equal(rec.calls.length, 1);
  resetAnalytics();
});
