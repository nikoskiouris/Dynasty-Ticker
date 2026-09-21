export const MATCH_NEED_PERCENTILE = 0.42;
export const MATCH_CRITICAL_PERCENTILE = 0.28;
export const MATCH_SURPLUS_PERCENTILE = 0.62;
export const MATCH_EDGE_PERCENTILE = 0.75;
export const MATCH_STARTABLE_VALUE = 2500;
export const MATCH_MIN_HEADLINE_VALUE = 2200;
export const MATCH_MIN_GLUE_VALUE = 1600;
export const MATCH_NEED_DELTA = 250;
export const MATCH_FAIRNESS_PCT = 24;
export const MATCH_LATE_ROUND = 3;
export const MATCH_MAX_ASSETS_PER_SIDE = 2;
export const MATCH_MAX_PARTNERS = 5;
export const MATCH_MAX_DEALS_PER_PARTNER = 4;
export const MATCH_MIN_PARTNER_SCORE = 18;

export function classifyMatchTimeline(laneId) {
  const id = String(laneId || "");
  if (id === "rebuild") return "rebuilding";
  if (id === "contender" || id === "fragile-contender" || id === "playoff-hunter") return "contending";
  return "middle";
}

export function gradePositionNeed(percentile) {
  const value = Number(percentile);
  if (!Number.isFinite(value)) return "stable";
  if (value <= MATCH_CRITICAL_PERCENTILE) return "critical";
  if (value <= MATCH_NEED_PERCENTILE) return "need";
  if (value >= MATCH_EDGE_PERCENTILE) return "surplus";
  if (value >= MATCH_SURPLUS_PERCENTILE) return "depth";
  return "stable";
}

export function countStartableAtPosition(assets, position, valueOf, positionsOf) {
  const token = String(position || "");
  if (!token) return 0;
  return (Array.isArray(assets) ? assets : []).filter((asset) => {
    if (asset?.assetType !== "player") return false;
    const positions = positionsOf?.(asset) || [];
    if (!positions.includes(token)) return false;
    const value = Number(valueOf?.(asset));
    return Number.isFinite(value) && value >= MATCH_STARTABLE_VALUE;
  }).length;
}

export function gradeCoveredPosition(percentile, { startable = 0, demand = 1 } = {}) {
  const grade = gradePositionNeed(percentile);
  const slots = Math.max(1, Number(demand) || 1);
  if ((grade === "need" || grade === "critical") && Number(startable) >= slots) return "stable";
  return grade;
}

export function pickRound(asset) {
  if (!asset || asset.assetType !== "pick") return null;
  const raw = Number(asset.raw?.round);
  if (Number.isFinite(raw) && raw > 0) return raw;
  const match = String(asset.assetId || "").match(/:r(\d+)/i);
  return match ? Number(match[1]) : null;
}

export function isLateRoundPick(asset) {
  const round = pickRound(asset);
  return asset?.assetType === "pick" && Number.isFinite(round) && round >= MATCH_LATE_ROUND;
}

export function isEarlyPick(asset) {
  const round = pickRound(asset);
  return asset?.assetType === "pick" && Number.isFinite(round) && round <= 2;
}

export function isFirstRoundPick(asset) {
  return pickRound(asset) === 1;
}

export function isYouthAsset(asset, playerAgeForAsset) {
  if (asset?.assetType !== "player") return false;
  const age = playerAgeForAsset?.(asset);
  return Number.isFinite(age) && age <= 24;
}

export function isVeteranAsset(asset, playerAgeForAsset, playerPositionForAsset) {
  if (asset?.assetType !== "player") return false;
  const age = playerAgeForAsset?.(asset);
  if (!Number.isFinite(age)) return false;
  const position = primaryPosition(asset, playerPositionForAsset);
  if (position === "RB") return age >= 26;
  return age >= 28;
}

export function isWinNowAsset(asset, playerAgeForAsset, playerPositionForAsset) {
  if (asset?.assetType !== "player") return false;
  const age = playerAgeForAsset?.(asset);
  const position = primaryPosition(asset, playerPositionForAsset);
  if (!Number.isFinite(age)) return position === "RB" || position === "TE";
  if (position === "RB") return age <= 27;
  if (position === "TE") return age <= 29;
  return age <= 30;
}

