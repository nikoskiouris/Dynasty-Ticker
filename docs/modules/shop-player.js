// Shop a player: name one player and see what each team in the league could
// fairly pay for him (sell, he is mine) or what I could pay (buy, he is theirs).
// Pure. The caller passes prices and the verdict model, so every offer uses the
// exact numbers Check a trade will show when it opens.
import { verdictCopy } from "./verdict-copy.js";

const FAIR_TIERS = new Set(["even", "edge"]);
// Two or three smaller pieces must add up to well over one better player
// (the stud credit), so the package may list up to 2.2x his price.
const SUM_CAP = 2.2;

// target: { asset, value } the player being shopped.
// payers: [{ rosterId, name, assets: [{ asset, value }] }] each team that would pay.
// model(giveValues, getValues) -> draftVerdictModel output, from the seller's side
//   (give = the shopped player, get = the package).
// Returns one best fair package per team, closest to even first.
export function shopOffers({ target, payers = [], model, maxPieces = 3, perTeam = 1, limit = 6 } = {}) {
  const value = Number(target?.value) || 0;
  if (!(value > 0) || typeof model !== "function") return [];
  const offers = [];
  for (const payer of payers) {
    // Pieces worth more than the player alone would never be a fair return; tiny
    // pieces are filler. Keep the 14 closest-priced candidates.
    const pool = (payer.assets || [])
      .filter((row) => Number(row.value) >= value * 0.12 && Number(row.value) <= value * 1.2)
      .sort((a, b) => Math.abs(a.value - value) - Math.abs(b.value - value))
      .slice(0, 14);
    const packages = [];
    pool.forEach((row) => packages.push([row]));
    if (maxPieces >= 2) {
      for (let i = 0; i < pool.length; i++) {
        for (let j = i + 1; j < pool.length; j++) {
          if (pool[i].value + pool[j].value <= value * SUM_CAP) packages.push([pool[i], pool[j]]);
          if (maxPieces < 3) continue;
          for (let k = j + 1; k < pool.length; k++) {
            if (pool[i].value + pool[j].value + pool[k].value <= value * SUM_CAP) packages.push([pool[i], pool[j], pool[k]]);
          }
        }
      }
    }
    const fair = [];
    for (const pkg of packages) {
      const m = model([value], pkg.map((row) => row.value));
      const copy = verdictCopy(m.verdict);
      if (!FAIR_TIERS.has(copy.tier)) continue;
      const lean = m.compareGet - m.compareGive;
      fair.push({ pkg, model: m, copy, miss: Math.abs(lean) / Math.max(1, m.compareGive), pieces: pkg.length });
    }
    fair.sort((a, b) => a.pieces - b.pieces || a.miss - b.miss);
    // Prefer one-for-one when one is fair; otherwise the closest two-piece return.
    const best = fair.filter((row) => row.copy.tier === "even");
    const chosen = (best.length ? best : fair).slice(0, perTeam);
    chosen.forEach((row) => offers.push({
      rosterId: payer.rosterId,
      teamName: payer.name,
      assets: row.pkg.map((r) => r.asset),
      values: row.pkg.map((r) => r.value),
      verdict: row.model.verdict,
      verdictLine: row.copy.line,
      tier: row.copy.tier,
      miss: row.miss,
    }));
  }
  offers.sort((a, b) => a.miss - b.miss || a.assets.length - b.assets.length);
  return offers.slice(0, limit);
}
