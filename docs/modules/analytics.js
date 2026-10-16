// Provider-agnostic, first-party analytics layer.
//
// Nothing here talks to the network. Calls go to an adapter, and the default
// adapter is a no-op. A provider is wired up later by passing an adapter
// ({ pageview(route, context), event(name, props) }) to setAnalyticsAdapter.
//
// Privacy rules enforced here, whatever the adapter is:
// - Opt out under Do Not Track, Global Privacy Control, localhost, Netlify
//   deploy previews / branch deploys, and automation (navigator.webdriver).
// - Routes are sent as templates (/l/:id, /player/:id, /t/:code). No query
//   string, league id, player id, share code or username leaves the page.
// - Only allowlisted event names and property keys go out, and every property
//   value must come from a fixed enum. No free text.
// - Each occurrence fires once: repeat renders of the same occurrence are dropped.

export const ANALYTICS_EVENTS = Object.freeze({
  landing_view: Object.freeze({}),
  trade_checked: Object.freeze({ mode: Object.freeze(["league", "public"]) }),
  share_tapped: Object.freeze({ method: Object.freeze(["webshare", "copy"]) }),
  t_opened: Object.freeze({ drift: Object.freeze(["yes", "no"]) }),
  league_connected: Object.freeze({ sample: Object.freeze(["yes", "no"]) }),
});

export const UTM_KEYS = Object.freeze(["utm_source", "utm_medium", "utm_campaign"]);
const UTM_VALUE = /^[a-z0-9][a-z0-9._-]{0,39}$/;

export const NOOP_ADAPTER = Object.freeze({
  pageview() {},
  event() {},
});

const TEST_ADAPTER_KEY = "__dtAnalyticsTestAdapter";

let adapter = NOOP_ADAPTER;
let lastRoute = "";
const lastOccurrence = new Map();

function isAdapter(value) {
  return Boolean(value) && typeof value.pageview === "function" && typeof value.event === "function";
}

export function setAnalyticsAdapter(next) {
  adapter = isAdapter(next) ? next : NOOP_ADAPTER;
}

export function resetAnalytics() {
  adapter = NOOP_ADAPTER;
  lastRoute = "";
  lastOccurrence.clear();
}

export function isLocalHost(hostname = "") {
  const host = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost"
    || host.endsWith(".localhost")
    || host === "::1"
    || host === "0.0.0.0"
    || /^127\./.test(host)
    || host.endsWith(".local");
}

// deploy-preview-12--site.netlify.app, branch--site.netlify.app, <hash>--site.netlify.app
export function isPreviewHost(hostname = "") {
  const host = String(hostname || "").toLowerCase();
  return /--[a-z0-9-]+\.netlify\.app$/.test(host) || host.startsWith("deploy-preview-");
}

export function privacySignalOn(nav = globalThis.navigator, win = globalThis.window) {
  const dnt = nav?.doNotTrack ?? win?.doNotTrack ?? nav?.msDoNotTrack;
  if (dnt === "1" || dnt === "yes" || dnt === 1) return true;
  return nav?.globalPrivacyControl === true;
}

export function optOutReason({
  nav = globalThis.navigator,
  win = globalThis.window,
  location = globalThis.location,
} = {}) {
  if (privacySignalOn(nav, win)) return "privacy-signal";
  if (nav?.webdriver === true) return "automation";
  const host = location?.hostname || "";
  if (!host) return "no-host";
  if (isLocalHost(host)) return "localhost";
  if (isPreviewHost(host)) return "preview";
  return "";
}

// A test adapter is honoured only on a local host, so e2e can watch events
// without weakening the opt-outs anywhere real users are.
function testAdapter(win, location) {
  const candidate = win?.[TEST_ADAPTER_KEY];
  return isAdapter(candidate) && isLocalHost(location?.hostname) ? candidate : null;
}

function activeAdapter(env = {}) {
  const win = env.win ?? globalThis.window;
  const location = env.location ?? globalThis.location;
  const injected = testAdapter(win, location);
  if (injected) return injected;
  if (optOutReason({ ...env, win, location })) return null;
  return adapter;
}