export function buildTradeMatchProfile({
  roster,
  powerProfile,
  values,
  getAssetValue,
  playerPositionForAsset,
  playerPositionsForAsset,
  playerAgeForAsset,
  positionDemand = null,
} = {}) {
  const positionSummaries = Array.isArray(powerProfile?.positionSummaries) ? powerProfile.positionSummaries : [];
  const demandByPosition = positionDemand || Object.fromEntries(
    positionSummaries.map((entry) => [entry.position, Math.max(1, Number(entry.demand) || 1)])
  );
  const needs = [];
  const surplus = [];

  positionSummaries.forEach((entry) => {
    const demand = Math.max(1, Number(demandByPosition[entry.position] || entry.demand) || 1);
    const startable = countStartableAtPosition(
      roster?.assets,
      entry.position,
      (asset) => getAssetValue?.(asset, values),
      (asset) => playerPositionsForAsset?.(asset) || [],
    );
    const grade = gradeCoveredPosition(entry.percentile, { startable, demand });
    const row = {
      position: entry.position,
      percentile: Number(entry.percentile) || 0,
      rankLabel: entry.rankLabel || "",
      demand,
      value: Number(entry.value) || 0,
      startable,
      grade,
    };
    if (grade === "critical" || grade === "need") needs.push(row);
    if (grade === "surplus" || grade === "depth") surplus.push(row);
  });

  needs.sort((a, b) => a.percentile - b.percentile || a.position.localeCompare(b.position));
  surplus.sort((a, b) => b.percentile - a.percentile || a.position.localeCompare(b.position));

  const timeline = classifyMatchTimeline(powerProfile?.lane?.id || powerProfile?.laneId);
  const assets = (roster?.assets || [])
    .map((asset) => decorateMatchAsset(asset, {
      values,
      getAssetValue,
      playerPositionForAsset,
      playerPositionsForAsset,
      playerAgeForAsset,
    }))
    .filter((entry) => Number.isFinite(entry.value) && entry.value > 0)
    .sort((a, b) => b.value - a.value || a.asset.name.localeCompare(b.asset.name));

  return {
    rosterId: roster?.rosterId ?? powerProfile?.rosterId,
    managerName: roster?.manager?.displayName || powerProfile?.managerName || "Manager",
    roster,
    laneId: powerProfile?.lane?.id || powerProfile?.laneId || "middle",
    laneLabel: powerProfile?.lane?.label || powerProfile?.laneLabel || "Middle Build",
    timeline,
    needs,
    surplus,
    weakestPosition: needs[0] || null,
    strongestPosition: surplus[0] || null,
    assets,
    pickValue: assets.filter((entry) => entry.asset.assetType === "pick").reduce((sum, entry) => sum + entry.value, 0),
    playerValue: assets.filter((entry) => entry.asset.assetType === "player").reduce((sum, entry) => sum + entry.value, 0),
  };
}

export function scorePartnerMatch(myProfile, theirProfile) {
  if (!myProfile || !theirProfile) {
    return emptyPartnerMatch(theirProfile);
  }

  const takePositions = complementaryPositions(myProfile.needs, theirProfile.surplus);
  const givePositions = complementaryPositions(theirProfile.needs, myProfile.surplus);
  const timelinePairing = timelinePairingId(myProfile.timeline, theirProfile.timeline);
  let score = 0;
  const reasons = [];

  takePositions.forEach((row) => {
    score += row.needGrade === "critical" ? 30 : 18;
  });
  givePositions.forEach((row) => {
    score += row.needGrade === "critical" ? 22 : 14;
  });
  if (takePositions.length && givePositions.length) {
    score += 20;
    reasons.push("two-way");
  }
  if (takePositions.length) reasons.push("they-cover-need");
  if (givePositions.length) reasons.push("you-cover-need");

  if (timelinePairing === "contend-rebuild" || timelinePairing === "rebuild-contend") {
    score += 24;
    reasons.push("timeline");
  } else if (timelinePairing !== "same") {
    score += 8;
  }

  if (myProfile.timeline === "contending" && theirProfile.pickValue >= myProfile.pickValue + 1800) {
    score += 6;
  }
  if (myProfile.timeline === "rebuilding" && theirProfile.playerValue >= myProfile.playerValue + 1200) {
    score += 6;
  }

  return {
    rosterId: theirProfile.rosterId,
    managerName: theirProfile.managerName,
    laneLabel: theirProfile.laneLabel,
    timeline: theirProfile.timeline,
    score,
    takePositions: takePositions.map((row) => row.position),
    givePositions: givePositions.map((row) => row.position),
    timelinePairing,
    reasons,
    twoWay: takePositions.length > 0 && givePositions.length > 0,
  };
}

