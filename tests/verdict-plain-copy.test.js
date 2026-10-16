// The verdict explanation is plain English. Pending Designer.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FEWER_BETTER_ADDEND,
  FEWER_BETTER_LABEL,
  FEWER_BETTER_LINE,
  PRICE_FACTORS_LINE,
  STAR_PREMIUM_KEY,
  TIER_EXPLAINER,
  UNAVAILABLE_PRICE_LINE,
  barLabel,
  creditedTotalsLine,
  fewerBetterBody,
  fewerBetterOffer,
} from "../docs/modules/verdict-copy.js";
import { meterTrack, starsPremiumMarkup } from "../docs/modules/verdict-bars.js";
import { creditLine } from "../docs/modules/trade-share.js";
import { shareText } from "../netlify/lib/trade-share.js";
import { renderCardSvg } from "../netlify/lib/trade-card.js";
import { valueCalcVerdict } from "../docs/modules/value-calc.js";

const BANNED = [
  /\bcredits?\b/i,
  /\bconsolidation\b/i,
  /\bpremium\b/i,
  /\bdelta\b/i,
  /\bmultipliers?\b/i,
  /\bstud\b/i,
  /\bsnapshot\b/i,
  /\bfallback\b/i,
  /\bPPR\b/,
  /package adjustment/i,
  /stars cost extra/i,
  /star premium/i,
  /package credit/i,
];

const detail = creditedTotalsLine({ giveListed: 11811, getListed: 14457, stars: 7413, starSide: "give" });
const label = barLabel("Give", 12911, 8561);
const paragraph = starsPremiumMarkup(
  { adjustment: { amount: 7413, side: "left" } },
  { best: "Bijan Robinson" },
);
const paragraphGet = starsPremiumMarkup({ adjustment: { amount: 1500, side: "right" } }, { best: "Ja'Marr Chase" });
const paragraphNoName = starsPremiumMarkup({ adjustment: { amount: 1500, side: "right" } });
const offer = fewerBetterOffer("7,413", "my side");
const cardSummary = {
  give: [{ name: "Bijan Robinson", value: 11811, position: "RB" }],
  get: [{ name: "Malik Nabers", value: 9000, position: "WR" }, { name: "2027 Early 1st", value: 5457, position: "PICK" }],
  credit: { amount: 7413, side: "give" },
  giveTotal: 11811,
  getTotal: 14457,
  giveCredited: 19224,
  getCredited: 14457,
  stamp: "",
  formatLabel: "Superflex",
  verdict: valueCalcVerdict(19224, 14457),
};
const description = shareText(cardSummary).description;
const card = renderCardSvg(cardSummary);
const hatch = meterTrack({ listed: 11811, stars: 7413, total: 19224 }, 19224);

const explanation = [
  FEWER_BETTER_LABEL,
  FEWER_BETTER_ADDEND,
  FEWER_BETTER_LINE,
  PRICE_FACTORS_LINE,
  UNAVAILABLE_PRICE_LINE,
  TIER_EXPLAINER,
  fewerBetterBody("7,413", "give", "Bijan Robinson"),
  paragraphGet,
  paragraphNoName,
  offer,
  detail,
  label,
  paragraph,
  creditLine({ credit: { amount: 7413 } }),
  description,
  card,
  hatch,
  STAR_PREMIUM_KEY,
].join("\n");

