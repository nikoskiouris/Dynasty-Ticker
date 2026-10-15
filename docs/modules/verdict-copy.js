// The one verdict wording, used by the app's /trade headline, a cold /t/
// link, the OG card, og:title/og:description, the Today line, the preview
// tags and the share text (client and functions). PM's final format describes
// the value columns instead of naming a winner:
//   Fair trade · within 5%
//   Fair, slight edge · Get side worth 8.5% more        (amber)
//   Favors one side · Give side worth 15% more          (green/red on /trade only)
//   Lopsided · Give side worth 89.3% more               (green/red on /trade only)
// One metric, on the credited totals: shown = (bigger - smaller) / smaller,
// one decimal, so "worth N% more" is true. The tiers are banded on that same
// shown number (RECHECK3): <= 5 fair, <= 14 slight edge, <= 28 favors, else
// lopsided. valueCalcVerdict's own pct (gap / larger, 5/12/22) still drives
// the app's offer text, the even-up line and trade ideas.
// Colour: tone (good | fair | bad) is relative to the sharer and is used only
// on private /trade. publicTone (fair | strong) colours only the tier on the
// public card and cold /t; direction is shown by placement and a pointer.
import { valueCalcVerdict } from "./value-calc.js";

// Labels valueCalcVerdict gives when both sides are filled in.
const BOTH_SIDES = new Set(["Dead even", "Fair, leans Get", "Fair, leans Give", "Favors Get", "Favors Give", "Lopsided for Get", "Lopsided for Give"]);

// Upper bounds (inclusive) on the shown "% more".
export const TIER_BANDS = Object.freeze({ even: 5, edge: 14, favors: 28 });
const LABEL = Object.freeze({ even: "Fair trade", edge: "Fair, slight edge", favors: "Favors one side", lopsided: "Lopsided" });

// The ⓘ explainer line for the tiers.
export const TIER_EXPLAINER = `How the verdict reads: one side's total (stars included) is compared with the other's. Within ${TIER_BANDS.even}% is a fair trade, up to ${TIER_BANDS.edge}% more is a fair, slight edge, up to ${TIER_BANDS.favors}% more favors one side, and more than ${TIER_BANDS.favors}% is lopsided.`;

export function tierForMore(more) {
  if (more == null) return "lopsided";
  if (more <= TIER_BANDS.even) return "even";
  if (more <= TIER_BANDS.edge) return "edge";
  if (more <= TIER_BANDS.favors) return "favors";
  return "lopsided";
}

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
  if (!BOTH_SIDES.has(String(verdict?.label || ""))) {
    const label = String(verdict?.label || "");
    return { tier: "", side: "", label, more: null, tierPct: 0, detail: "", pctText: "", line: label, tone: "", publicTone: "" };
  }
  const left = Number(verdict.left) || 0;
  const right = Number(verdict.right) || 0;
  const more = percentMore(left, right);
  const hit = { tier: tierForMore(more) };
  hit.label = LABEL[hit.tier];
  const side = right > left ? "Get" : left > right ? "Give" : "";
  const amount = more == null ? "" : `${more}% `;
  const detail = hit.tier === "even"
    ? `within ${TIER_BANDS.even}%`
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
    publicTone: hit.tier === "even" || hit.tier === "edge" ? "fair" : "strong",
  };
}

export function verdictCopyFor(giveTotal, getTotal, counts = {}) {
  return verdictCopy(valueCalcVerdict(giveTotal, getTotal, counts));
}