export function rankPartnerMatches(myProfile, otherProfiles, { limit = MATCH_MAX_PARTNERS, minScore = MATCH_MIN_PARTNER_SCORE } = {}) {
  return (otherProfiles || [])
    .map((theirProfile) => ({
      profile: theirProfile,
      match: scorePartnerMatch(myProfile, theirProfile),
    }))
    .filter((entry) => entry.match.score >= minScore)
    .sort((a, b) => b.match.score - a.match.score || a.match.managerName.localeCompare(b.match.managerName))
    .slice(0, limit);
}

export function describePartnerMatch(match, myProfile) {
  const parts = [];
  const myNeed = match.takePositions?.[0] || myProfile?.weakestPosition?.position;
  const theirNeed = match.givePositions?.[0];
  if (match.takePositions?.length && match.givePositions?.length) {
    parts.push(`They have the ${match.takePositions.join("/")} you need, and they need your ${match.givePositions.join("/")}.`);
  } else if (match.takePositions?.length) {
    parts.push(`They are deep at ${match.takePositions.join("/")}, your weakest group.`);
  } else if (match.givePositions?.length) {
    parts.push(`They need ${match.givePositions.join("/")}, where you have extra.`);
  } else if (myNeed) {
    parts.push(`${myNeed} is the hole this match is trying to patch.`);
  }

  if (match.timelinePairing === "contend-rebuild") {
    parts.push("You're contending; they're tanking. Buy a starter, send future.");
  } else if (match.timelinePairing === "rebuild-contend") {
    parts.push("You're rebuilding; they're win-now. Cash a vet, take youth or picks.");
  }

  return parts.join(" ");
}

export function isMeaningfulHeadline(asset, value) {
  if (isLateRoundPick(asset)) return false;
  if (asset?.assetType === "player") return Number(value) >= MATCH_MIN_HEADLINE_VALUE;
  return isEarlyPick(asset) && Number(value) >= MATCH_MIN_GLUE_VALUE;
}

export function packageLooksLikeFiller(myAssets, theirAssets, values, getAssetValue) {
  const mine = Array.isArray(myAssets) ? myAssets : [];
  const theirs = Array.isArray(theirAssets) ? theirAssets : [];
  const all = [...mine, ...theirs];
  if (all.some(isLateRoundPick)) return true;
  if (all.length === 0) return true;

  const myTop = maxAssetValue(mine, values, getAssetValue);
  const theirTop = maxAssetValue(theirs, values, getAssetValue);
  if (myTop < MATCH_MIN_HEADLINE_VALUE && theirTop < MATCH_MIN_HEADLINE_VALUE) return true;

  const myHeadline = mine.some((asset) => isMeaningfulHeadline(asset, getValue(asset, values, getAssetValue)));
  const theirHeadline = theirs.some((asset) => isMeaningfulHeadline(asset, getValue(asset, values, getAssetValue)));
  if (!myHeadline || !theirHeadline) return true;

  const playerMoves = all.some((asset) => asset.assetType === "player");
  const firstMoves = all.some(isFirstRoundPick);
  if (!playerMoves && !firstMoves) return true;
  return false;
}

export function evaluateTradeHelp({
  profile,
  incoming,
  outgoing,
  values,
  getAssetValue,
  playerPositionForAsset,
  playerPositionsForAsset,
  playerAgeForAsset,
}) {
  const beforeAssets = (profile?.roster?.assets || []).slice();
  const afterAssets = applyTradeAssets(beforeAssets, incoming, outgoing);
  const needDeltas = (profile?.needs || []).map((need) => {
    const before = positionStarterValue(beforeAssets, need.position, need.demand, values, getAssetValue, playerPositionForAsset, playerPositionsForAsset);
    const after = positionStarterValue(afterAssets, need.position, need.demand, values, getAssetValue, playerPositionForAsset, playerPositionsForAsset);
    return {
      position: need.position,
      grade: need.grade,
      before,
      after,
      delta: after - before,
    };
  });
  const patchedNeeds = needDeltas.filter((row) => row.delta >= MATCH_NEED_DELTA);
  const harmedNeeds = needDeltas.filter((row) => row.delta <= -MATCH_NEED_DELTA && (row.grade === "critical" || row.grade === "need"));
  const pickDelta = sumByType(afterAssets, "pick", values, getAssetValue) - sumByType(beforeAssets, "pick", values, getAssetValue);
  const youthDelta = sumYouth(afterAssets, values, getAssetValue, playerAgeForAsset) - sumYouth(beforeAssets, values, getAssetValue, playerAgeForAsset);
  const incomingHasWinNow = (incoming || []).some((asset) => asset.assetType === "player");
  const outgoingHasVet = (outgoing || []).some((asset) => asset.assetType === "player");

  let helped = patchedNeeds.length > 0;
  if (profile?.timeline === "contending") {
    helped = patchedNeeds.length > 0 || (incomingHasWinNow && pickDelta < 0 && harmedNeeds.length === 0);
  }
  if (profile?.timeline === "rebuilding") {
    helped = pickDelta >= 800 || youthDelta >= MATCH_NEED_DELTA || (outgoingHasVet && (pickDelta > 0 || patchedNeeds.length > 0));
  }
  if (harmedNeeds.length && patchedNeeds.length === 0 && profile?.timeline !== "rebuilding") {
    helped = false;
  }

  return {
    helped,
    patchedNeeds,
    harmedNeeds,
    pickDelta,
    youthDelta,
    needDeltas,
  };
}

