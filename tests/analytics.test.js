import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ANALYTICS_EVENTS,
  NOOP_ADAPTER,
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

test("default adapter is a no-op and the module makes no network calls", () => {
  resetAnalytics();
  assert.equal(typeof NOOP_ADAPTER.pageview, "function");
  const src = readFileSync(new URL("../docs/modules/analytics.js", import.meta.url), "utf8");
  for (const word of ["fetch(", "sendBeacon", "XMLHttpRequest", "WebSocket", "<script", "http://", "https://"]) {
    assert.equal(src.includes(word), false, `analytics.js must not contain ${word}`);
  }
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
  assert.deepEqual(Object.keys(ANALYTICS_EVENTS).sort(), ["landing_view", "league_connected", "share_tapped", "t_opened", "trade_checked"]);
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
