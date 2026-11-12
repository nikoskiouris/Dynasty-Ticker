// "Your next move" on My team. The weakest group is worth upgrading only when
// it is actually weak: when every group ranks in the top half, saying
// "Upgrade QB" at 4th of 10 is filler advice.
export function pickNextMove(rows, totalTeams) {
  const ranked = (Array.isArray(rows) ? rows : []).filter((row) => row?.rankLabel);
  if (!ranked.length) return null;
  const weakest = ranked.reduce((low, row) => (Number(row.percentile) < Number(low.percentile) ? row : low));
  const strongest = ranked.reduce((top, row) => (Number(row.percentile) > Number(top.percentile) ? row : top));
  const teams = Number(totalTeams) || 0;
  const noWeakSpot = teams > 1 && Number(weakest.rank) > 0 && Number(weakest.rank) <= teams / 2;
  return { kind: noWeakSpot ? "hold" : "upgrade", weakest, strongest };
}
