export function ideaPackageKey(idea) {
  if (Array.isArray(idea?.participants)) {
    return idea.participants
      .map((participant) => {
        const rosterId = participant?.roster?.rosterId ?? participant?.rosterId ?? "";
        const assets = participant?.outgoingAssets || [];
        return `${rosterId}:${assets.map((asset) => asset.assetId).sort().join("|")}`;
      })
      .sort()
      .join("::");
  }
  return [
    idea?.counterpartyRosterId || "",
    (idea?.myAssets || []).map((asset) => asset.assetId).sort().join("|"),
    (idea?.theirAssets || []).map((asset) => asset.assetId).sort().join("|"),
  ].join("=>");
}

export function selectNextDiverse(ideas, maxResults, { prior = [], keyOf = ideaPackageKey, tooSimilar } = {}) {
  const limit = Math.max(0, Number(maxResults) || 0);
  const previous = Array.isArray(prior) ? prior : [];
  const priorKeys = new Set(previous.map((idea) => keyOf(idea)));
  const queue = (Array.isArray(ideas) ? ideas : []).filter((idea) => !priorKeys.has(keyOf(idea)));
  const selected = [];
  const heldBack = [];
  const closeTo = typeof tooSimilar === "function" ? tooSimilar : null;
  const scan = previous.length > 0 ? queue.slice(0, Math.max(limit * 40, 160)) : queue;

  for (const idea of scan) {
    if (closeTo && (previous.some((picked) => closeTo(idea, picked)) || selected.some((picked) => closeTo(idea, picked)))) {
      heldBack.push(idea);
      continue;
    }
    selected.push(idea);
    if (selected.length >= limit) return selected;
  }

  for (const idea of heldBack) {
    if (selected.length >= limit) break;
    selected.push(idea);
  }

  return selected;
}
