// Daily player values without a production deploy.
//
// The refresh workflow builds and checks docs/data/player_values.json every day
// on develop, then publishes the same files to this Netlify Blobs store
// (scripts/publish_market_blobs.mjs). /data/player_values.json and
// /data/price-history/* are rewritten to the market function, which answers
// with whichever copy is newer: the one in the store, or the one bundled with
// the last release. A release never goes backwards, and a day with no publish
// still serves the release's files.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isCurrentValueBoard } from "../../docs/modules/values.js";
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
  if (rel === "data/player_values.json") {
    const bundledIsCurrent = isCurrentValueBoard(bundled);
    const storedIsCurrent = isCurrentValueBoard(stored);
    if (!storedIsCurrent) return bundledIsCurrent ? "bundled" : null;
    if (!bundledIsCurrent) return "stored";
    const key = (p) => String(p.generatedAt || p.asOf || "");
    return key(stored) > key(bundled) ? "stored" : "bundled";
  }
  if (!stored) return bundled ? "bundled" : null;
  if (!bundled) return "stored";
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
  // Keep a previously published board through a transient Blobs outage.
  const previousStored = hit?.value.source === "stored" ? hit.value.text : null;
  const [bundledText, storedText] = await Promise.all([
    readBundled(rel),
    store ? store.get(rel, { type: "text" }).catch(() => previousStored) : previousStored,
  ]);
  const pick = newerCopy(rel, bundledText, storedText);
  if (!pick) return null;
  const text = pick === "stored" ? storedText : bundledText;
  const etag = `W/"${createHash("sha256").update(text).digest("base64url")}"`;
  const value = { text, source: pick, etag };
  cache.set(rel, { at: now, value });
  return value;
}

export function createMarketHandler({ getStore = () => null } = {}) {
  return async function marketHandler(req) {
    const url = new URL(req.url);
    // A Netlify rewrite hands the function the original request URL
    // (/data/player_values.json), not the rewrite target, so read the file
    // from the path. ?file= still works for a direct call.
    const fromPath = url.pathname.replace(/^\/+/, "");
    const rel = fromPath.startsWith("data/")
      ? fromPath
      : `data/${String(url.searchParams.get("file") || "").replace(/^\/+/, "")}`;
    if (!isMarketFile(rel)) return new Response("Not found", { status: 404 });
    let store = null;
    try {
      store = getStore();
    } catch {
      store = null;
    }
    const file = await readMarketFile(rel, { store });
    if (!file) return new Response("Not found", { status: 404 });
    const headers = {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
      "netlify-cdn-cache-control": "public, max-age=300, stale-while-revalidate=60",
      "x-market-source": file.source,
      etag: file.etag,
    };
    const validators = (req.headers.get("if-none-match") || "").split(",").map(token => token.trim());
    const canRevalidate = req.method === "GET" || req.method === "HEAD";
    if (canRevalidate && validators.some(tag => tag === "*" || tag.replace(/^W\//, "") === file.etag.slice(2))) {
      return new Response(null, { status: 304, headers });
    }
    return new Response(req.method === "HEAD" ? null : file.text, { headers });
  };
}
