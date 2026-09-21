export const MAX_PACKAGE_CANDIDATES = 280;
export const MAX_PACKAGES_PER_SIZE = 80;
export const MAX_TARGET_EXTRAS_POOL = 8;
export const MAX_TRADE_PAIR_EVALS = 6000;
export const MAX_RAW_TRADE_IDEAS = 64;
export const PAIR_VALUE_SLACK_PCT = 28;

export function binomial(n, k) {
  const total = Number(n);
  const choose = Number(k);
  if (!Number.isInteger(total) || !Number.isInteger(choose) || choose < 0 || choose > total) return 0;
  const limited = Math.min(choose, total - choose);
  let result = 1;
  for (let i = 1; i <= limited; i += 1) {
    result = (result * (total - limited + i)) / i;
  }
  return Math.round(result);
}

export function combinationsOfSize(items, size, { limit = Infinity } = {}) {
  if (size === 0) return [[]];
  if (size > items.length) return [];

  const out = [];
  const stack = [];

  function walk(startIndex) {
    if (out.length >= limit) return;
    if (stack.length === size) {
      out.push(stack.slice());
      return;
    }
    for (let i = startIndex; i <= items.length - (size - stack.length); i += 1) {
      if (out.length >= limit) return;
      stack.push(items[i]);
      walk(i + 1);
      stack.pop();
    }
  }

  walk(0);
  return out;
}

export function packageTotal(pkg) {
  if (Number.isFinite(pkg?.total)) return pkg.total;
  if (Array.isArray(pkg?.values)) {
    return pkg.values.reduce((sum, value) => sum + (Number(value) || 0), 0);
  }
  return 0;
}

export function buildPackages(assets, values, maxAssets, {
  requiredAssetIds = new Set(),
  limit = MAX_PACKAGE_CANDIDATES,
  perSizeLimit = MAX_PACKAGES_PER_SIZE,
  targetValue = null,
  getAssetValue,
} = {}) {
  const valuedAssets = (assets || [])
    .map((asset) => ({ asset, value: readAssetValue(asset, values, getAssetValue) }))
    .filter((entry) => Number.isFinite(entry.value));
  const requiredEntries = valuedAssets.filter((entry) => requiredAssetIds.has(entry.asset.assetId));
  const optionalEntries = valuedAssets.filter((entry) => !requiredAssetIds.has(entry.asset.assetId));
  const requiredCount = requiredEntries.length;

  if (requiredCount > maxAssets) return [];

  const packages = [];
  const minimumPackageSize = requiredCount > 0 ? requiredCount : 1;
  const maxOptionalAssets = Math.min(maxAssets - requiredCount, optionalEntries.length);
  const requiredValue = requiredEntries.reduce((sum, entry) => sum + entry.value, 0);
  const rankedOptional = rankOptionalEntries(optionalEntries, targetValue, requiredValue);

  for (let size = minimumPackageSize; size <= Math.min(maxAssets, valuedAssets.length); size += 1) {
    const optionalSize = size - requiredCount;
    if (optionalSize < 0 || optionalSize > maxOptionalAssets) continue;
    const remaining = limit - packages.length;
    if (remaining <= 0) break;
    const sizeCap = Math.min(perSizeLimit, remaining);
    const combos = optionalSize === 0
      ? [[]]
      : pickBestCombos(rankedOptional, optionalSize, sizeCap, targetValue, requiredValue);
    for (const combo of combos) {
      const fullCombo = [...requiredEntries, ...combo];
      packages.push({
        assets: fullCombo.map((entry) => entry.asset),
        values: fullCombo.map((entry) => entry.value),
      });
    }
  }

  return packages;
}

