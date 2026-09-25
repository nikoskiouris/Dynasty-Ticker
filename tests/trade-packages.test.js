import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MAX_PACKAGE_CANDIDATES,
  MAX_TARGET_EXTRAS_POOL,
  MAX_TRADE_PAIR_EVALS,
  MAX_RAW_TRADE_IDEAS,
  binomial,
  combinationsOfSize,
  buildPackages,
  buildTargetPackages,
  walkPackagePairs,
} from "../docs/modules/trade-packages.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = readFileSync(join(root, "docs/app.js"), "utf8");

function asset(id, name = id) {
  return { assetId: id, name };
}

function valueFn(asset, values) {
  return values[asset.assetId];
}

function pool(count, startValue = 9000, step = 280) {
  const assets = Array.from({ length: count }, (_, index) => asset(`a${index}`));
  const values = Object.fromEntries(assets.map((item, index) => [item.assetId, startValue - index * step]));
  return { assets, values };
}

test("uncapped 18-choose-6 package search is tens of thousands of combos", () => {
  const uncapped = [1, 2, 3, 4, 5, 6].reduce((sum, size) => sum + binomial(18, size), 0);
  assert.equal(uncapped, 31179);
  assert.ok(MAX_PACKAGE_CANDIDATES < uncapped / 20);
});

test("capped package builder stays bounded on an elite 18-asset pool", () => {
  const { assets, values } = pool(18);
  const started = Date.now();
  const packages = buildPackages(assets, values, 6, {
    targetValue: 8200,
    getAssetValue: valueFn,
  });
  const elapsed = Date.now() - started;
  assert.ok(packages.length <= MAX_PACKAGE_CANDIDATES, `got ${packages.length} packages`);
  assert.ok(packages.length > 0);
  assert.ok(packages.every((pkg) => pkg.assets.length >= 1 && pkg.assets.length <= 6));
  assert.ok(elapsed < 80, `package build took ${elapsed}ms`);
});

test("required assets stay on every capped package", () => {
  const { assets, values } = pool(12, 5000, 200);
  const packages = buildPackages(assets, values, 3, {
    requiredAssetIds: new Set(["a0"]),
    targetValue: 5400,
    getAssetValue: valueFn,
  });
  assert.ok(packages.length > 0);
  assert.ok(packages.every((pkg) => pkg.assets.some((item) => item.assetId === "a0")));
});

test("target throw-ins use a short extras pool", () => {
  const target = asset("star");
  const extras = Array.from({ length: 24 }, (_, index) => asset(`x${index}`));
  const values = { star: 8000, ...Object.fromEntries(extras.map((item, index) => [item.assetId, 400 + index * 90])) };
  const packages = buildTargetPackages({
    theirRoster: { assets: [target, ...extras] },
    targetAsset: target,
    values,
    allowExtraTargetAssets: true,
    maxExtraAssets: 3,
    maxExtraAssetShare: 0.5,
    maxExtraTotalShare: 0.85,
    getAssetValue: valueFn,
  });
  const extraIds = new Set();
  packages.forEach((pkg) => {
    pkg.assets.slice(1).forEach((item) => extraIds.add(item.assetId));
  });
  assert.ok(packages.some((pkg) => pkg.assets.length === 1));
  assert.ok(extraIds.size <= MAX_TARGET_EXTRAS_POOL);
});

test("pair walker stops after the eval and hit budgets", () => {
  const myPackages = Array.from({ length: 200 }, (_, index) => ({
    assets: [asset(`m${index}`)],
    values: [4000 + (index % 9) * 40],
  }));
  const theirPackages = Array.from({ length: 200 }, (_, index) => ({
    assets: [asset(`t${index}`)],
    values: [4000 + (index % 11) * 35],
  }));
  let visits = 0;
  const result = walkPackagePairs(myPackages, theirPackages, {
    fairnessPct: 20,
    visit() {
      visits += 1;
      return visits % 3 === 0;
    },
  });
  assert.ok(visits <= MAX_TRADE_PAIR_EVALS);
  assert.ok(result.evals <= MAX_TRADE_PAIR_EVALS);
  assert.ok(result.hits <= MAX_RAW_TRADE_IDEAS);
  assert.equal(visits, result.evals);
});

test("combinations helper honors an explicit limit", () => {
  const items = [1, 2, 3, 4, 5, 6];
  assert.equal(combinationsOfSize(items, 3).length, 20);
  assert.equal(combinationsOfSize(items, 3, { limit: 5 }).length, 5);
});

test("desk uses the capped search and cached calculator baseline", () => {
  assert.match(app, /from "\.\/modules\/trade-packages\.js"/);
  assert.match(app, /walkPackagePairs/);
  assert.match(app, /getCachedLeagueStrengthBaseline/);
  assert.match(app, /patchTradeDraft\(\[side\]\)/);
  assert.match(app, /OUTGOING_POOL_LIMIT = 14/);
  assert.match(app, /DEFAULT_MAX_OUTGOING_PACKAGE_SIZE = 3/);
  assert.match(app, /ELITE_MAX_OUTGOING_PACKAGE_SIZE = 4/);
  assert.match(app, /await waitForNextPaint\(\)/);
  const shop = app.slice(
    app.indexOf("async function generateShopIdeaBuckets"),
    app.indexOf("function suggestShopDealsWithRoster"),
  );
  assert.ok(shop.indexOf("await waitForNextPaint()") < shop.indexOf("suggestShopDealsWithRoster("));
  assert.match(app, /Player names still syncing/);
  assert.match(app, /if \(el\.generateBtn\?\.classList\.contains\("loading"\)\) return;/);
  assert.doesNotMatch(app, /function getGlobalMaxPlayerValue/);
  assert.doesNotMatch(app, /function ordinal\(/);
  assert.doesNotMatch(
    app.slice(app.indexOf("function suggestTrades"), app.indexOf("function buildTradeSearchContext")),
    /for \(const myPackage of myPackages\) \{\s*for \(const theirPackage of theirPackages\)/
  );
});
