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

test("trade ideas: an idea that passes a filter never shows a verdict outside that filter's band", async () => {
  const { ideaLimitMore, ideaGapMore, oldPctToMore, tierForMore, percentMore } = await import("../docs/modules/verdict-copy.js");
  const { calculatePctDiff } = await import("../docs/modules/package-value.js");
  const RANK = { even: 0, edge: 1, favors: 2, lopsided: 3 };
  assert.equal(oldPctToMore(20), 25);
  assert.equal(ideaLimitMore(20), 25); // balanced default pinned at 25, not the 28 ceiling
  assert.equal(ideaLimitMore(4), 5);
  assert.equal(ideaLimitMore(12), 14);
  assert.equal(ideaLimitMore(24), 31.6); // past 28 the band is Lopsided, capped
  // Every setting the app uses: defaults, match, the 26 floor, vibes, multi-team buffers.
  const settings = [4, 6, 12, 20, 24, 26, 28, 30, 34];
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = 0; i < 4000; i += 1) {
    const a = Math.round(500 + rand() * 20000);
    const b = Math.round(500 + rand() * 20000);
    const shown = percentMore(a, b);
    assert.equal(calculatePctDiff(a, b), shown);
    assert.equal(ideaGapMore(a, b), shown);
    for (const setting of settings) {
      const limit = ideaLimitMore(setting);
      if (calculatePctDiff(a, b) > limit) continue;
      assert.ok(RANK[tierForMore(shown)] <= RANK[tierForMore(limit)], `${a}/${b} at ${setting}`);
    }
  }
  assert.equal(calculatePctDiff(0, 5000), 1000);
  // Each filter site compares against ideaLimitMore, never a raw setting.
  assert.match(app, /pctDiff > ideaLimitMore\(Math\.max\(fairnessPct, 26\)\)/);
  assert.equal((app.match(/pctDiff > ideaLimitMore\(effectiveFairnessPct\)/g) || []).length, 3);
  assert.match(app, /pctDiff > ideaLimitMore\(fairnessLimit\)/);
  const match = readFileSync(new URL("../docs/modules/trade-match.js", import.meta.url), "utf8");
  assert.match(match, /percentDiff\(mine, theirs\) <= ideaLimitMore\(fairnessPct\)/);
  // Wording: "% more", not "diff" / "gap at".
  assert.match(app, /one side worth up to \$\{idea\.maxPctDiff\}% more/);
  assert.match(app, /after adjustments one side is worth \$\{idea\.pctDiff\}% more\./);
  assert.doesNotMatch(app, /% diff •|adjusted-value gap at/);
  for (const text of ["one side worth up to 9% more", "after adjustments one side is worth 9% more."]) assert.doesNotMatch(text, BANNED);
});

test("Get-pane chip price meets 4.5:1 on its chip, and the legend swatch is 10–12px tall", () => {
  const css = readFileSync(new URL("../docs/styles.css", import.meta.url), "utf8");
  const rule = /\.calc-pane\.team-b \.selected-token-price \{([^}]*)\}/.exec(css)?.[1] || "";
  assert.match(rule, /opacity: 1;/);
  const hex = /color: #([0-9a-f]{6});/i.exec(rule)?.[1];
  assert.ok(hex, "explicit chip price color");
  const lum = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  // #333e52: the chip background as rendered (team-b-soft over the Get pane), sampled at 390.
  const ratio = (lum(hex) + 0.05) / (lum("333e52") + 0.05);
  assert.ok(ratio >= 4.5, `chip price contrast ${ratio.toFixed(2)}`);
  const swatch = /\.calc-legend-swatch \{([^}]*)\}/.exec(css)?.[1] || "";
  const height = Number(/height: (\d+)px/.exec(swatch)?.[1]);
  assert.ok(height >= 10 && height <= 12, `swatch ${height}px`);
});

test("cold /t: shared layout, CTA and kept server title are wired", () => {
  assert.match(app, /const shared = Boolean\(activeSharedTrade\(view\.draft\)\);/);
  assert.match(app, /<span class="eyebrow">Shared trade<\/span>/);
  const shared = app.slice(app.indexOf('<div class="shared-trade-head">'), app.indexOf("<details class=\"shared-trade-about\">"));
  assert.ok(shared.indexOf('id="value-calc-verdict"') < shared.indexOf('class="calc-grid"'), "verdict before the sides");
  assert.match(app, /data-action="shared-check-own">Check your own trade<\/a>/);
  assert.match(app, /function serverShareMeta\(\)/);
});

test("default idea fairness is pinned at 25% more on the shown metric", async () => {
  const { DEFAULT_FAIRNESS_PCT } = await import("../docs/modules/constants.js");
  const { DEFAULT_IDEA_LIMIT_MORE, ideaLimitMore, oldPctToMore, tierForMore } = await import("../docs/modules/verdict-copy.js");
  assert.equal(DEFAULT_IDEA_LIMIT_MORE, 25);
  assert.equal(ideaLimitMore(DEFAULT_FAIRNESS_PCT), 25);
  assert.equal(oldPctToMore(DEFAULT_FAIRNESS_PCT), 25); // same reach as before launch
  assert.equal(tierForMore(25), "favors");
  // Non-default settings unchanged.
  assert.equal(ideaLimitMore(12), 14);
  assert.equal(ideaLimitMore(24), 31.6);
  assert.equal(ideaLimitMore(26), 35.1);
});