test("the verdict explanation is plain English and keeps the numbers", () => {
  for (const pattern of BANNED) assert.doesNotMatch(explanation, pattern, String(pattern));
  assert.match(paragraph, /<strong>Fewer, better players:<\/strong> Bijan Robinson is the best player in this deal\. One great player is worth more than several smaller ones adding up to the same total, so we add 7,413 to what you give\. Player prices don&#39;t change\.<\/p>/);
  assert.doesNotMatch(paragraph, /After that|getting fewer|adds 7,413 to You give/);
  assert.match(paragraphGet, /Ja&#39;Marr Chase is the best player in this deal\. .*so we add 1,500 to what you get\./);
  assert.match(paragraphNoName, /The best player in this deal is on this side\. .*so we add 1,500 to what you get\./);
  assert.equal(FEWER_BETTER_LINE, "Fewer, better players are worth extra compared with the same total split into smaller pieces. That extra changes the trade verdict, not any player's listed price.");
  assert.match(TIER_EXPLAINER, /including the extra for fewer, better players/);
  assert.match(TIER_EXPLAINER, /Within 5% is a fair trade, up to 14% more is a fair, slight edge, up to 28% more favors one side, and more than 28% is lopsided\./);
  assert.equal(detail, "Give 19,224 (11,811 + 7,413 for fewer, better players). Get 14,457.");
  assert.equal(label, "Give 21,472 including 8,561 for fewer, better players");
  assert.equal(STAR_PREMIUM_KEY, "Fewer, better players");
  assert.equal(creditLine({ credit: { amount: 7413 } }), "Fewer, better players +7,413");
  assert.equal(offer, "Extra for fewer, better players +7,413 to my side.");
  assert.match(description, /Give 11,811 \+ 7,413 for fewer, better players = 19,224/);
  assert.match(card, />Fewer, better players</);
  assert.match(hatch, /title="Fewer, better players"/);
  assert.match(PRICE_FACTORS_LINE, /how long players at that position usually stay good/);
  assert.match(UNAVAILABLE_PRICE_LINE, /we do not have a price for that player or pick right now/);

  const escaped = starsPremiumMarkup(
    { adjustment: { amount: 1000, side: "right" } },
    { best: "A & <B>" },
  );
  assert.match(escaped, /A &amp; &lt;B&gt; is the best player/);
  assert.doesNotMatch(escaped, /A & <B>/);
});

test("the verdict explanation source no longer says package credit or star premium", () => {
  const app = readFileSync(new URL("../docs/app.js", import.meta.url), "utf8");
  const bars = readFileSync(new URL("../docs/modules/verdict-bars.js", import.meta.url), "utf8");
  const copy = readFileSync(new URL("../docs/modules/verdict-copy.js", import.meta.url), "utf8");
  const share = readFileSync(new URL("../docs/modules/trade-share.js", import.meta.url), "utf8");
  const cardJs = readFileSync(new URL("../netlify/lib/trade-card.js", import.meta.url), "utf8");
  const meta = readFileSync(new URL("../netlify/lib/trade-share.js", import.meta.url), "utf8");
  const source = [app, bars, copy, share, cardJs, meta].join("\n");
  assert.doesNotMatch(source, /Package credit|package credit|Package adjustment|package adjustment|Stars cost extra|star premium|stars cost extra/i);
  assert.equal((app.match(/starsPremiumMarkup\(model, \{ best \}\)/g) || []).length, 2);
  assert.doesNotMatch(app, /starsPremiumMarkup\(model, \{[^}]*detail/);
  assert.match(app, /fewerBetterOffer\(formatNumber\(adjustment\.amount\), creditSide\)/);
  assert.match(app, /PRICE_FACTORS_LINE,/);
  assert.match(app, /lines\.push\(UNAVAILABLE_PRICE_LINE\)/);
  assert.match(app, /lines\.push\(FEWER_BETTER_LINE\)/);
});

test("the extra names the best player and lands on the side that has him", async () => {
  const { bestRowName } = await import("../docs/modules/verdict-bars.js");
  assert.equal(bestRowName([{ name: "Malik Nabers", value: 9000 }, { name: "2027 Early 1st", value: 5457 }]), "Malik Nabers");
  assert.equal(bestRowName([]), "");
  assert.match(fewerBetterBody("7,413", "give", "Bijan Robinson"), /^Bijan Robinson is the best player in this deal\..*to what you give\. Player prices don't change\.$/);
  assert.match(fewerBetterBody("7,413", "get", "Bijan Robinson"), /to what you get\./);
});
