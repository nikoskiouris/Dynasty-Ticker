// Daily player values without a production deploy.
//
// The refresh workflow builds and checks docs/data/player_values.json every day
// on develop, then publishes the same files to this Netlify Blobs store
// (scripts/publish_market_blobs.mjs). /data/player_values.json and
// /data/price-history/* are rewritten to the market function, which answers
// with whichever copy is newer: the one in the store, or the one bundled with
// the last release. A release never goes backwards, and a day with no publish
// still serves the release's files.
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const MARKET_STORE = "market-data";
export const MARKET_TTL_MS = 5 * 60 * 1000;

// Only these files are served. Anything else is a 404.
const ALLOWED = /^data\/(?:player_values\.json|price-history\/(?:index|\d{12})\.json)$/;

export function isMarketFile(rel) {
  return ALLOWED.test(String(rel || ""));
}

export async function readBundledFile(rel) {
  for (const base of [process.cwd(), join(process.cwd(), "..")]) {
    try {
      return await readFile(join(base, "docs", rel), "utf8");
    } catch {
      // try the next place
    }
  }
  return null;
}

function parse(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

// Which copy is newer. Values compare generatedAt (then asOf); the price
// history index compares its newest stamp. A dated snapshot never changes, so
// either copy will do and the bundled one wins.
export function newerCopy(rel, bundledText, storedText) {
  const bundled = parse(bundledText);
  const stored = parse(storedText);
  if (!stored) return bundled ? "bundled" : null;
  if (!bundled) return "stored";
  if (rel === "data/player_values.json") {
    if (stored.modelVersion !== bundled.modelVersion) return "bundled";
    const key = (p) => String(p.generatedAt || p.asOf || "");
    return key(stored) > key(bundled) ? "stored" : "bundled";
  }
  if (rel === "data/price-history/index.json") {
    const newest = (p) => (Array.isArray(p.snapshots) ? p.snapshots : []).map((row) => String(row?.stamp || "")).sort().pop() || "";
    return newest(stored) > newest(bundled) ? "stored" : "bundled";
  }
  return "bundled";
}

const cache = new Map();

export async function readMarketFile(rel, { store = null, now = Date.now(), readBundled = readBundledFile } = {}) {
  if (!isMarketFile(rel)) return null;
  const hit = cache.get(rel);
  if (hit && now - hit.at < MARKET_TTL_MS) return hit.value;
  const bundledText = await readBundled(rel);
  let storedText = null;
  if (store) {
    try {
      storedText = await store.get(rel, { type: "text" });
    } catch {
      storedText = null;
    }
  }
  const pick = newerCopy(rel, bundledText, storedText);
  const value = pick ? { text: pick === "stored" ? storedText : bundledText, source: pick } : null;
  cache.set(rel, { at: now, value });
  return value;
}

export function createMarketHandler({ getStore = () => null } = {}) {
  return async function marketHandler(req) {
    const url = new URL(req.url);
    const rel = `data/${String(url.searchParams.get("file") || "").replace(/^\/+/, "")}`;
    if (!isMarketFile(rel)) return new Response("Not found", { status: 404 });
    let store = null;
    try {
      store = getStore();
    } catch {
      store = null;
    }
    const file = await readMarketFile(rel, { store });
    if (!file) return new Response("Not found", { status: 404 });
    return new Response(file.text, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        // Browsers revalidate, as for the static file before. The CDN keeps a
        // copy for five minutes so a busy day is not a function call per visit.
        "cache-control": "public, max-age=0, must-revalidate",
        "netlify-cdn-cache-control": "public, max-age=300, stale-while-revalidate=60",
        "x-market-source": file.source,
      },
    });
  };
}
