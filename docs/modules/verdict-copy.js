// The one verdict wording, used by the app's /trade, a cold /t/ link, the OG
// card, og:title/og:description and the share text (client and functions).
// It reads valueCalcVerdict's tier, so the thresholds live in one place:
//   pct <= 5   Fair trade                     amber
//   pct <= 12  Fair, slight edge to Give|Get  amber
//   pct <= 22  Favors Give|Get                green when Get is ahead, red when Give is
//   else       Lopsided for Give|Get          same colors
// "Give" and "Get" are the giver's two sides, never "you" or "them", so a
// stranger and the sharer read the same words.
import { valueCalcVerdict } from "./value-calc.js";

const TIER = Object.freeze({
  "Dead even": { tier: "even", side: false },
  "Fair, leans Get": { tier: "edge", side: "Get" },
  "Fair, leans Give": { tier: "edge", side: "Give" },
  "Favors Get": { tier: "favors", side: "Get" },
  "Favors Give": { tier: "favors", side: "Give" },
  "Lopsided for Get": { tier: "lopsided", side: "Get" },
  "Lopsided for Give": { tier: "lopsided", side: "Give" },
});

// verdict: valueCalcVerdict(...) output ({ label, pct, gap, ... }).
export function verdictCopy(verdict) {
  const pct = Number(verdict?.pct) || 0;
  const hit = TIER[String(verdict?.label || "")];
  if (!hit) {
    const label = String(verdict?.label || "");
    return { tier: "", side: "", label, pctText: "", line: label, tone: "" };
  }
  const label = hit.tier === "even" ? "Fair trade"
    : hit.tier === "edge" ? `Fair, slight edge to ${hit.side}`
      : hit.tier === "favors" ? `Favors ${hit.side}`
        : `Lopsided for ${hit.side}`;
  const tone = hit.tier === "even" || hit.tier === "edge" ? "fair" : hit.side === "Get" ? "good" : "bad";
  const pctText = `${pct}% apart`;
  return { tier: hit.tier, side: hit.side || "", label, pctText, line: `${label}, ${pctText}`, tone };
}

export function verdictCopyFor(giveTotal, getTotal, counts = {}) {
  return verdictCopy(valueCalcVerdict(giveTotal, getTotal, counts));
}
