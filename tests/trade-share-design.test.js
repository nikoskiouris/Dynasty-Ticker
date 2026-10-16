// Review-164 fixes: credited math on the card and meta, neutral wording,
// OG-CARD layout, measured truncation, and /t/<code> staying in the address bar.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  cardVerdict,
  creditLine,
  decodeTradeShare,
  neutralVerdict,
  shareMessage,
  shareSummary,
} from "../docs/modules/trade-share.js";
import { matchRoute, pathForPlace } from "../docs/modules/history-route.js";
import { TIER_BANDS, TIER_EXPLAINER, percentMore, tierForMore, verdictCopy, verdictCopyFor } from "../docs/modules/verdict-copy.js";
import { createSharePageHandler, injectShareMeta, shareText, summaryForCode } from "../netlify/lib/trade-share.js";
import { loadCardArt, renderCardSvg } from "../netlify/lib/trade-card.js";
import { createMeasurer, truncateToWidth } from "../netlify/lib/text-measure.js";

const root = dirname(fileURLToPath(import.meta.url));
const values = JSON.parse(readFileSync(join(root, "../docs/data/player_values.json"), "utf8"));
const bold = readFileSync(join(root, "../netlify/fonts/instrument-sans-700.ttf"));
const measure = createMeasurer(bold);
// Real Sleeper ids: 9509 Bijan Robinson, 11632 Malik Nabers, 9493 Puka Nacua,
// 7564 Ja'Marr Chase, 9488 Jaxon Smith-Njigba, 7547 Amon-Ra St. Brown.
const names = {};
for (const [key, name] of Object.entries(values.names)) if (key.startsWith("player:")) names[key.slice(7)] = name;
const summaryOf = (code) => shareSummary(decodeTradeShare(code), values, names);
const indexHtml = readFileSync(join(root, "../docs/index.html"), "utf8");
const svgText = (svg) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);

test("credited totals: rows plus 'Stars cost extra' add up to each side, and the gap is their difference", () => {
  for (const code of ["1s9509~11632.p27r1e", "1s7564~11632.p27r2a", "1sp27r1e.p28r1a~p27r2a.p27r3a.p28r2a.p28r1e.p27r1l", "1s9509~9493"]) {
    const s = summaryOf(code);
    const sum = (rows) => rows.reduce((total, row) => total + row.value, 0);
    const credit = (side) => (s.credit?.side === side ? s.credit.amount : 0);
    assert.ok(Math.abs(sum(s.give) + credit("give") - s.giveCredited) <= 1, code);
    assert.ok(Math.abs(sum(s.get) + credit("get") - s.getCredited) <= 1, code);
    assert.equal(s.gap, s.getCredited - s.giveCredited);
    const pct = Math.round((Math.abs(s.gap) / Math.max(s.giveCredited, s.getCredited)) * 1000) / 10;
    assert.equal(s.pct, pct, code);
  }
});