export function inspectMatchPools(myProfile, theirProfile, helpers) {
  const theirSellable = listSellableAssets(theirProfile, myProfile, helpers);
  const mySellable = listSellableAssets(myProfile, theirProfile, helpers);
  const incoming = listWantedAssets(myProfile, theirProfile, theirSellable, helpers);
  const outgoing = listWantedAssets(theirProfile, myProfile, mySellable, helpers);
  const summarize = (entries) => entries.map((entry) => `${entry.asset.name} (${entry.position || (entry.isPick ? `R${entry.pickRound}` : "?")}, ${Math.round(entry.value)})`);
  return {
    mySellable: summarize(mySellable),
    theirSellable: summarize(theirSellable),
    incoming: summarize(incoming),
    outgoing: summarize(outgoing),
  };
}

export function proposeMatchDeals({
  myProfile,
  theirProfile,
  match = null,
  values,
  getAssetValue,
  playerPositionForAsset,
  playerPositionsForAsset,
  playerAgeForAsset,
  fairnessPct = MATCH_FAIRNESS_PCT,
  maxResults = MATCH_MAX_DEALS_PER_PARTNER,
} = {}) {
  if (!myProfile || !theirProfile) return [];

  const resolvedMatch = match || scorePartnerMatch(myProfile, theirProfile);
  const helpers = { getAssetValue, playerPositionForAsset, playerPositionsForAsset, playerAgeForAsset, values };
  const theirSellable = listSellableAssets(theirProfile, myProfile, helpers);
  const mySellable = listSellableAssets(myProfile, theirProfile, helpers);
  const incomingPool = listWantedAssets(myProfile, theirProfile, theirSellable, helpers).slice(0, 7);
  const outgoingPool = listWantedAssets(theirProfile, myProfile, mySellable, helpers).slice(0, 7);
  if (incomingPool.length === 0 || outgoingPool.length === 0) return [];

  const incomingPackages = packagesFrom(incomingPool, MATCH_MAX_ASSETS_PER_SIDE);
  const outgoingPackages = packagesFrom(outgoingPool, MATCH_MAX_ASSETS_PER_SIDE);
  const myGlue = mySellable.filter((entry) => !outgoingPool.includes(entry));
  const theirGlue = theirSellable.filter((entry) => !incomingPool.includes(entry));
  const ideas = [];

  for (const incoming of incomingPackages) {
    for (const outgoing of outgoingPackages) {
      const balanced = balancePackages({
        outgoing,
        incoming,
        myGlue,
        theirGlue,
        fairnessPct,
        helpers,
      });
      if (!balanced) continue;

      const myAssets = balanced.outgoing.map((entry) => entry.asset);
      const theirAssets = balanced.incoming.map((entry) => entry.asset);
      if (packageLooksLikeFiller(myAssets, theirAssets, values, getAssetValue)) continue;
      if (hasAssetOverlap(myAssets, theirAssets)) continue;
      if (!packageServesMatch(balanced.incoming, myProfile, { role: "incoming", pairing: resolvedMatch.timelinePairing })) continue;
      if (!packageServesMatch(balanced.outgoing, theirProfile, { role: "outgoing", pairing: resolvedMatch.timelinePairing })) continue;
      if (sellsUnreplacedNeed(balanced.outgoing, balanced.incoming, myProfile)) continue;

      const myHelp = evaluateTradeHelp({
        profile: myProfile,
        incoming: theirAssets,
        outgoing: myAssets,
        values,
        getAssetValue,
        playerPositionForAsset,
        playerPositionsForAsset,
        playerAgeForAsset,
      });
      const theirHelp = evaluateTradeHelp({
        profile: theirProfile,
        incoming: myAssets,
        outgoing: theirAssets,
        values,
        getAssetValue,
        playerPositionForAsset,
        playerPositionsForAsset,
        playerAgeForAsset,
      });
      if (!myHelp.helped || !theirHelp.helped) continue;

      const myValue = sumEntries(balanced.outgoing);
      const theirValue = sumEntries(balanced.incoming);
      const pctDiff = percentDiff(myValue, theirValue);
      const kind = classifyMatchDealKind(resolvedMatch, myHelp, theirHelp);
      ideas.push({
        myAssets,
        theirAssets,
        myValue,
        theirValue,
        pctDiff,
        kind,
        matchScore: resolvedMatch.score,
        helpScore: scoreDealHelp(myHelp, theirHelp, pctDiff, myValue, theirValue, myAssets.length, theirAssets.length, myProfile),
        myHelp,
        theirHelp,
        tags: buildMatchDealTags(resolvedMatch, myHelp, kind),
        summary: buildMatchDealSummary({ match: resolvedMatch, myHelp, theirHelp, myProfile, theirProfile }),
        pitch: buildMatchDealPitch({ match: resolvedMatch, myAssets, theirAssets, myProfile, theirProfile }),
      });
    }
  }

  return dedupeMatchDeals(ideas)
    .sort((a, b) => b.helpScore - a.helpScore || a.pctDiff - b.pctDiff || b.theirValue - a.theirValue)
    .slice(0, maxResults);
}

