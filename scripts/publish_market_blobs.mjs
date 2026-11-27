#!/usr/bin/env node
// Publish today's checked player values to the live site without a deploy.
//
// Run by .github/workflows/refresh-player-values.yml after build_trade_values.py and
// check_market_files.py --fail-on-age pass. Writes the files the market
// function serves (netlify/lib/market-data.js): player_values.json, the price
// history index, and any dated snapshot the store does not have yet.
//
// Needs NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID. MARKET_PUBLISH=off skips it.
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { getStore } from "@netlify/blobs";
import { MARKET_STORE, isMarketFile, marketBlobKey } from "../netlify/lib/market-data.js";

const ROOT = new URL("..", import.meta.url).pathname;
const MODEL_VERSION = "sleeper-trades-v5";

async function main() {
  if (String(process.env.MARKET_PUBLISH || "").toLowerCase() === "off") {
    console.log("MARKET_PUBLISH=off: not publishing.");
    return;
  }
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_AUTH_TOKEN;
  if (!siteID || !token) throw new Error("NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN are required.");

  const read = (rel) => readFile(join(ROOT, "docs", rel), "utf8");
  const values = await read("data/player_values.json");
  const parsed = JSON.parse(values);
  if (parsed.modelVersion !== MODEL_VERSION) throw new Error(`Unexpected modelVersion ${parsed.modelVersion}; not publishing.`);
  if (!parsed.sf || Object.keys(parsed.sf).length < 300) throw new Error("player_values.json has too few prices; not publishing.");
  const index = await read("data/price-history/index.json");
  JSON.parse(index);

  const store = getStore({ name: MARKET_STORE, siteID, token });
  const { blobs } = await store.list({ prefix: "data/price-history/" });
  const have = new Set(blobs.map((blob) => blob.key));
  const snapshots = (await readdir(join(ROOT, "docs/data/price-history")))
    .filter((name) => /^\d{12}\.json$/.test(name))
    .map((name) => `data/price-history/${name}`)
    .filter((rel) => isMarketFile(rel) && !have.has(rel));

  // Snapshots first, then the index that lists them, then the prices: a reader
  // never sees a stamp whose snapshot is missing.
  for (const rel of snapshots) {
    const text = await read(rel);
    JSON.parse(text);
    await store.set(rel, text);
    console.log(`published ${rel}`);
  }
  await store.set(marketBlobKey("data/price-history/index.json", parsed.modelVersion), index);
  await store.set(marketBlobKey("data/player_values.json", parsed.modelVersion), values);
  console.log(`published data/player_values.json (asOf ${parsed.asOf}, generatedAt ${parsed.generatedAt})`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