const ROUTE_TEMPLATES = [
  [/^\/$/, "/"],
  [/^\/players\/?$/, "/players"],
  [/^\/trade\/?$/, "/trade"],
  [/^\/connect\/?$/, "/connect"],
  [/^\/l\/[^/]+\/?$/, "/l/:id"],
  [/^\/l\/[^/]+\/(team|ideas|league)\/?$/, "/l/:id/$1"],
  [/^\/player\/[^/]+(?:\/[^/]*)?\/?$/, "/player/:id"],
  [/^\/t\/[^/]+\/?$/, "/t/:code"],
];

export function placeholderRoute(pathname = "/") {
  let path = String(pathname || "/").split(/[?#]/)[0] || "/";
  if (/^https?:\/\//i.test(path)) {
    try {
      path = new URL(path).pathname;
    } catch {
      return "/other";
    }
  }
  if (!path.startsWith("/")) path = `/${path}`;
  for (const [pattern, template] of ROUTE_TEMPLATES) {
    const hit = path.match(pattern);
    if (hit) return template.replace("$1", hit[1] || "");
  }
  return "/other";
}

export function campaignFrom(search = "") {
  const params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  const out = {};
  for (const key of UTM_KEYS) {
    const value = String(params.get(key) || "").trim().toLowerCase();
    if (UTM_VALUE.test(value)) out[key] = value;
  }
  return out;
}

export function referrerHost(referrer = "", ownHost = "") {
  try {
    const host = new URL(String(referrer || "")).hostname.toLowerCase().replace(/^www\./, "");
    const own = String(ownHost || "").toLowerCase().replace(/^www\./, "");
    return host && host !== own ? host : "";
  } catch {
    return "";
  }
}

export function cleanProps(name, props = {}) {
  const schema = ANALYTICS_EVENTS[name];
  if (!schema) return null;
  const out = {};
  for (const [key, allowed] of Object.entries(schema)) {
    const value = props?.[key];
    if (value === undefined) continue;
    if (!allowed.includes(value)) return null;
    out[key] = value;
  }
  return out;
}

// Returns true when the event was handed to an adapter.
// `once` is an occurrence key: the same key twice in a row for one event is dropped.
export function track(name, props = {}, { once = "", env = {} } = {}) {
  const clean = cleanProps(name, props);
  if (!clean) return false;
  if (once) {
    const key = String(once);
    if (lastOccurrence.get(name) === key) return false;
    lastOccurrence.set(name, key);
  }
  const sink = activeAdapter(env);
  if (!sink) return false;
  try {
    sink.event(name, clean);
  } catch {
    // Analytics never breaks the desk.
  }
  return true;
}

// One pageview per route change. Replays of the same route are dropped.
// Returns true when the route changed (even if opted out, nothing is sent).
export function pageview(route = globalThis.location?.pathname || "/", {
  search = "",
  referrer = "",
  env = {},
} = {}) {
  const template = placeholderRoute(route);
  if (template === lastRoute) return false;
  lastRoute = template;
  const sink = activeAdapter(env);
  if (!sink) return true;
  const location = env.location ?? globalThis.location;
  const context = { ...campaignFrom(search) };
  const host = referrerHost(referrer, location?.hostname);
  if (host) context.referrer = host;
  try {
    sink.pageview(template, context);
  } catch {
    // Analytics never breaks the desk.
  }
  return true;
}

// Hooks for #164 (shareable trade links). The /trade Share button calls
// trackShareTapped("webshare" | "copy") once per completed share (a cancelled
// sheet or a manual-copy fallback sends nothing), and the first /t/<code> verdict render
// after the archive lookup calls trackTradeLinkOpened({ drift }) once per open.
export function trackShareTapped(method) {
  return track("share_tapped", { method });
}

export function trackTradeLinkOpened({ drift = false } = {}) {
  return track("t_opened", { drift: drift ? "yes" : "no" });
}
