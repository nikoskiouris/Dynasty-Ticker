export function buildDeskHistorySnapshot({
  tab = "",
  view = "",
  selectedTradeId = "",
  selectedTradeManagerKey = "",
  scrollY = 0,
} = {}) {
  return {
    tab: String(tab || ""),
    view: String(view || ""),
    selectedTradeId: String(selectedTradeId || ""),
    selectedTradeManagerKey: String(selectedTradeManagerKey || ""),
    scrollY: Number(scrollY) || 0,
  };
}

export function deskPlaceKey(snapshot = {}) {
  const row = buildDeskHistorySnapshot(snapshot);
  return [row.tab, row.view, row.selectedTradeId, row.selectedTradeManagerKey].join("|");
}

export function isSameDeskPlace(left, right) {
  return deskPlaceKey(left) === deskPlaceKey(right);
}

export function scrollTopFromHistory(historyState) {
  const scrollY = Number(historyState?.scrollY);
  return Number.isFinite(scrollY) ? scrollY : null;
}
