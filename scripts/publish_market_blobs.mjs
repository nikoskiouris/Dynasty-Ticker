#!/usr/bin/env node
// Publish today's checked player values to the live site without a deploy.
//
// Run by .github/workflows/refresh-player-values.yml after build_trade_values.py and
// check_market_files.py --fail-on-age pass. Writes the files the market
// function serves (netlify/lib/market-data.js): player_values.json, the price
// history index, and any dated snapshot the store does not have yet.
//
// --check-only verifies the local files without credentials or network writes.
// --check-live ORIGIN compares the served board and its dated share snapshot.
// --archive-only preserves the release board's immutable share snapshot.
// MARKET_PUBLISH=off disables the daily update to live prices and their index.
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { getStore } from "@netlify/blobs";
import { MARKET_STORE, isMarketFile } from "../netlify/lib/market-data.js";
import { priceStamp, snapshotPath } from "../docs/modules/trade-share.js";
import { PLAYER_VALUE_MODEL_VERSION } from "../docs/modules/values.js";

const ROOT = new URL("..", import.meta.url).pathname;

function validPrice(price) {
  return Number.isFinite(price) && price > 0 && price <= 100 && Math.round(price * 100) / 100 === price;
}

async function saveSnapshot(store, rel, text) {
  const { modified } = await store.set(rel, text, { onlyIfNew: true });
  if (!modified) {
    const existing = await store.get(rel, { type: "json", consistency: "strong" });
    if (!isDeepStrictEqual(existing, JSON.parse(text))) {
      throw new Error(`Archive ${rel} already belongs to different prices.`);
    }
  }
}

function sameDatedBoard(board, archive) {
  return archive?.modelVersion === board.modelVersion && archive.valueScale === board.valueScale &&
    archive.asOf === board.asOf && isDeepStrictEqual(archive.sf, board.sf);
}

async function checkLive(origin, release) {
  async function read(path) {
    const url = new URL(path, origin);
    url.searchParams.set("deploycheck", String(Date.now()));
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}.`);
    return response.json();
  }
  const board = await read("/data/player_values.json");
  const stamp = priceStamp(board.asOf);
  if (!stamp || board.modelVersion !== release.modelVersion || board.valueScale !== release.valueScale ||
      Date.parse(board.asOf) < Date.parse(release.asOf) || Object.keys(board.sf || {}).length < 300 ||
      !Object.values(board.sf).every(validPrice) || (board.asOf === release.asOf && !sameDatedBoard(board, release))) {
    throw new Error("The served board does not match this release or a newer compatible daily refresh.");
  }
  if (!sameDatedBoard(board, await read(snapshotPath(stamp)))) {
    throw new Error(`Served archive ${stamp} differs from the served prices.`);
  }
  console.log(`Verified live ${board.modelVersion}, ${Object.keys(board.sf).length} asset prices and archive ${stamp}.`);
}

async function main() {
  const [mode = "--publish", origin, ...extra] = process.argv.slice(2);
  if (!["--publish", "--archive-only", "--check-only", "--check-live"].includes(mode) ||
      (mode === "--check-live") !== Boolean(origin) || extra.length) {
    throw new Error("Usage: publish_market_blobs.mjs [--archive-only | --check-only | --check-live ORIGIN]");
  }
  if (mode === "--publish" && String(process.env.MARKET_PUBLISH || "").toLowerCase() === "off") {
    console.log("MARKET_PUBLISH=off: not publishing.");
    return;
  }
  const read = (rel) => readFile(join(ROOT, "docs", rel), "utf8");
  const values = await read("data/player_values.json");
  const parsed = JSON.parse(values);
  if (parsed.modelVersion !== PLAYER_VALUE_MODEL_VERSION) throw new Error(`Unexpected modelVersion ${parsed.modelVersion}; not publishing.`);
  if (!parsed.sf || Object.keys(parsed.sf).length < 300) throw new Error("player_values.json has too few prices; not publishing.");
  if (parsed.valueScale !== 100 || !Object.values(parsed.sf).every(validPrice)) {
    throw new Error("Prices must be on the 0–100 scale in hundredths.");
  }
  if (mode === "--check-live") return checkLive(origin, parsed);
  const index = await read("data/price-history/index.json");
  const history = JSON.parse(index);
  const latest = history.snapshots?.find((row) =>
    row.modelVersion === PLAYER_VALUE_MODEL_VERSION && row.valueScale === 100 && row.asOf === parsed.asOf);
  const stamp = priceStamp(parsed.asOf);
  if (!stamp || latest?.stamp !== stamp) {
    throw new Error("Current values have no matching dated archive; not publishing.");
  }

  const archivePath = `data/price-history/${latest.stamp}.json`;
  const archiveText = await read(archivePath);
  const archive = JSON.parse(archiveText);
  if (!sameDatedBoard(parsed, archive)) {
    throw new Error("Dated archive does not match the current price scale and values.");
  }

  if (mode === "--check-only") {
    console.log(`Validated ${PLAYER_VALUE_MODEL_VERSION} snapshot and archive ${latest.stamp}.`);
    return;
  }
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_AUTH_TOKEN;
  if (!siteID || !token) throw new Error("NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN are required.");

  const store = getStore({ name: MARKET_STORE, siteID, token });
  await saveSnapshot(store, archivePath, archiveText);
  if (mode === "--archive-only") {
    console.log(`Preserved release archive ${latest.stamp}.`);
    return;
  }
  const { blobs } = await store.list({ prefix: "data/price-history/" });
  const have = new Set(blobs.map((blob) => blob.key));
  const snapshots = (await readdir(join(ROOT, "docs/data/price-history")))
    .filter((name) => /^\d{12}\.json$/.test(name))
    .map((name) => `data/price-history/${name}`)
    .filter((rel) => rel !== archivePath && isMarketFile(rel) && !have.has(rel));

  // Snapshots first, then the index that lists them, then the prices: a reader
  // never sees a stamp whose snapshot is missing.
  for (const rel of snapshots) {
    const text = await read(rel);
    JSON.parse(text);
    await saveSnapshot(store, rel, text);
    console.log(`published ${rel}`);
  }
  await store.set("data/price-history/index.json", index);
  await store.set("data/player_values.json", values);
  console.log(`published data/player_values.json (asOf ${parsed.asOf}, generatedAt ${parsed.generatedAt})`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
