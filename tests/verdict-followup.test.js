// Verdict follow-up: one metric (gap / smaller side) and the 5/14/28 bands on
// every verdict surface, spaced dots, inline ⓘ, the star premium detail line,
// and an accessible stars legend.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  EVEN_UP_CLOSES_AT,
  EVEN_UP_OFFER_ABOVE,
  STAR_PREMIUM_KEY,
  TIER_BANDS,
  barLabel,
  creditedTotalsLine,
  verdictCopyFor,
  verdictLineNamed,
} from "../docs/modules/verdict-copy.js";
import { valueCalcVerdict } from "../docs/modules/value-calc.js";
import { evenUpPickChoice } from "../docs/modules/trade-draft.js";

const app = readFileSync(new URL("../docs/app.js", import.meta.url), "utf8");
const BANNED = /in favor of|\bwins?\b|overpay|leans|\byou\b|\bthem\b/i;

test("named-side lines use the shown % and the same tiers as the headline", () => {
  const names = { Give: "My side", Get: "Ben's side" };
  assert.equal(verdictLineNamed(valueCalcVerdict(10000, 12500), names), "Favors one side · Ben's side worth 25% more");
  assert.equal(verdictLineNamed(valueCalcVerdict(12500, 10000), names), "Favors one side · My side worth 25% more");
  assert.equal(verdictLineNamed(valueCalcVerdict(10000, 10400), names), "Fair trade · within 5%");
  // 12,820 vs 10,000 is 28.2% more: Lopsided on the shown metric (old metric said Favors at 22.0%).
  assert.equal(verdictLineNamed(valueCalcVerdict(10000, 12820), names), "Lopsided · Ben's side worth 28.2% more");
  for (const [a, b] of [[10000, 10499], [10000, 11400], [10000, 12800], [10000, 12810]]) {
    const named = verdictLineNamed(valueCalcVerdict(a, b), names);
    const plain = verdictCopyFor(a, b).line;
    assert.equal(named.split(" · ")[0], plain.split(" · ")[0]);
    assert.doesNotMatch(named, BANNED);
  }
  // Default names fall back to the plain line.
  assert.equal(verdictLineNamed(valueCalcVerdict(21031, 11112)), "Lopsided · Give side worth 89.3% more");
});

test("even-up uses the shown % and the bands: offered above 5% more, closes at <= 14% more", () => {
  assert.equal(EVEN_UP_OFFER_ABOVE, TIER_BANDS.even);
  assert.equal(EVEN_UP_CLOSES_AT, TIER_BANDS.edge);
  const pick = (pct) => evenUpPickChoice(3000, [{ name: "2027 1st", value: 3000 }], { scoreAdded: () => ({ gap: 100, pct, verdict: null }) });
  assert.equal(pick(13.9).closes, true);
  assert.equal(pick(14).closes, true);
  assert.equal(pick(14.1).closes, false);
  // The source no longer reads the old pct for the even-up gate or copy.
  assert.doesNotMatch(app, /verdict\.pct > 5/);
  assert.doesNotMatch(app, /still \$\{choice\.pct\}% apart/);
  assert.match(app, /After that pick: \$\{after\}\./);
  const draft = readFileSync(new URL("../docs/modules/trade-draft.js", import.meta.url), "utf8");
  assert.doesNotMatch(draft, /const EVEN_UP_FAIR_PCT = 12;/);
  assert.match(draft, /percentMore\(model\.verdict\.left, model\.verdict\.right\)/);
});

test("offer text and trade ideas print the verdict line, not '% apart' on the old metric", () => {
  assert.doesNotMatch(app, /\$\{verdict\.pct\}% apart/);
  assert.doesNotMatch(app, /\$\{idea\.pctDiff\}% apart/);
  assert.doesNotMatch(app, /\$\{participant\.pctDiff\}% diff/);
  assert.match(app, /\$\{credit\} \$\{line\}\. Dynasty Ticker prices/);
  assert.equal((app.match(/verdictLineNamed\(valueCalcVerdict\(/g) || []).length, 2);
});

test("every verdict line has spaces around the dot, and the page keeps them visible", () => {
  for (const [a, b] of [[10000, 10400], [10000, 11000], [10000, 12500], [21031, 11112], [11000, 10000]]) {
    const line = verdictCopyFor(a, b).line;
    assert.match(line, /^[^·]+\S · \S[^·]+$/, line);
  }
  assert.match(app, /function verdictLineHtml\(line\)[\s\S]{0,200}split\(" · "\)[\s\S]{0,80}join\(` <span class="verdict-dot">·<\/span> `\)/);
  assert.match(app, /<h3>\$\{verdictLineHtml\(label\)\}<\/h3>/);
  assert.match(app, /<h3>\$\{verdictLineHtml\(shared\.today\.label\)\}<\/h3>/);
});

test("the ⓘ sits inline at the end of the /t subline", () => {
  assert.match(app, /<p class="calc-subline">\$\{leadHtml\} <button type="button" class="info-toggle verdict-info-toggle"/);
  assert.match(app, /How this verdict works<\/span>\s*<\/button><\/p>/);
});

test("/t detail line: credited Give with the star premium in brackets", () => {
  assert.equal(
    creditedTotalsLine({ giveListed: 11811, getListed: 14457, stars: 7413, starSide: "give" }),
    "Give 19,224 (11,811 + 7,413 star premium). Get 14,457.",
  );
  assert.equal(
    creditedTotalsLine({ giveListed: 9000, getListed: 8000, stars: 1500, starSide: "get" }),
    "Give 9,000. Get 9,500 (8,000 + 1,500 star premium).",
  );
  assert.equal(creditedTotalsLine({ giveListed: 9000, getListed: 8000 }), "Give 9,000. Get 8,000.");
});

test("stars legend: visible hatch key and a text label on the bar", () => {
  assert.equal(barLabel("Give", 12911, 8561), "Give 21,472 including 8,561 star premium");
  assert.equal(barLabel("Get", 11112, 0), "Get 11,112");
  assert.equal(STAR_PREMIUM_KEY, "Star premium");
  assert.match(app, /<p class="calc-legend"><span class="calc-legend-swatch" aria-hidden="true"><\/span>\$\{escapeHtml\(STAR_PREMIUM_KEY\)\}<\/p>/);
  assert.match(app, /class="meter-track meter-split" role="img" aria-label="\$\{escapeHtml\(label\)\}"/);
  const css = readFileSync(new URL("../docs/styles.css", import.meta.url), "utf8");
  assert.match(css, /\.calc-legend-swatch \{[\s\S]*repeating-linear-gradient/);
});