export function previewBestMatch(myProfile, otherProfiles) {
  const ranked = rankPartnerMatches(myProfile, otherProfiles, { limit: 1, minScore: 12 });
  if (!ranked.length) return null;
  const { profile, match } = ranked[0];
  const need = match.takePositions[0] || myProfile.weakestPosition?.position || "Roster";
  return {
    rosterId: profile.rosterId,
    managerName: profile.managerName,
    laneLabel: profile.laneLabel,
    need,
    detail: describePartnerMatch(match, myProfile),
    score: match.score,
  };
}

function decorateMatchAsset(asset, {
  values,
  getAssetValue,
  playerPositionForAsset,
  playerPositionsForAsset,
  playerAgeForAsset,
}) {
  const positions = positionsOf(asset, playerPositionForAsset, playerPositionsForAsset);
  return {
    asset,
    value: getValue(asset, values, getAssetValue),
    positions,
    position: positions[0] || "",
    age: playerAgeForAsset?.(asset) ?? null,
    isPick: asset.assetType === "pick",
    pickRound: pickRound(asset),
    isYouth: isYouthAsset(asset, playerAgeForAsset),
    isVeteran: isVeteranAsset(asset, playerAgeForAsset, playerPositionForAsset),
    isWinNow: isWinNowAsset(asset, playerAgeForAsset, playerPositionForAsset),
  };
}

function listSellableAssets(ownerProfile, buyerProfile, helpers) {
  const needPositions = new Set((ownerProfile.needs || []).map((row) => row.position));
  const surplusPositions = new Set((ownerProfile.surplus || []).map((row) => row.position));
  const topAssetId = ownerProfile.assets[0]?.asset.assetId;
  const rankedAtPosition = countByPosition(ownerProfile.assets);

  return ownerProfile.assets.filter((entry) => {
    if (isLateRoundPick(entry.asset)) return false;
    if (entry.value < MATCH_MIN_GLUE_VALUE) return false;
    if (entry.positions.some((position) => position === "K" || position === "DEF")) return false;
    if (entry.asset.assetId === topAssetId && ownerProfile.timeline !== "rebuilding") return false;
    if (entry.isPick) {
      if (!isEarlyPick(entry.asset)) return false;
      return ownerProfile.timeline === "contending" || buyerProfile.timeline === "rebuilding" || ownerProfile.timeline === "middle";
    }

    const coversNeed = entry.positions.some((position) => needPositions.has(position));
    const coversSurplus = entry.positions.some((position) => surplusPositions.has(position));
    const starterCaliberCount = (entry.positions
      .map((position) => rankedAtPosition.get(position) || 0)
      .sort((a, b) => b - a)[0]) || 0;
    if (coversNeed && starterCaliberCount <= 1 && entry.value >= MATCH_MIN_HEADLINE_VALUE) return false;

    if (coversSurplus) return true;
    if (ownerProfile.timeline === "rebuilding" && entry.isVeteran) return true;
    if (ownerProfile.timeline === "contending" && entry.isPick) return true;
    if (buyerProfile.timeline === "contending" && entry.isWinNow && !coversNeed) return true;
    if (buyerProfile.timeline === "rebuilding" && (entry.isYouth || entry.isPick)) return true;
    return false;
  });
}

