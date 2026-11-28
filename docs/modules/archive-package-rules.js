// Share codes store the board's minute, not the time the link was created.
// These are the first board stamps associated with each released calculator.
// Unstamped shares, 1QB fallbacks and comparisons on today's board use live rules.
export function archivedPackageRules(decoded, boardStamp, sourceScale, modelVersion) {
  if (!boardStamp || decoded.legacyFormat || decoded.stamp !== boardStamp) return undefined;
  // Before v5.2, verdict bands used a rounded gap and near-tied top pieces
  // could receive the full consolidation credit.
  const legacy = { roundToTenth: true, capBestDifference: false };
  if (sourceScale !== 10000) {
    const rounded = ["dynasty-sf-ppr-v3", "dynasty-sf-ppr-v4", "dynasty-sf-ppr-v5", "dynasty-sf-ppr-v5.1"];
    return rounded.includes(modelVersion) ? legacy : undefined;
  }
  // sleeper-trades-v4 introduced the calibrated 25% share with this board (877814e).
  if (boardStamp >= "202611260017") return legacy;
  // The last public release (cd20be2) still credited the full bounded amount.
  if (boardStamp >= "202611162106") return { ...legacy, creditShare: 1 };
  // prod-20261112-185426 (75ee5b1) bounded the direction of an added piece.
  if (boardStamp >= "202611121859") return { ...legacy, creditShare: 1, capThrowIns: false };
  // prod-20261103-212957 (f2cacdf) first credited a trailing side holding the best piece.
  if (boardStamp >= "202611032126") {
    return {
      ...legacy,
      creditShare: 1,
      boundAdditions: false,
      // The 18:25 board was bundled in both the 18:34 and 18:54 releases.
      note: boardStamp === "202611121825"
        ? "This board spanned two calculator releases. This comparison uses the earlier package rule."
        : "",
    };
  }
  // First public dated-share release (4e87071), including the Oct 14 board.
  return { ...legacy, creditShare: 1, boundAdditions: false, allowTrailingCredit: false };
}
