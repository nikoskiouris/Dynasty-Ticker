// The one verdict wording, used by the app's /trade, a cold /t/ link, the OG
// card, og:title/og:description, the preview tags and the share text
// (client and functions). It reads valueCalcVerdict's tier, so the
// thresholds live in one place:
//   pct <= 5   Fair trade                          amber
//   pct <= 12  Fair, slight edge to Give|Get side  amber
//   pct <= 22  Favors Give|Get side                green / red
//   else       Lopsided in favor of Give|Get side  green / red
// each followed by "N% apart".
// It always names the side that comes out ahead (PM, Oct 15): the Give side is
// the person giving the Give column, the Get side the person getting it. So
// when the Give column is worth more (Gibbs for two 1sts), the Get side comes
// out ahead. Tone stays the giver's: green when the giver comes out ahead.
// Never "you", "them", "You win" or "You overpay".
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
  // hit.side is the column worth more; the other side gets that column.
  const ahead = hit.side === "Give" ? "Get side" : hit.side === "Get" ? "Give side" : "";
  const label = hit.tier === "even" ? "Fair trade"
    : hit.tier === "edge" ? `Fair, slight edge to ${ahead}`
      : hit.tier === "favors" ? `Favors ${ahead}`
        : `Lopsided in favor of ${ahead}`;
  const tone = hit.tier === "even" || hit.tier === "edge" ? "fair" : ahead === "Give side" ? "good" : "bad";
  const pctText = `${pct}% apart`;
  return { tier: hit.tier, side: ahead, label, pctText, line: `${label}, ${pctText}`, tone };
}

export function verdictCopyFor(giveTotal, getTotal, counts = {}) {
  return verdictCopy(valueCalcVerdict(giveTotal, getTotal, counts));
}