function listWantedAssets(buyerProfile, sellerProfile, sellerSellable, helpers) {
  const needPositions = new Set((buyerProfile.needs || []).map((row) => row.position));
  const wanted = sellerSellable.filter((entry) => {
    if (entry.isPick) {
      if (buyerProfile.timeline === "rebuilding") return isEarlyPick(entry.asset);
      if (buyerProfile.timeline === "middle" && sellerProfile.timeline === "contending") return isFirstRoundPick(entry.asset);
      return false;
    }
    if (entry.positions.some((position) => needPositions.has(position))) {
      return entry.value >= MATCH_MIN_HEADLINE_VALUE;
    }
    if (buyerProfile.timeline === "contending" && sellerProfile.timeline === "rebuilding" && entry.isWinNow) {
      return entry.value >= MATCH_MIN_HEADLINE_VALUE;
    }
    if (buyerProfile.timeline === "rebuilding" && entry.isYouth && entry.value >= MATCH_MIN_HEADLINE_VALUE) {
      return true;
    }
    return false;
  });

  if (wanted.length > 0) return wanted.sort((a, b) => b.value - a.value);

  if (buyerProfile.timeline === "contending" && sellerProfile.timeline === "rebuilding") {
    return sellerSellable
      .filter((entry) => !entry.isPick && entry.value >= MATCH_MIN_HEADLINE_VALUE)
      .sort((a, b) => b.value - a.value);
  }
  if (buyerProfile.timeline === "rebuilding" && sellerProfile.timeline === "contending") {
    return sellerSellable
      .filter((entry) => entry.isPick || entry.isYouth)
      .sort((a, b) => b.value - a.value);
  }
  return sellerSellable.filter((entry) => entry.value >= MATCH_MIN_HEADLINE_VALUE).sort((a, b) => b.value - a.value);
}

function balancePackages({ outgoing, incoming, myGlue, theirGlue, fairnessPct, helpers }) {
  const current = { outgoing: outgoing.slice(), incoming: incoming.slice() };
  if (packageWithinFairness(current, fairnessPct)) return current;
  if (current.outgoing.length >= 3 || current.incoming.length >= 3) return null;

  const outgoingValue = sumEntries(current.outgoing);
  const incomingValue = sumEntries(current.incoming);
  const gap = outgoingValue - incomingValue;
  const gluePool = gap > 0 ? theirGlue : myGlue;
  const side = gap > 0 ? "incoming" : "outgoing";
  const targetGap = Math.abs(gap);
  const glue = gluePool
    .filter((entry) => !current.outgoing.includes(entry) && !current.incoming.includes(entry))
    .filter((entry) => !isLateRoundPick(entry.asset) && entry.value >= MATCH_MIN_GLUE_VALUE)
    .sort((a, b) => Math.abs(a.value - targetGap) - Math.abs(b.value - targetGap) || b.value - a.value)[0];
  if (!glue) return packageWithinFairness(current, fairnessPct + 2) ? current : null;

  current[side].push(glue);
  return packageWithinFairness(current, fairnessPct) ? current : null;
}

function packageWithinFairness(pkg, fairnessPct) {
  const mine = sumEntries(pkg.outgoing);
  const theirs = sumEntries(pkg.incoming);
  if (mine <= 0 || theirs <= 0) return false;
  return percentDiff(mine, theirs) <= fairnessPct;
}

function packagesFrom(entries, maxSize) {
  const packages = [];
  for (let size = 1; size <= Math.min(maxSize, entries.length); size += 1) {
    combinationsOfSize(entries, size).forEach((combo) => packages.push(combo));
  }
  return packages;
}

function combinationsOfSize(items, size) {
  if (size <= 0) return [[]];
  if (size > items.length) return [];
  const out = [];
  const stack = [];
  function walk(start) {
    if (stack.length === size) {
      out.push(stack.slice());
      return;
    }
    for (let index = start; index < items.length; index += 1) {
      stack.push(items[index]);
      walk(index + 1);
      stack.pop();
    }
  }
  walk(0);
  return out;
}

function packageServesMatch(entries, beneficiaryProfile, { pairing }) {
  const needPositions = new Set((beneficiaryProfile?.needs || []).map((row) => row.position));
  if (entries.some((entry) => entry.positions.some((position) => needPositions.has(position)))) return true;
  if (pairing === "contend-rebuild" && entries.some((entry) => entry.isPick || entry.isYouth || entry.isWinNow)) return true;
  if (pairing === "rebuild-contend" && entries.some((entry) => entry.isVeteran || entry.isPick || entry.isYouth)) return true;
  return false;
}