test("the card never shows a verdict for the side with the smaller total", () => {
  for (const code of ["1s9509~11632.p27r1e", "1s7564~11632.p27r2a", "1sp27r1e.p28r1a~p27r2a.p27r3a.p28r2a.p28r1e.p27r1l"]) {
    const s = summaryOf(code);
    const svg = renderCardSvg(s, { measure });
    const texts = svgText(svg);
    const v = cardVerdict(s);
    assert.ok(texts.includes(s.giveCredited.toLocaleString("en-US")), `${code} give total`);
    assert.ok(texts.includes(s.getCredited.toLocaleString("en-US")), `${code} get total`);
    if (s.credit) {
      assert.ok(texts.includes("Stars cost extra"));
      assert.ok(texts.includes(`+${s.credit.amount.toLocaleString("en-US")}`));
      assert.equal(creditLine(s), `Stars cost extra +${s.credit.amount.toLocaleString("en-US")}`);
    }
    // The side named is the column worth more, by the true "% more".
    const bigger = s.giveCredited > s.getCredited ? "Give" : "Get";
    const small = Math.min(s.giveCredited, s.getCredited);
    const more = Math.round((Math.abs(s.giveCredited - s.getCredited) / small) * 1000) / 10;
    if (v.text !== "Fair trade") assert.equal(v.pctText, `${bigger} side worth ${more}% more`, code);
    // RECHECK3: public card colours only the tier, never red/green by side.
    assert.ok(["fair", "strong"].includes(v.tone), code);
    assert.doesNotMatch(svg, /#3dcc8a|#ff7a72/i, code);
  }
});

test("og:title, og:description and alt use the card verdict and credited totals", () => {
  const s = summaryOf("1s9509~11632.p27r1e");
  const { title, description, alt } = shareText(s);
  const v = cardVerdict(s);
  assert.equal(title, `Bijan Robinson for Malik Nabers, 2027 Early 1st: ${v.text} · ${v.pctText}`);
  assert.equal(v.line, "Lopsided · Give side worth 33% more"); // 19,224 vs 14,457
  assert.match(description, /^Give 11,811 \+ [\d,]+ stars cost extra = [\d,]+ vs get 14,457\./);
  assert.match(description, /Check your own trade free at Dynasty Ticker\.$/);
  assert.ok(alt.includes(s.giveCredited.toLocaleString("en-US")));
  assert.doesNotMatch(`${title} ${description} ${alt}`, /overpay|\bwin\b|\bthem\b/i);
});

test("verdict format: tier · column worth N% more, tiers banded on the shown N at 5 / 14 / 28", () => {
  const at = (give, get) => verdictCopyFor(give, get);
  assert.deepEqual(TIER_BANDS, { even: 5, edge: 14, favors: 28 });
  assert.equal(at(10000, 10400).line, "Fair trade · within 5%");
  assert.equal(at(10000, 10400).tierPct, 3.8); // app metric, kept for offer text only
  assert.equal(at(10000, 11000).line, "Fair, slight edge · Get side worth 10% more");
  assert.equal(at(11000, 10000).line, "Fair, slight edge · Give side worth 10% more");
  assert.equal(at(11000, 10000).tone, "fair");
  assert.equal(at(10000, 12500).line, "Favors one side · Get side worth 25% more");
  assert.equal(at(10000, 12500).tone, "good"); // private /trade only
  assert.equal(at(12500, 10000).tone, "bad");
  assert.equal(at(12500, 10000).publicTone, "strong");
  assert.equal(at(10000, 12500).publicTone, "strong");
  assert.equal(at(11000, 10000).publicTone, "fair");
  assert.equal(at(20000, 10000).line, "Lopsided · Give side worth 100% more");
  assert.equal(percentMore(11112, 21031), 89.3);
  // PM's acceptance case: Gibbs for two 1sts (credited 21,031 vs 11,112).
  const gibbs = summaryOf("1s9221~p27r1e.p28r1a");
  assert.equal(gibbs.giveCredited, 21031);
  assert.equal(gibbs.getCredited, 11112);
  assert.equal(gibbs.pct, 47.2); // app metric: gap / larger side
  assert.equal(cardVerdict(gibbs).line, "Lopsided · Give side worth 89.3% more");
  assert.equal(cardVerdict(gibbs).tone, "strong");
  const fair = renderCardSvg(summaryOf("1s9509~9493"), { measure });
  assert.match(fair, /font-size="48" font-weight="700" fill="#f0c36a">Fair trade</);
  assert.ok(svgText(fair).includes("within 5%"));
});

test("tier bands: just below and just above 5, 14 and 28 (shown % more), both directions", () => {
  const cases = [
    [10499, "even", "Fair trade · within 5%"], [10500, "even", "Fair trade · within 5%"],
    [10510, "edge", "Fair, slight edge · Get side worth 5.1% more"],
    [11390, "edge", "Fair, slight edge · Get side worth 13.9% more"], [11400, "edge", "Fair, slight edge · Get side worth 14% more"],
    [11410, "favors", "Favors one side · Get side worth 14.1% more"],
    [12790, "favors", "Favors one side · Get side worth 27.9% more"], [12800, "favors", "Favors one side · Get side worth 28% more"],
    [12810, "lopsided", "Lopsided · Get side worth 28.1% more"],
  ];
  for (const [big, tier, line] of cases) {
    const up = verdictCopyFor(10000, big);
    assert.equal(up.tier, tier, `${big}`);
    assert.equal(up.line, line, `${big}`);
    const down = verdictCopyFor(big, 10000);
    assert.equal(down.tier, tier, `reverse ${big}`);
    assert.equal(down.line, line.replace("Get side", "Give side"), `reverse ${big}`);
  }
  // RECHECK3's table now reads with matching numbers.
  assert.equal(verdictCopyFor(10000, 10527).tier, "edge"); // 5.3%
  assert.equal(verdictCopyFor(10000, 11363).tier, "edge"); // 13.6%
  assert.equal(verdictCopyFor(10000, 12820).tier, "lopsided"); // 28.2%
  assert.equal(verdictCopyFor(10000, 12830).tier, "lopsided"); // 28.3%
  assert.equal(tierForMore(null), "lopsided");
  assert.match(TIER_EXPLAINER, /Within 5%.*up to 14% more.*up to 28% more.*more than 28%/);
  assert.doesNotMatch(TIER_EXPLAINER, /in favor of|\bwins?\b|overpay|leans|\byou\b|\bthem\b/i);
});

test("parity: app, /t page, card, og:title, og:description and share text say the same verdict", () => {
  const codes = ["1s9509~11632.p27r1e", "1s7564~11632.p27r2a", "1s9488~12527.13287.p28r1a.p27r2a",
    "1sp27r1e.p28r1a~p27r2a.p27r3a.p28r2a.p28r1e.p27r1l", "1s9509~9493", "1s9509~9221", "1s9221~9509", "1q4984~9221",
    "1s9221~p27r1e.p28r1a", "1sp27r1e.p28r1a~9221"];
  const BANNED = /in favor of|\bwins?\b|overpay|leans|\byou\b|\bthem\b/i;
  const app = readFileSync(join(root, "../docs/app.js"), "utf8");
  // The app's verdict heading and tone come from verdictCopy(model.verdict).
  assert.match(app, /const copy = verdictCopy\(verdict\);[\s\S]{0,120}const label = bothSides \? copy\.line : copy\.label;/);
  assert.match(app, /calc-summary \$\{bothSides \? \(sharedView \? copy\.publicTone : copy\.tone\) : ""\}/);
  // Cold /t leads with the credited totals the verdict compares.
  assert.match(app, /sharedView \? sharedTotalsLine\(model\)/);
  assert.match(app, /lines\.push\(TIER_EXPLAINER\)/);
  const tiers = new Set();
  for (const code of codes) {
    const s = summaryOf(code);
    const appCopy = verdictCopy(s.verdict); // the same valueCalcVerdict the calculator renders
    tiers.add(appCopy.tier);
    const card = cardVerdict(s);
    const svg = renderCardSvg(s, { measure });
    const { title, description } = shareText(s);
    assert.equal(card.text, appCopy.label, code);
    assert.equal(card.tone, appCopy.publicTone, code);
    assert.equal(s.label, appCopy.line, code); // /t heading and compare rows
    assert.ok(svgText(svg).includes(appCopy.label), code);
    assert.ok(svgText(svg).includes(appCopy.pctText), code);
    assert.ok(title.endsWith(`: ${appCopy.line}`), code);
    assert.match(appCopy.line, /^(Fair trade · within 5%|(Fair, slight edge|Favors one side|Lopsided) · (Give|Get) side worth [\d.]+% more)$/, code);
    assert.equal(shareMessage(s), `${appCopy.line}. Check it on Dynasty Ticker.`);
    for (const text of [card.text, s.label, title, description, shareMessage(s)]) {
      assert.doesNotMatch(text, BANNED, code);
    }
    // Every og:/twitter: preview tag and the <title>, including Shared vs Today.
    const today = summaryOf(code.replace(/^1s/, "1q"));
    for (const html of [injectShareMeta(indexHtml, { summary: s, code }), injectShareMeta(indexHtml, { summary: s, today, code })]) {
      const tags = [...html.matchAll(/<meta (?:property="og:[^"]+"|name="twitter:[^"]+") content="([^"]*)"/g)].map((m) => m[1]);
      const titleTag = /<title>([^<]*)<\/title>/.exec(html)[1];
      assert.ok(tags.length >= 10, code);
      for (const text of [...tags, titleTag]) assert.doesNotMatch(text, BANNED, `${code}: ${text}`);
    }
    assert.match(shareText(s, { today }).description, new RegExp(`Today: ${cardVerdict(today).line.replace(/[.,]/g, "\\$&")}\\.`));
  }
  assert.ok(tiers.size >= 3, `covers several tiers: ${[...tiers]}`);
});


test("card layout follows OG-CARD.md: sans only, wordmark, bottom bar, pills, +N more, no marks or headshots", async () => {
  const art = await loadCardArt();
  const s = summaryOf("1sp27r1e.p28r1a~p27r2a.p27r3a.p28r2a.p28r1e.p27r1l");
  const svg = renderCardSvg(s, art);
  assert.doesNotMatch(svg, /serif"|Instrument Serif/);
  assert.doesNotMatch(svg, /<image|KTC|keeptradecut|sleepercdn|football-forecast/i);
  assert.match(svg, /<svg x="64" y="63" width="\d+" height="34" viewBox="0 0 363\.6/); // wordmark
  // Neutral two-tone split bar; the bigger side gets the brighter tone.
  assert.match(svg, /<rect x="0" y="618" width="\d+" height="12" fill="#(?:e4dcd4|4a4540)"\/><rect x="\d+" y="618" width="\d+" height="12" fill="#(?:e4dcd4|4a4540)"\/>/);
  assert.ok(svgText(svg).includes("+1 more"));
  assert.equal(svgText(svg).filter((t) => t === "PK").length, 6); // 2 + 4 shown
  const players = renderCardSvg(summaryOf("1s9509~11632"), art);
  assert.ok(svgText(players).includes("RB") && svgText(players).includes("WR"));
  assert.match(players, /font-size="48" font-weight="700" fill="#(?:f4f1ec|f0c36a)">/);
});

test("names truncate by measured width at 28px, never shrinking", () => {
  assert.equal(truncateToWidth("Amon-Ra St. Brown", 400, 28, measure), "Amon-Ra St. Brown");
  const cut = truncateToWidth("Amon-Ra St. Brown", 200, 28, measure);
  assert.match(cut, /…$/);
  assert.ok(measure(cut, 28) <= 200);
  assert.ok(measure("WWWWWWWWWW", 28) > measure("iiiiiiiiii", 28) * 3, "real advance widths");
  // A long 4-asset side: every name fits its column next to its value.
  const s = shareSummary(decodeTradeShare("1s9509~7547.9488.4984.9221"), values, {
    ...names,
    7547: "Amon-Ra St. Brown Wwwwwwwwwwwwwwwwwwww",
    9488: "Jaxon Smith-Njigba Mmmmmmmmmmmmmm",
  });
  const svg = renderCardSvg(s, { measure });
  assert.doesNotMatch(svg, /font-size="(?:1\d|2[0-3])" font-weight="600"/);
  const rows = [...svg.matchAll(/<text x="(\d+)" y="\d+" font-family="Instrument Sans" font-size="28" font-weight="600" fill="#f4f1ec">([^<]*)<\/text><text x="(\d+)"[^>]*>([^<]*)</g)];
  assert.equal(rows.length, 5);
  for (const [, nameX, name, valueX, value] of rows) {
    const decoded = name.replace(/&#39;/g, "'").replace(/&amp;/g, "&");
    assert.ok(Number(nameX) + measure(decoded, 28) <= Number(valueX) - measure(value, 28) - 8, decoded);
  }
});

test("an archived board without positions borrows them from today's board", async () => {
  const snapshot = { asOf: values.asOf, sf: values.sf, oneQb: values.oneQb };
  const hit = await summaryForCode("2s2026101419179509~11632", {
    loadValues: async () => values,
    loadPlayerNames: async () => names,
    loadSnapshot: async () => snapshot,
  });
  assert.deepEqual(hit.summary.give.map((r) => r.position), ["RB"]);
  assert.deepEqual(hit.summary.get.map((r) => r.position), ["WR"]);
});

test("an opened /t link keeps /t/<code> in the address bar until the trade changes", () => {
  const route = matchRoute("/t/1s9509~11632.p27r1e");
  assert.equal(route.shareCode, "1s9509~11632.p27r1e");
  const place = { page: "trades", room: "calculator", give: route.give, get: route.get };
  assert.equal(pathForPlace({ ...place, shareCode: route.shareCode }), "/t/1s9509~11632.p27r1e");
  assert.equal(pathForPlace({ ...place, shareCode: route.shareCode, leagueId: "1180189013451112448" }), "/t/1s9509~11632.p27r1e");
  assert.match(pathForPlace(place), /^\/trade\?give=/);
  assert.match(pathForPlace({ ...place, shareCode: "bogus!" }), /^\/trade\?give=/);
});

const BAD_CODES = {
  garbage: "zzz",
  truncated: "2s202610141917~",
  "400 characters": "9".repeat(400),
  "out-of-range date": "2s2099999999999221~p27r1e",
  "wrong version": "3s4984~9221",
};

test("bad /t/ codes: 404, noindex, default meta; unknown valid stamps still work", async () => {
  const handler = createSharePageHandler({ loadValues: async () => values, loadPlayerNames: async () => names, readIndex: async () => indexHtml, origin: "https://dynastyticker.com" });
  for (const [name, code] of Object.entries(BAD_CODES)) {
    assert.equal(decodeTradeShare(code), null, name);
    const route = matchRoute(`/t/${code}`);
    assert.equal(route?.badShare, true, name);
    assert.deepEqual([route.give, route.get], [[], []], name);
    const res = await handler(new Request(`https://dynastyticker.com/t/${code}`));
    assert.equal(res.status, 404, name);
    assert.equal(res.headers.get("x-robots-tag"), "noindex", name);
    const html = await res.text();
    assert.match(html, /<meta name="robots" content="noindex" \/>/, name);
    assert.doesNotMatch(html, /\/og\/t\//, name);
    assert.match(html, /script-src 'self'/, name);
  }
  // A well-formed stamp with no archive is fine: today's prices, 200.
  const ok = await handler(new Request("https://dynastyticker.com/t/2s2025010112004984~9221"));
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("x-robots-tag"), null);
  // v1 (no date) is a supported version, not a bad one.
  assert.equal((await handler(new Request("https://dynastyticker.com/t/1s9221~p27r1e"))).status, 200);
});

test("card split bar is sized on the credited totals, same basis as /t bars (RECHECK4)", () => {
  for (const code of ["1s9509~11632.p27r1e", "1s9221~p27r1e.p28r1a", "1s9509~9221"]) {
    const s = summaryOf(code);
    const svg = renderCardSvg(s, { measure });
    const [, giveW, , getW] = /<rect x="0" y="618" width="(\d+)" height="12" fill="[^"]+"\/><rect x="(\d+)" y="618" width="(\d+)"/.exec(svg);
    assert.equal(Number(giveW), Math.round(1200 * s.giveCredited / (s.giveCredited + s.getCredited)), code);
    assert.equal(Number(giveW) + Number(getW), 1200, code);
  }
  const app = readFileSync(join(root, "../docs/app.js"), "utf8");
  const bars = readFileSync(join(root, "../docs/modules/verdict-bars.js"), "utf8");
  // /t bars: credited totals with a separate stars segment; private /trade keeps listed meters.
  assert.match(app, /const bars = sharedBarSegments\(model, sharedView \? null : meters\);/);
  assert.match(bars, /class="meter-stars"/);
});