export function buildTargetPackages({
  theirRoster,
  targetAsset,
  values,
  allowExtraTargetAssets,
  maxExtraAssets,
  maxExtraAssetShare = 0.3,
  maxExtraTotalShare = 0.55,
  extrasLimit = MAX_TARGET_EXTRAS_POOL,
  getAssetValue,
} = {}) {
  const targetValue = readAssetValue(targetAsset, values, getAssetValue);
  if (!Number.isFinite(targetValue)) return [];

  const packages = [{ assets: [targetAsset], values: [targetValue] }];
  if (!allowExtraTargetAssets) return packages;

  const maxThrowInValue = Math.max(900, Math.round(targetValue * maxExtraAssetShare));
  const maxThrowInTotalValue = Math.max(maxThrowInValue, Math.round(targetValue * maxExtraTotalShare));
  const extras = (theirRoster?.assets || [])
    .filter((asset) => asset.assetId !== targetAsset.assetId)
    .map((asset) => ({ asset, value: readAssetValue(asset, values, getAssetValue) }))
    .filter((entry) => Number.isFinite(entry.value) && entry.value <= maxThrowInValue && entry.value > 0)
    .sort((a, b) => a.value - b.value)
    .slice(0, extrasLimit);

  for (let size = 1; size <= Math.min(maxExtraAssets, extras.length); size += 1) {
    for (const combo of combinationsOfSize(extras, size)) {
      const comboTotal = combo.reduce((sum, entry) => sum + entry.value, 0);
      if (comboTotal > maxThrowInTotalValue) continue;
      packages.push({
        assets: [targetAsset, ...combo.map((entry) => entry.asset)],
        values: [targetValue, ...combo.map((entry) => entry.value)],
      });
    }
  }

  return packages;
}

export function walkPackagePairs(myPackages, theirPackages, {
  fairnessPct,
  maxEvals = MAX_TRADE_PAIR_EVALS,
  maxHits = MAX_RAW_TRADE_IDEAS,
  visit,
} = {}) {
  const mine = decoratePackageTotals(myPackages);
  const theirs = decoratePackageTotals(theirPackages);
  const slack = Math.max(PAIR_VALUE_SLACK_PCT, Number(fairnessPct) + 8);
  let evals = 0;
  let hits = 0;

  for (const myPackage of mine) {
    if (hits >= maxHits || evals >= maxEvals) break;
    for (const theirPackage of theirs) {
      if (hits >= maxHits || evals >= maxEvals) break;
      const denom = Math.max(myPackage.total, theirPackage.total, 1);
      if ((Math.abs(myPackage.total - theirPackage.total) / denom) * 100 > slack) continue;
      evals += 1;
      if (visit(myPackage, theirPackage)) hits += 1;
    }
  }

  return { evals, hits };
}

function readAssetValue(asset, values, getAssetValue) {
  if (typeof getAssetValue === "function") return getAssetValue(asset, values);
  const direct = Number(values?.[asset?.assetId]);
  return Number.isFinite(direct) ? direct : NaN;
}

function rankOptionalEntries(entries, targetValue, requiredValue) {
  const remaining = Number.isFinite(targetValue) ? Math.max(0, targetValue - requiredValue) : null;
  return entries.slice().sort((a, b) => {
    if (remaining != null) {
      const byGap = Math.abs(a.value - remaining) - Math.abs(b.value - remaining);
      if (byGap !== 0) return byGap;
    }
    return b.value - a.value;
  });
}

function pickBestCombos(entries, size, limit, targetValue, requiredValue) {
  if (size <= 0) return [[]];
  if (limit <= 0 || entries.length < size) return [];

  const enumerableCap = Math.max(limit * 4, 400);
  if (binomial(entries.length, size) <= enumerableCap) {
    return rankCombos(combinationsOfSize(entries, size), targetValue, requiredValue).slice(0, limit);
  }

  let poolSize = size;
  while (poolSize < entries.length && binomial(poolSize + 1, size) <= enumerableCap) {
    poolSize += 1;
  }
  return rankCombos(
    combinationsOfSize(entries.slice(0, poolSize), size),
    targetValue,
    requiredValue
  ).slice(0, limit);
}

function rankCombos(combos, targetValue, requiredValue) {
  const goal = Number.isFinite(targetValue) ? Math.max(0, targetValue - requiredValue) : null;
  return combos.slice().sort((a, b) => {
    const aTotal = sumEntryValues(a);
    const bTotal = sumEntryValues(b);
    if (goal != null) {
      const byGap = Math.abs(aTotal - goal) - Math.abs(bTotal - goal);
      if (byGap !== 0) return byGap;
    } else if (bTotal !== aTotal) {
      return bTotal - aTotal;
    }
    return a.length - b.length;
  });
}

function sumEntryValues(entries) {
  return entries.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);
}

function decoratePackageTotals(packages) {
  return (packages || []).map((pkg) => ({
    ...pkg,
    total: packageTotal(pkg),
  }));
}