function sellsUnreplacedNeed(outgoing, incoming, profile) {
  const needPositions = (profile?.needs || []).map((row) => row.position);
  return needPositions.some((position) => {
    const sending = outgoing.some((entry) => entry.positions.includes(position) && entry.value >= MATCH_MIN_HEADLINE_VALUE);
    if (!sending) return false;
    return !incoming.some((entry) => entry.positions.includes(position) && entry.value >= MATCH_MIN_HEADLINE_VALUE);
  });
}

function complementaryPositions(needs, surplus) {
  const surplusByPosition = new Map((surplus || []).map((row) => [row.position, row]));
  return (needs || [])
    .map((need) => {
      const extra = surplusByPosition.get(need.position);
      if (!extra) return null;
      return {
        position: need.position,
        needGrade: need.grade,
        surplusGrade: extra.grade,
      };
    })
    .filter(Boolean);
}

function timelinePairingId(mine, theirs) {
  if (mine === "contending" && theirs === "rebuilding") return "contend-rebuild";
  if (mine === "rebuilding" && theirs === "contending") return "rebuild-contend";
  if (mine === theirs) return "same";
  return "mixed";
}

function emptyPartnerMatch(theirProfile) {
  return {
    rosterId: theirProfile?.rosterId,
    managerName: theirProfile?.managerName || "Manager",
    laneLabel: theirProfile?.laneLabel || "",
    timeline: theirProfile?.timeline || "middle",
    score: 0,
    takePositions: [],
    givePositions: [],
    timelinePairing: "mixed",
    reasons: [],
    twoWay: false,
  };
}

function classifyMatchDealKind(match, myHelp, theirHelp) {
  if (match?.timelinePairing === "contend-rebuild" || match?.timelinePairing === "rebuild-contend") {
    return match.timelinePairing;
  }
  if (myHelp.patchedNeeds.length && theirHelp.patchedNeeds.length) return "need-swap";
  if (myHelp.patchedNeeds.length) return "need-fill";
  return "fit";
}

function scoreDealHelp(myHelp, theirHelp, pctDiff, myValue, theirValue, myCount = 1, theirCount = 1, myProfile = null) {
  let score = 70;
  score += myHelp.patchedNeeds.reduce((sum, row) => sum + Math.min(18, row.delta / 120), 0);
  score += theirHelp.patchedNeeds.reduce((sum, row) => sum + Math.min(14, row.delta / 140), 0);
  const loudestNeed = myProfile?.weakestPosition?.position;
  if (loudestNeed && myHelp.patchedNeeds.some((row) => row.position === loudestNeed)) score += 16;
  score += Math.min(12, Math.max(0, myHelp.pickDelta) / 400);
  score += Math.min(12, Math.max(0, theirHelp.pickDelta) / 400);
  score -= pctDiff * 1.1;
  score -= myHelp.harmedNeeds.length * 16;
  score -= theirHelp.harmedNeeds.length * 12;
  score += Math.min(theirValue, myValue) / 1800;
  score += (3 - myCount) * 8 + (3 - theirCount) * 8;
  if (myCount === 1 && theirCount === 1) score += 18;
  if (myCount + theirCount <= 3) score += 6;
  return score;
}

function buildMatchDealTags(match, myHelp, kind) {
  const tags = ["Match"];
  if (match.twoWay) tags.push("Two-Way Fit");
  if (kind === "contend-rebuild" || kind === "rebuild-contend") tags.push("Contend / Tank");
  if (myHelp.patchedNeeds[0]) tags.push(`${myHelp.patchedNeeds[0].position} Hole`);
  return [...new Set(tags)].slice(0, 4);
}

function buildMatchDealSummary({ match, myHelp, theirHelp, myProfile, theirProfile }) {
  const myPatch = myHelp.patchedNeeds[0];
  const theirPatch = theirHelp.patchedNeeds[0];
  if (myPatch && theirPatch) {
    return `You patch ${myPatch.position} while ${theirProfile.managerName} patches ${theirPatch.position}.`;
  }
  if (match.timelinePairing === "contend-rebuild") {
    return `Win-now piece for a team that is collecting future, not starting ${myProfile.weakestPosition?.position || "this week"}.`;
  }
  if (match.timelinePairing === "rebuild-contend") {
    return `You move a win-now piece and take the future ${theirProfile.managerName} can actually use.`;
  }
  if (myPatch) return `This is aimed at your ${myPatch.position} hole, not a random value swap.`;
  return `Built from roster needs, not leftover draft capital.`;
}

