import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  cardVerdict,
  decodeTradeShare,
  isPriceStamp,
  sameVerdict,
  shareImagePath,
  sharePath,
  shareSummary,
  snapshotPath,
  stampLabel,
} from "../../docs/modules/trade-share.js";
import { FEWER_BETTER_ADDEND } from "../../docs/modules/verdict-copy.js";

export const SHARE_NAMES_STORE = "share-names";
export const SHARE_NAMES_KEY = "sleeper-player-names-v1";
const NAMES_TTL_MS = 24 * 60 * 60 * 1000;
const VALUES_TTL_MS = 10 * 60 * 1000;
export const SITE_ORIGIN = "https://dynastyticker.com";
export const PAGE_CACHE = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";
export const CARD_CACHE = "public, max-age=31536000, immutable";
export const PAGE_CSP = "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' https://sleepercdn.com https://*.sleepercdn.com; connect-src 'self' https://api.sleeper.app; form-action 'self'; frame-src 'none'";
export const SAFE_HEADERS = Object.freeze({ "x-content-type-options": "nosniff", "x-frame-options": "DENY" });

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

// Every string that lands in HTML or SVG goes through here, attributes included.
export function escapeMarkup(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

export function codeFromPath(pathname, { suffix = "" } = {}) {
  const last = String(pathname || "").split("?")[0].replace(/\/+$/, "").split("/").pop() || "";
  let code = last;
  try {
    code = decodeURIComponent(last);
  } catch {
    return "";
  }
  if (suffix) {
    if (!code.endsWith(suffix)) return "";
    code = code.slice(0, -suffix.length);
  }
  return code;
}

// og:title and og:description use the card's own verdict and credited totals,
// so the text, the card and the % never disagree (H2 in review-164).
// today: the live board's summary when prices moved since the link was made.
// The preview then says both, in the same neutral words.
export function shareText(summary, { today = null } = {}) {
  const list = (rows) => rows.map((row) => row.name).join(", ");
  const verdict = cardVerdict(summary);
  const n = (value) => Math.round(value).toLocaleString("en-US");
  const side = (key, label) => {
    const credited = summary.credit?.side === key;
    const listed = key === "give" ? summary.giveTotal : summary.getTotal;
    const total = key === "give" ? summary.giveCredited : summary.getCredited;
    return credited ? `${label} ${n(listed)} + ${n(summary.credit.amount)} ${FEWER_BETTER_ADDEND} = ${n(total)}` : `${label} ${n(total)}`;
  };
  const verdictText = verdict.line;
  return {
    title: `${list(summary.give)} for ${list(summary.get)}: ${verdictText}`.slice(0, 160),
    description: `${side("give", "Give")} vs ${side("get", "get")}. Prices${summary.stamp ? ` as of ${stampLabel(summary.stamp, { year: true })}` : ""}, ${summary.formatLabel}.${today ? ` Today: ${cardVerdict(today).line}.` : ""} Check your own trade free at Dynasty Ticker.`,
    alt: `${verdictText}. Give ${n(summary.giveCredited)}, get ${n(summary.getCredited)}.`,
  };
}

// Swap the page's default social tags for the trade's. Bots read these without JS.
export function injectShareMeta(html, { summary, today = null, code, origin = SITE_ORIGIN, version = "" }) {
  const { title, description, alt } = shareText(summary, { today });
  const url = `${origin}${sharePath(code)}`;
  const image = `${origin}${shareImagePath(code, version)}`;
  const tags = [
    `<meta property="og:title" content="${escapeMarkup(title)}" />`,
    `<meta property="og:description" content="${escapeMarkup(description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${escapeMarkup(url)}" />`,
    `<meta property="og:image" content="${escapeMarkup(image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${escapeMarkup(alt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeMarkup(title)}" />`,
    `<meta name="twitter:description" content="${escapeMarkup(description)}" />`,
    `<meta name="twitter:image" content="${escapeMarkup(image)}" />`,
    `<link rel="canonical" href="${escapeMarkup(url)}" />`,
  ].join("\n    ");
  const stripped = String(html)
    .replace(/\s*<meta (?:property="og:[^"]*"|name="twitter:[^"]*")[^>]*>/g, "")
    .replace(/\s*<link rel="canonical"[^>]*>/g, "")
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeMarkup(title)} | Dynasty Ticker</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${escapeMarkup(description)}" />`);
  return stripped.replace("</head>", `    ${tags}\n  </head>`);
}

let valuesCache = null;
let namesCache = null;

async function readSiteFile(rel, origin) {
  for (const base of [process.cwd(), join(process.cwd(), "..")]) {
    try {
      return await readFile(join(base, "docs", rel), "utf8");
    } catch {
      // try the next place
    }
  }
  const res = await fetch(`${origin}/${rel}`);
  if (!res.ok) throw new Error(`${rel} ${res.status}`);
  return res.text();
}

export async function loadValues({ origin = SITE_ORIGIN, now = Date.now() } = {}) {
  if (valuesCache && now - valuesCache.at < VALUES_TTL_MS) return valuesCache.payload;
  const payload = JSON.parse(await readSiteFile("data/player_values.json", origin));
  valuesCache = { at: now, payload };
  return payload;
}

