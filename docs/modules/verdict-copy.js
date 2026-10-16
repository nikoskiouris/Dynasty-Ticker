// The one verdict wording, used by the app's /trade headline, a cold /t/
// link, the OG card, og:title/og:description, the Today line, the preview
// tags and the share text (client and functions). PM's final format describes
// the value columns instead of naming a winner:
//   Fair trade · within 5%
//   Fair, slight edge · Get side worth 9% more          (amber)
//   Favors one side · Give side worth 15% more          (green/red on /trade only)
//   Lopsided · Give side worth 89% more                 (green/red on /trade only)
// Above 10× (more than 900% more) the sentence stops counting: "worth over 10× as much".
// Exactly 10× stays "900% more". A zero smaller side (null) uses the same cap.
// One metric, on the credited totals: (bigger - smaller) / smaller, kept to
// one decimal. Tiers are banded on that unrounded percent (RECHECK3): <= 5
// fair, <= 14 slight edge, <= 28 favors, else lopsided. The sentence prints a
// whole number: Math.round, unless that integer sits in a lower tier, in which
// case Math.ceil. A value just above 5, 14, or 28 never shows the boundary
// number of the tier below (28.3 is Lopsided and reads "29% more", not "28%
// more", which would read as Favors). "Fair trade · within 5%" is unchanged.
// Colour: tone (good | fair | bad) is relative to the sharer and is used only
// on private /trade. publicTone (fair | strong) colours only the tier on the
// public card and cold /t; direction is shown by placement and a pointer.
import { valueCalcVerdict } from "./value-calc.js";
import { DEFAULT_FAIRNESS_PCT } from "./constants.js";

// Labels valueCalcVerdict gives when both sides are filled in.
const BOTH_SIDES = new Set(["Dead even", "Fair, leans Get", "Fair, leans Give", "Favors Get", "Favors Give", "Lopsided for Get", "Lopsided for Give"]);

// Upper bounds (inclusive) on the unrounded "% more". The sentence may ceil past them.
export const TIER_BANDS = Object.freeze({ even: 5, edge: 14, favors: 28 });
const LABEL = Object.freeze({ even: "Fair trade", edge: "Fair, slight edge", favors: "Favors one side", lopsided: "Lopsided" });

// The ⓘ explainer line for the tiers.
export const TIER_EXPLAINER = `How the verdict reads: one side's total, including the extra for fewer, better players, is compared with the other's. Within ${TIER_BANDS.even}% is a fair trade, up to ${TIER_BANDS.edge}% more is a fair, slight edge, up to ${TIER_BANDS.favors}% more favors one side, and more than ${TIER_BANDS.favors}% is lopsided.`;

// Plain words for the extra on the side that has fewer, better players.
// Pending Designer. The numbers stay in the callers.
export const FEWER_BETTER_LABEL = "Fewer, better players";
export const FEWER_BETTER_ADDEND = "for fewer, better players";
export const PRICE_FACTORS_LINE = "The price uses age, role, how well a player plays, how often they play, their team, where they were drafted, and how long players at that position usually stay good. Connecting a league never changes a player's price.";
export const UNAVAILABLE_PRICE_LINE = "Unavailable means we do not have a price for that player or pick right now. Dynasty Ticker does not guess one.";
export const FEWER_BETTER_LINE = "Fewer, better players are worth extra compared with the same total split into smaller pieces. That extra changes the trade verdict, not any player's listed price.";

// side: "give" or "get", the side that has the best player and gets the extra.
// opts.pick: the best asset is a draft pick, so say "piece" instead of "player".
// opts.shared: a shared /t link, which talks about the Give side / Get side, not "you".
export function fewerBetterBody(amountText, side, bestName = "", { pick = false, shared = false } = {}) {
  const name = String(bestName || "").trim();
  const noun = pick ? "piece" : "player";
  const sideWord = side === "get" ? "get" : "give";
  const sideLabel = sideWord === "get" ? "Get side" : "Give side";
  let who;
  if (name && pick) who = `${/^the\s/i.test(name) ? name : `The ${name}`} is the best piece in this deal.`;
  else if (name) who = `${name} is the best player in this deal.`;
  else who = shared ? `The best ${noun} in this deal is on the ${sideLabel}.` : `The best ${noun} in this deal is on the ${sideWord} side.`;
  const what = shared ? `the ${sideLabel}` : `what you ${sideWord}`;
  return `${who} One great ${noun} is worth more than several smaller ones adding up to the same total, so we add ${amountText} to ${what}. Player prices don't change.`;
}

export function fewerBetterOffer(amountText, side) {
  return `Extra for fewer, better players +${amountText} to ${side}.`;
}

export function tierForMore(more) {
  if (more == null) return "lopsided";
  if (more <= TIER_BANDS.even) return "even";
  if (more <= TIER_BANDS.edge) return "edge";
  if (more <= TIER_BANDS.favors) return "favors";
  return "lopsided";
}

const round1 = (value) => Math.round(value * 10) / 10;

// (bigger - smaller) / smaller, one decimal. null when the smaller side is 0.
// Tiers use this unrounded percent. Sentences use displayMore.
export function percentMore(left, right) {
  const big = Math.max(Number(left) || 0, Number(right) || 0);
  const small = Math.min(Number(left) || 0, Number(right) || 0);
  if (small <= 0) return big > 0 ? null : 0;
  return round1(((big - small) / small) * 100);
}