function buildMatchDealPitch({ match, myAssets, theirAssets, myProfile, theirProfile }) {
  const send = myAssets.map((asset) => asset.name).join(" and ");
  const receive = theirAssets.map((asset) => asset.name).join(" and ");
  if (match.timelinePairing === "contend-rebuild") {
    return `You're not competing. I can take ${receive} off you for ${send} so both windows move the right way.`;
  }
  if (match.timelinePairing === "rebuild-contend") {
    return `I can move ${send} if ${receive} is the future piece. You get a starter, I get younger.`;
  }
  if (match.takePositions?.length && match.givePositions?.length) {
    return `You need ${match.givePositions[0]} and I need ${match.takePositions[0]}. ${send} for ${receive} is the clean swap.`;
  }
  return `${send} for ${receive} is the version that actually helps both lineups.`;
}

function dedupeMatchDeals(ideas) {
  const seen = new Set();
  const out = [];
  ideas.forEach((idea) => {
    const key = `${idea.myAssets.map((asset) => asset.assetId).sort().join("|")}=>${idea.theirAssets.map((asset) => asset.assetId).sort().join("|")}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(idea);
  });
  return out;
}

function applyTradeAssets(assets, incoming, outgoing) {
  const outgoingIds = new Set((outgoing || []).map((asset) => asset.assetId));
  return [...(assets || []).filter((asset) => !outgoingIds.has(asset.assetId)), ...(incoming || [])];
}

function positionStarterValue(assets, position, demand, values, getAssetValue, playerPositionForAsset, playerPositionsForAsset) {
  const slots = Math.max(1, Number(demand) || 1);
  return (assets || [])
    .filter((asset) => asset.assetType === "player" && positionsOf(asset, playerPositionForAsset, playerPositionsForAsset).includes(position))
    .map((asset) => getValue(asset, values, getAssetValue))
    .filter(Number.isFinite)
    .sort((a, b) => b - a)
    .slice(0, slots)
    .reduce((sum, value) => sum + value, 0);
}

function sumByType(assets, assetType, values, getAssetValue) {
  return (assets || [])
    .filter((asset) => asset.assetType === assetType)
    .reduce((sum, asset) => sum + getValue(asset, values, getAssetValue), 0);
}

function sumYouth(assets, values, getAssetValue, playerAgeForAsset) {
  return (assets || []).reduce((sum, asset) => {
    if (!isYouthAsset(asset, playerAgeForAsset)) return sum;
    return sum + getValue(asset, values, getAssetValue);
  }, 0);
}

function sumEntries(entries) {
  return (entries || []).reduce((sum, entry) => sum + Number(entry.value || 0), 0);
}

function maxAssetValue(assets, values, getAssetValue) {
  return (assets || []).reduce((max, asset) => Math.max(max, getValue(asset, values, getAssetValue)), 0);
}

function percentDiff(left, right) {
  const top = Math.max(left, right);
  if (!top) return 100;
  return Math.abs(left - right) / top * 100;
}

function getValue(asset, values, getAssetValue) {
  if (typeof getAssetValue === "function") {
    const value = Number(getAssetValue(asset, values));
    if (Number.isFinite(value)) return value;
  }
  const mapped = Number(values?.[asset?.assetId]);
  return Number.isFinite(mapped) ? mapped : 0;
}

function positionsOf(asset, playerPositionForAsset, playerPositionsForAsset) {
  if (typeof playerPositionsForAsset === "function") {
    const list = playerPositionsForAsset(asset);
    if (Array.isArray(list) && list.length) return list.map((position) => String(position || "").toUpperCase());
  }
  const position = primaryPosition(asset, playerPositionForAsset);
  return position ? [position] : [];
}

function primaryPosition(asset, playerPositionForAsset) {
  if (typeof playerPositionForAsset === "function") {
    const position = String(playerPositionForAsset(asset) || "").toUpperCase();
    if (position) return position;
  }
  return String(asset?.raw?.position || asset?.raw?.fantasy_positions?.[0] || "").toUpperCase();
}

function countByPosition(entries) {
  const counts = new Map();
  entries.forEach((entry) => {
    if (entry.asset.assetType !== "player") return;
    if (entry.value < MATCH_MIN_HEADLINE_VALUE) return;
    entry.positions.forEach((position) => {
      counts.set(position, (counts.get(position) || 0) + 1);
    });
  });
  return counts;
}

function hasAssetOverlap(left, right) {
  const ids = new Set(left.map((asset) => asset.assetId));
  return right.some((asset) => ids.has(asset.assetId));
}