export function compactSleeperNames(players = {}) {
  const names = {};
  for (const [id, row] of Object.entries(players || {})) {
    if (!/^\d{1,12}$/.test(id)) continue;
    const name = String(row?.full_name || [row?.first_name, row?.last_name].filter(Boolean).join(" ")).trim();
    if (name) names[id] = name.slice(0, 40);
  }
  return names;
}

// Sleeper asks for /players/nfl at most once a day. One fetch fills a blob
// that every function instance shares, so a traffic spike never fans out to Sleeper.
export async function loadPlayerNames({ store = null, fetchImpl = fetch, now = Date.now() } = {}) {
  if (namesCache && now - namesCache.at < NAMES_TTL_MS) return namesCache.names;
  if (store) {
    try {
      const hit = await store.get(SHARE_NAMES_KEY, { type: "json" });
      if (hit?.names && now - Number(hit.at || 0) < NAMES_TTL_MS) {
        namesCache = { at: Number(hit.at), names: hit.names };
        return hit.names;
      }
    } catch {
      // fall through to Sleeper
    }
  }
  try {
    const res = await fetchImpl("https://api.sleeper.app/v1/players/nfl");
    if (!res.ok) throw new Error(`sleeper ${res.status}`);
    const names = compactSleeperNames(await res.json());
    namesCache = { at: now, names };
    if (store) await store.setJSON(SHARE_NAMES_KEY, { at: now, names }).catch(() => {});
    return names;
  } catch {
    return namesCache?.names || {};
  }
}

export function valuesVersion(payload) {
  return String(payload?.asOf || "").replace(/[^0-9]/g, "").slice(0, 12);
}

const snapshotCache = new Map();

// The archived board for a stamp, or null. The stamp is checked before any
// read, so a tampered code can only miss, never reach another file.
export async function loadSnapshot(stamp, { origin = SITE_ORIGIN } = {}) {
  if (!isPriceStamp(stamp)) return null;
  if (snapshotCache.has(stamp)) return snapshotCache.get(stamp);
  let payload = null;
  try {
    payload = JSON.parse(await readSiteFile(snapshotPath(stamp).slice(1), origin));
    if (!payload?.sf || !payload?.oneQb) payload = null;
  } catch {
    payload = null;
  }
  if (snapshotCache.size > 64) snapshotCache.clear();
  snapshotCache.set(stamp, payload);
  return payload;
}

// shared: what the sharer saw (null when the code has no stamp or the archive
// lacks it). today: the live board. summary: shared when there is one.
export async function summaryForCode(code, deps = {}) {
  const decoded = decodeTradeShare(code);
  if (!decoded) return null;
  const [payload, names, snapshot] = await Promise.all([
    (deps.loadValues || loadValues)(deps),
    (deps.loadPlayerNames || loadPlayerNames)(deps),
    decoded.stamp ? (deps.loadSnapshot || loadSnapshot)(decoded.stamp, deps) : null,
  ]);
  const today = shareSummary(decoded, payload, names);
  const shared = snapshot ? shareSummary(decoded, snapshot, names, payload) : null;
  const summary = shared || today;
  return {
    decoded,
    shared,
    today,
    summary,
    same: shared ? sameVerdict(shared, today) : true,
    version: shared ? decoded.stamp : valuesVersion(payload),
  };
}

export function markNoindex(html) {
  const page = String(html);
  if (/<meta name="robots"/.test(page)) return page.replace(/<meta name="robots"[^>]*>/, '<meta name="robots" content="noindex" />');
  return page.replace("</head>", '    <meta name="robots" content="noindex" />\n  </head>');
}

export function createSharePageHandler(deps = {}) {
  return async (req) => {
    const url = new URL(req.url);
    const origin = deps.origin || SITE_ORIGIN;
    const html = await (deps.readIndex || (() => readSiteFile("index.html", origin)))();
    const code = url.searchParams.get("code") || codeFromPath(url.pathname);
    // A code that does not decode is a broken link: 404, noindex, default tags.
    // The app still loads and shows "This trade link is broken or expired".
    if (!decodeTradeShare(code)) {
      return new Response(markNoindex(html), {
        status: 404,
        headers: {
          ...SAFE_HEADERS,
          "content-security-policy": PAGE_CSP,
          "content-type": "text/html; charset=utf-8",
          "x-robots-tag": "noindex",
          "cache-control": "public, max-age=300",
        },
      });
    }
    const hit = await summaryForCode(code, deps).catch(() => null);
    // A valid code whose lookup failed still opens the trade, with the default tags.
    const body = hit?.summary ? injectShareMeta(html, { summary: hit.summary, today: hit.same ? null : hit.today, code, origin, version: hit.version }) : html;
    return new Response(body, {
      status: 200,
      headers: {
        ...SAFE_HEADERS,
        "content-security-policy": PAGE_CSP,
        "content-type": "text/html; charset=utf-8",
        "cache-control": hit?.summary ? PAGE_CACHE : "public, max-age=0, must-revalidate",
      },
    });
  };
}
