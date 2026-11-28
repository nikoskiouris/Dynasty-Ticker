#!/usr/bin/env node
// Publish today's checked player values to the live site without a deploy.
//
// Run by .github/workflows/refresh-player-values.yml after build_trade_values.py and
// check_market_files.py --fail-on-age pass. Writes the files the market
// function serves (netlify/lib/market-data.js): player_values.json, the price
// history index, and any dated snapshot the store does not have yet.
//
// --check-only verifies the local files without credentials or network writes.
// Publishing needs NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID. MARKET_PUBLISH=off skips it.
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { getStore } from "@netlify/blobs";
import { MARKET_STORE, isMarketFile } from "../netlify/lib/market-data.js";

const ROOT = new URL("..", import.meta.url).pathname;
const MODEL_VERSION = "dynasty-sf-ppr-v4";

function validPrice(price) {
  return Number.isFinite(price) && price > 0 && price <= 100 && Math.round(price * 100) / 100 === price;
}

async function main() {
  const checkOnly = process.argv.includes("--check-only");
  if (!checkOnly && String(process.env.MARKET_PUBLISH || "").toLowerCase() === "off") {
    console.log("MARKET_PUBLISH=off: not publishing.");
    return;
  }
  const read = (rel) => readFile(join(ROOT, "docs", rel), "utf8");
  const values = await read("data/player_values.json");
  const parsed = JSON.parse(values);
  if (parsed.modelVersion !== MODEL_VERSION) throw new Error(`Unexpected modelVersion ${parsed.modelVersion}; not publishing.`);
  if (!parsed.sf || Object.keys(parsed.sf).length < 300) throw new Error("player_values.json has too few prices; not publishing.");
  if (parsed.valueScale !== 100 || !Object.values(parsed.sf).every(validPrice)) {
    throw new Error("Prices must be on the 0–100 scale in hundredths.");
  }
  const index = await read("data/price-history/index.json");
  const history = JSON.parse(index);
  const latest = history.snapshots?.find((row) =>
    row.modelVersion === MODEL_VERSION && row.valueScale === 100 && row.asOf === parsed.asOf);
  if (!latest || !/^20\d{10}$/.test(latest.stamp)) {
    throw new Error("Current values have no matching dated archive; not publishing.");
  }

  const archive = JSON.parse(await read(`data/price-history/${latest.stamp}.json`));
  if (archive.modelVersion !== MODEL_VERSION || archive.valueScale !== 100 || archive.asOf !== parsed.asOf ||
      !archive.sf || Object.keys(archive.sf).length !== Object.keys(parsed.sf).length ||
      Object.entries(parsed.sf).some(([key, price]) => archive.sf[key] !== price)) {
    throw new Error("Dated archive does not match the current price scale and values.");
  }

  if (checkOnly) {
    console.log(`Validated ${MODEL_VERSION} snapshot and archive ${latest.stamp}.`);
    return;
  }
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_AUTH_TOKEN;
  if (!siteID || !token) throw new Error("NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN are required.");

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
  await store.set("data/price-history/index.json", index);
  await store.set("data/player_values.json", values);
  console.log(`published data/player_values.json (asOf ${parsed.asOf}, generatedAt ${parsed.generatedAt})`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
