// /player/<id>[/<slug>]: index.html with that player's title, description,
// canonical and og:/twitter: tags, so link previews (iMessage, Slack, Discord,
// X) and crawlers that skip JS see the player instead of the home page.
// The app sets the same title and canonical once it runs.
import { isPlayerRouteId, playerSlug } from "../../docs/modules/history-route.js";
import { PAGE_CACHE, PAGE_CSP, SAFE_HEADERS, SITE_ORIGIN, escapeMarkup, loadValues, markNoindex, readSiteFile } from "./trade-share.js";

const formatValue = (value) => Math.round(Number(value) || 0).toLocaleString("en-US");

// The raw id segment: "9488", "player:9488" or a pick ("pick:2027:r1:any").
export function routeIdFromPath(pathname) {
  const match = /^\/player\/([^/]+)(?:\/[^/]*)?\/?$/.exec(String(pathname || "").split("?")[0]);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return "";
  }
}

function sleeperId(routeId) {
  const id = String(routeId || "").replace(/^player:/, "");
  return /^\d{1,12}$/.test(id) ? id : "";
}

// null when the values file has no price for this id.
export function playerMeta(payload, id) {
  const assetId = `player:${id}`;
  const name = String(payload?.names?.[assetId] || "").trim();
  const value = Number(payload?.sf?.[assetId]);
  if (!name || !(value > 0)) return null;
  const model = payload?.players?.[assetId] || {};
  const position = String(model.position || "").toUpperCase();
  const team = String(model.team || "").toUpperCase() || "FA";
  const tag = [position, team].filter(Boolean).join(", ");
  return {
    path: `/player/${id}/${playerSlug(name)}`,
    title: `${name} · Dynasty Ticker`,
    // Ranks are left to the page: they depend on Sleeper's active-player list.
    description: `${name}${tag ? ` (${tag})` : ""} dynasty value: ${formatValue(value)} in 12-team Superflex PPR. See the rank, why, the trend and similar values.`,
  };
}

export function injectPlayerMeta(html, meta, origin = SITE_ORIGIN) {
  const url = `${origin}${meta.path}`;
  const title = escapeMarkup(meta.title);
  const description = escapeMarkup(meta.description);
  return String(html)
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${description}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${title}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${description}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${escapeMarkup(url)}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${title}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${description}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${escapeMarkup(url)}$2`);
}

const htmlHeaders = (cache) => ({
  ...SAFE_HEADERS,
  "content-security-policy": PAGE_CSP,
  "referrer-policy": "strict-origin-when-cross-origin",
  "content-type": "text/html; charset=utf-8",
  "cache-control": cache,
});

export function createPlayerPageHandler(deps = {}) {
  return async (req) => {
    const url = new URL(req.url);
    const origin = deps.origin || SITE_ORIGIN;
    const html = await (deps.readIndex || (() => readSiteFile("index.html", origin)))();
    // netlify.toml passes ?id=:id; the local server passes the path.
    const routeId = url.searchParams.has("id") ? String(url.searchParams.get("id") || "") : routeIdFromPath(url.pathname);
    const id = sleeperId(routeId);
    // A pick page (/player/pick:2027:r1:any): the plain page, the app titles it.
    if (!id && isPlayerRouteId(routeId)) return new Response(html, { status: 200, headers: htmlHeaders("public, max-age=0, must-revalidate") });
    const payload = id ? await (deps.loadValues || loadValues)(deps).catch(() => null) : null;
    // Prices didn't load: the plain page, uncached. The app retries on its own.
    if (id && !payload) return new Response(html, { status: 200, headers: htmlHeaders("public, max-age=0, must-revalidate") });
    const meta = id ? playerMeta(payload, id) : null;
    // No price for this id: the app says "We can't find that player". 404 + noindex.
    if (!meta) {
      return new Response(markNoindex(html), { status: 404, headers: { ...htmlHeaders("public, max-age=300"), "x-robots-tag": "noindex" } });
    }
    return new Response(injectPlayerMeta(html, meta, origin), { status: 200, headers: htmlHeaders(PAGE_CACHE) });
  };
}