// Whole percent. Round to nearest. For a verdict ({ band: true }, the default),
// step to ceil when that integer would belong to a lower tier, so the shown
// number never contradicts the tier. A limit is not a verdict: pass
// { band: false } for plain rounding. null stays null.
export function displayMore(more, { band = true } = {}) {
  if (more == null || !Number.isFinite(Number(more))) return null;
  const value = Number(more);
  const nearest = Math.round(value);
  if (!band) return nearest;
  const tier = tierForMore(value);
  if (tierForMore(nearest) === tier) return nearest;
  const up = Math.ceil(value);
  if (tierForMore(up) === tier) return up;
  return Math.floor(value);
}

// 10× the smaller side is 900% more. Anything past that, or a zero side, caps.
const TEN_X_MORE = 900;

function worthMorePhrase(name, more) {
  if (more == null || more > TEN_X_MORE) return `${name} worth over 10× as much`;
  const shown = displayMore(more);
  const amount = shown == null ? "" : `${shown}% `;
  return `${name} worth ${amount}more`;
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
  const detail = hit.tier === "even"
    ? `within ${TIER_BANDS.even}%`
    : worthMorePhrase(`${side} side`, more);
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

// Same verdict for surfaces that name the sides differently (the offer text,
// trade ideas, the even-up line): "Favors one side · My side worth 25% more".
// names: { Give, Get } display names for the two columns.
export function verdictLineNamed(verdict, names = {}) {
  const copy = verdictCopy(verdict);
  if (!copy.tier || copy.tier === "even" || !copy.side) return copy.line;
  const name = String(names[copy.side] || `${copy.side} side`);
  return `${copy.label} · ${worthMorePhrase(name, copy.more)}`;
}

// The even-up suggestion "closes" a trade when the shown % lands inside the
// two fair tiers (fair trade or fair, slight edge), and is offered only when
// the trade is outside "Fair trade".
export const EVEN_UP_OFFER_ABOVE = TIER_BANDS.even;
export const EVEN_UP_CLOSES_AT = TIER_BANDS.edge;

const countText = (value) => Math.round(Math.abs(Number(value) || 0)).toLocaleString("en-US");

// Cold /t detail line: listed total, then the extra for fewer, better players.
// "Give 19,224 (11,811 + 7,413 for fewer, better players). Get 14,457."
export function creditedTotalsLine({ giveListed = 0, getListed = 0, stars = 0, starSide = "" } = {}) {
  const part = (name, listed, key) => {
    const extra = starSide === key && stars > 0 ? Math.round(stars) : 0;
    return extra
      ? `${name} ${countText(listed + extra)} (${countText(listed)} + ${countText(extra)} ${FEWER_BETTER_ADDEND}).`
      : `${name} ${countText(listed)}.`;
  };
  return `${part("Give", Number(giveListed) || 0, "give")} ${part("Get", Number(getListed) || 0, "get")}`;
}

// Screen-reader label for a verdict bar: "Give 21,472 including 8,561 for fewer, better players".
export function barLabel(name, listed = 0, stars = 0) {
  const extra = Math.round(Number(stars) || 0);
  const total = (Number(listed) || 0) + extra;
  return extra > 0 ? `${name} ${countText(total)} including ${countText(extra)} ${FEWER_BETTER_ADDEND}` : `${name} ${countText(total)}`;
}

export const STAR_PREMIUM_KEY = FEWER_BETTER_LABEL;

// Trade-idea limits. Fairness settings are written on the old metric (gap /
// larger side, e.g. 20 or 24). An idea is filtered on the shown "% more" with
// that setting converted and snapped up to a band ceiling (5 / 14 / 28), so an
// idea never shows a verdict outside the band it was picked for. Past 28 the
// band is Lopsided and the converted number is the cap.
export function oldPctToMore(oldPct) {
  const p = Math.min(99, Math.max(0, Number(oldPct) || 0));
  return round1((p / (100 - p)) * 100);
}

// Launch default: Trade Lab's balanced setting (DEFAULT_FAIRNESS_PCT 20) is
// pinned at exactly 25% more, its old reach, not rounded up to 28. 25 is
// inside the Favors band, so no default idea shows a tier above Favors.
export const DEFAULT_IDEA_LIMIT_MORE = 25;

export function ideaLimitMore(oldPct) {
  if (Number(oldPct) === DEFAULT_FAIRNESS_PCT) return DEFAULT_IDEA_LIMIT_MORE;
  const more = oldPctToMore(oldPct);
  if (more <= TIER_BANDS.even) return TIER_BANDS.even;
  if (more <= TIER_BANDS.edge) return TIER_BANDS.edge;
  if (more <= TIER_BANDS.favors) return TIER_BANDS.favors;
  return more;
}

// The shown metric for two package values, as the whole number a chip prints.
// 1000 when a side is empty. Filters compare this same number.
export function ideaGapMore(a, b) {
  const more = percentMore(a, b);
  if (more == null || !(Number(a) > 0) || !(Number(b) > 0)) return 1000;
  return displayMore(more);
}
