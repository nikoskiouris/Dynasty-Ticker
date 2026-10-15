// The one verdict wording, used by the app's /trade headline, a cold /t/
// link, the OG card, og:title/og:description, the Today line, the preview
// tags and the share text (client and functions). PM's final format describes
// the value columns instead of naming a winner:
//   Fair trade · 1.4% apart
//   Fair, slight edge · Get side worth 8.5% more        (amber)
//   Favors one side · Give side worth 15% more          (green/red)
//   Lopsided · Give side worth 89.3% more               (green/red)
// Two metrics, on the credited totals:
//   tier metric  = |gap| / larger side   (valueCalcVerdict's pct; thresholds
//                  5 / 12 / 22 stay on it, so tiers never shift)
//   shown metric = (bigger - smaller) / smaller, so "worth N% more" is true.
// The Fair tier says "N% apart" with the shown metric, so every number on a
// surface is the same metric.
// Colour stays relative to the sharer: green when the Get column is bigger,
// red when the Give column is, amber for both fair tiers.
import { valueCalcVerdict } from "./value-calc.js";

const TIER = Object.freeze({
  "Dead even": { tier: "even", label: "Fair trade" },
  "Fair, leans Get": { tier: "edge", label: "Fair, slight edge" },
  "Fair, leans Give": { tier: "edge", label: "Fair, slight edge" },
  "Favors Get": { tier: "favors", label: "Favors one side" },
  "Favors Give": { tier: "favors", label: "Favors one side" },
  "Lopsided for Get": { tier: "lopsided", label: "Lopsided" },
  "Lopsided for Give": { tier: "lopsided", label: "Lopsided" },
});

const round1 = (value) => Math.round(value * 10) / 10;

// (bigger - smaller) / smaller, one decimal. null when the smaller side is 0.
export function percentMore(left, right) {
  const big = Math.max(Number(left) || 0, Number(right) || 0);
  const small = Math.min(Number(left) || 0, Number(right) || 0);
  if (small <= 0) return big > 0 ? null : 0;
  return round1(((big - small) / small) * 100);
}

// verdict: valueCalcVerdict(...) output ({ label, pct, gap, left, right }),
// where left/right are the credited Give/Get totals.
export function verdictCopy(verdict) {
  const hit = TIER[String(verdict?.label || "")];
  if (!hit) {
    const label = String(verdict?.label || "");
    return { tier: "", side: "", label, more: null, tierPct: 0, detail: "", pctText: "", line: label, tone: "" };
  }
  const left = Number(verdict.left) || 0;
  const right = Number(verdict.right) || 0;
  const more = percentMore(left, right);
  const side = right > left ? "Get" : left > right ? "Give" : "";
  const amount = more == null ? "" : `${more}% `;
  const detail = hit.tier === "even"
    ? `${more ?? 0}% apart`
    : `${side} side worth ${amount}more`;
  const tone = hit.tier === "even" || hit.tier === "edge" ? "fair" : side === "Get" ? "good" : "bad";
  return {
    tier: hit.tier,
    side: hit.tier === "even" ? "" : side,
    label: hit.label,
    more,
    tierPct: Number(verdict.pct) || 0,
    detail,
    pctText: detail,
    line: `${hit.label} · ${detail}`,
    tone,
  };
}

export function verdictCopyFor(giveTotal, getTotal, counts = {}) {
  return verdictCopy(valueCalcVerdict(giveTotal, getTotal, counts));
}
