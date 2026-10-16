import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDeskHistorySnapshot, scrollTopFromHistory } from "../docs/modules/desk-history.js";
import { matchRoute } from "../docs/modules/history-route.js";
import {
  INFO_HIT_OUTSET,
  INFO_HIT_PX,
  INFO_ICON_PX,
  closeInfoTip,
  createInfoTipController,
  infoTipMarkup,
  infoUsesSheet,
  openInfoTip,
} from "../docs/modules/info-tip.js";
import {
  EXAMPLE_GET,
  EXAMPLE_GIVE,
  LAUNCH_EXAMPLE_MIN_HEIGHT,
  LAUNCH_ROW_HEIGHT,
  LAUNCH_TREND_MIN_HEIGHT,
  exampleTradeFromValues,
  exampleTradeHref,
  launchExampleMarkup,
  launchSkeletonRows,
  launchTrendMarkup,
} from "../docs/modules/launch-landing.js";
import { draftVerdictModel } from "../docs/modules/trade-draft.js";
import { TIER_BANDS, displayMore, percentMore, verdictCopy } from "../docs/modules/verdict-copy.js";
import { sharedBarSegments } from "../docs/modules/verdict-bars.js";
import { formatNumber } from "../docs/modules/html.js";

const root = dirname(fileURLToPath(import.meta.url));

function tipNode(id) {
  const attrs = { id };
  return {
    id,
    hidden: true,
    tabIndex: -1,
    className: "",
    focused: false,
    classList: {
      toggle(name, on) {
        this[name] = on;
      },
    },
    style: {},
    setAttribute(name, value) {
      attrs[name] = value;
    },
    getAttribute(name) {
      return attrs[name];
    },
    focus() {
      this.focused = true;
    },
    contains() {
      return false;
    },
  };
}

test("the example trade is the calculator verdict, and a new price changes it", () => {
  const values = {
    "player:9509": 10000,
    "player:11632": 4000,
    "pick:2027:r1:early": 4000,
  };
  const priced = exampleTradeFromValues(values, { globalMaxValue: 10000 });
  const model = draftVerdictModel([10000], [4000, 4000], { globalMaxValue: 10000 });
  assert.deepEqual(EXAMPLE_GIVE, ["player:9509"]);
  assert.deepEqual(EXAMPLE_GET, ["player:11632", "pick:2027:r1:early"]);
  assert.equal(priced.giveSum, 10000);
  assert.equal(priced.getSum, 8000);
  assert.equal(priced.model.verdict.label, model.verdict.label);
  assert.equal(priced.model.compareGive, model.compareGive);
  assert.equal(priced.model.compareGet, model.compareGet);
  const html = launchExampleMarkup({
    values,
    names: {
      "player:9509": "Bijan Robinson",
      "player:11632": "Malik Nabers",
      "pick:2027:r1:early": "2027 Early 1st",
    },
    players: {
      "player:9509": { position: "RB", team: "ATL", age: 24 },
      "player:11632": { position: "WR", team: "NYG", age: 23 },
    },
    globalMaxValue: 10000,
  });
  const copy = verdictCopy(model.verdict);
  const bars = sharedBarSegments(model, null);
  assert.deepEqual(
    { even: TIER_BANDS.even, edge: TIER_BANDS.edge, favors: TIER_BANDS.favors },
    { even: 5, edge: 14, favors: 28 },
  );
  assert.match(copy.line, copy.tier === "even" ? / · within \d+%$/ : / · \S+ side worth \d+(\.\d+)?% more$/);
  const shown = html.match(/class="vt"><b>([^<]*)<\/b>/);
  assert.equal(shown?.[1], copy.line);
  assert.match(html, new RegExp(`launch-verdict ${copy.publicTone}`));
  const landing = readFileSync(join(root, "../docs/modules/launch-landing.js"), "utf8");
  assert.match(landing, /\$\{starsPremiumMarkup\(model\)\}/);
  assert.doesNotMatch(landing, /starsPremiumMarkup\(model,\s*\{[^}]*detail/);
  assert.doesNotMatch(html, /After that/);
  if (copy.detail) assert.equal(html.split(copy.detail).length - 1, 1);
  const bigger = bars.give.total === bars.get.total ? "" : (bars.give.total > bars.get.total ? "Give" : "Get");
  assert.equal(copy.side, bigger);
  if (bigger === "Give") assert.match(html, /calc-pointer-wide">◀[\s\S]*You give/);
  if (bigger === "Get") assert.match(html, /You get[\s\S]{0,240}calc-pointer-wide">▶/);
  assert.equal(percentMore(bars.give.total, bars.get.total), copy.more);
  if (copy.more != null && copy.tier !== "even") assert.match(copy.line, new RegExp(`${displayMore(copy.more)}% more`));
  assert.match(html, new RegExp(`>${formatNumber(bars.give.total)}<`));
  assert.match(html, new RegExp(`>${formatNumber(bars.get.total)}<`));
  const meters = html.match(/data-give="(\d+)" data-get="(\d+)"/);
  assert.equal(Number(meters?.[1]), bars.give.total);
  assert.equal(Number(meters?.[2]), bars.get.total);
  assert.match(html, new RegExp(`meter-give" style="flex:${bars.give.total} 1 0"`));
  assert.match(html, new RegExp(`meter-get" style="flex:${bars.get.total} 1 0"`));
  if (model.adjustment) {
    assert.match(html, /meter-stars/);
    assert.match(html, /Stars cost extra/);
    assert.match(html, new RegExp(formatNumber(model.adjustment.amount)));
  }
  assert.doesNotMatch(html, /var\(--red\)|var\(--green\)|\.up|\.dn/);
  assert.match(html, /10,000/);
  const moved = exampleTradeFromValues({ ...values, "player:9509": 8200 }, { globalMaxValue: 10000 });
  assert.equal(moved.giveSum, 8200);
  assert.notEqual(verdictCopy(moved.model.verdict).line, copy.line);
});

test("the example deep link round-trips and Back can restore the saved scroll", () => {
  assert.equal(exampleTradeHref(), "/trade?give=9509&get=11632,pick:2027:r1:early");
  const route = matchRoute("/trade", "?give=9509&get=11632,pick:2027:r1:early");
  assert.equal(route.name, "trade");
  assert.deepEqual(route.give, ["player:9509"]);
  assert.deepEqual(route.get, ["player:11632", "pick:2027:r1:early"]);
  const legacy = matchRoute("/trade", "?give=player:9509&get=player:11632,pick:2027:r1:early");
  assert.deepEqual(legacy.give, route.give);
  assert.deepEqual(legacy.get, route.get);
  const before = buildDeskHistorySnapshot({ tab: "players", view: "ranks", scrollY: 480 });
  assert.equal(scrollTopFromHistory(before), 480);
  assert.equal(scrollTopFromHistory({}), null);
  const app = readFileSync(join(root, "../docs/app.js"), "utf8");
  assert.match(app, /scrollTopFromHistory\(historyState\)/);
  assert.match(app, /prepareDeskPush\(\)/);
  assert.match(app, /restoreHistoryScroll\(historyState\)/);
  assert.match(app, /addEventListener\("popstate", \(event\) => \{[\s\S]*?applyDeskPopState\(event\.state\)/);
});

test("the info icon is 44px, one opens at a time, and Esc returns focus", () => {
  assert.equal(INFO_ICON_PX, 18);
  assert.equal(INFO_HIT_PX, 44);
  assert.equal(INFO_HIT_OUTSET, 13);
  const css = readFileSync(join(root, "../docs/product.css"), "utf8");
  assert.match(css, /\.info::before\s*\{[^}]*inset:\s*-13px/);
  assert.match(css, /\.info\s*\{[^}]*width:\s*18px/);
  const markup = infoTipMarkup({ id: "pop-values", label: "How values work", text: "Same number everywhere." });
  assert.match(markup, /<button[^>]*class="info"[^>]*aria-label="How values work"[^>]*aria-expanded="false"/);
  assert.match(markup, /role="dialog"/);
  const button = tipNode("info");
  const pop = tipNode("pop-values");
  const otherButton = tipNode("info-2");
  const otherPop = tipNode("pop-2");
  openInfoTip(button, pop);
  assert.equal(pop.hidden, false);
  assert.equal(button.getAttribute("aria-expanded"), "true");
  assert.equal(pop.focused, true);
  const controller = createInfoTipController();
  controller.toggle(button, pop);
  assert.equal(controller.openId, "pop-values");
  controller.toggle(otherButton, otherPop);
  assert.equal(button.getAttribute("aria-expanded"), "false");
  assert.equal(pop.hidden, true);
  assert.equal(controller.openId, "pop-2");
  assert.equal(otherPop.focused, true);
  otherButton.focused = false;
  controller.escape();
  assert.equal(controller.openId, "");
  assert.equal(otherPop.hidden, true);
  assert.equal(otherButton.focused, true);
  controller.toggle(button, pop);
  button.focused = false;
  controller.outside(pop);
  assert.equal(controller.openId, "pop-values");
  controller.outside({ contains() { return false; } });
  assert.equal(controller.openId, "");
  assert.equal(button.focused, true);
  closeInfoTip(button, pop);
  assert.equal(infoUsesSheet({ width: 390, height: 161 }), true);
  assert.equal(infoUsesSheet({ width: 390, height: 160 }), false);
  assert.equal(infoUsesSheet({ width: 1280, height: 400 }), false);
});

test("launch skeletons reserve the loaded row height", () => {
  assert.equal(LAUNCH_ROW_HEIGHT, 40);
  assert.equal(LAUNCH_TREND_MIN_HEIGHT, 200);
  assert.equal(LAUNCH_EXAMPLE_MIN_HEIGHT, 360);
  const rows = launchSkeletonRows(5);
  assert.equal((rows.match(/launch-row-skel/g) || []).length, 5);
  const css = readFileSync(join(root, "../docs/product.css"), "utf8");
  assert.match(css, /\.launch-example\s*\{[^}]*min-height:\s*360px/);
  assert.match(css, /\.launch-trend\s*\{[^}]*min-height:\s*200px/);
  assert.match(css, /\.launch-row\s*\{[^}]*min-height:\s*var\(--row-h-compact\)/);
  const landing = readFileSync(join(root, "../docs/ui/landing.html"), "utf8");
  assert.equal((landing.match(/launch-row-skel/g) || []).length, 8);
  assert.match(landing, /launch-verdict-skel/);
  const index = readFileSync(join(root, "../docs/index.html"), "utf8");
  assert.match(index, /launch-verdict-skel/);
  assert.ok(index.indexOf('id="landing-job-hint"') < index.indexOf('src="./boot.js"'));
});

test("a pre-league landing has one heading and two calls to action", () => {
  const index = readFileSync(join(root, "../docs/index.html"), "utf8");
  const css = readFileSync(join(root, "../docs/product.css"), "utf8");
  assert.match(index, /<body class="launch-open">/);
  assert.deepEqual(index.match(/<h1\b[^>]*>/g), [
    '<h1 id="mobile-chrome-title">',
    '<h1 id="landing-job-hint">',
  ]);
  assert.match(index, /<h1 id="landing-job-hint">Is your dynasty trade fair\?/);
  assert.match(index, /<p id="hero-title">/);
  assert.doesNotMatch(index, /<h1 id="hero-title"/);
  assert.match(index, /Check this trade/);
  assert.match(index, /class="ghost-btn launch-connect"/);
  assert.match(index, /See the sample league/);
  assert.equal((index.match(/class="ghost-btn launch-connect"/g) || []).length, 1);
  assert.equal((index.match(/class="launch-check"/g) || []).length, 1);
  assert.match(css, /body\.launch-open \.launch-header-link,/);
  assert.match(css, /body\.launch-open \.mobile-chrome-title-row,/);
  assert.match(css, /body\.launch-open #workspace-header,/);
  assert.match(css, /body\.launch-open #site-dock \{[^}]*display:\s*none !important/);
  assert.match(css, /body\.launch-open #sticky-find-btn,/);
  const phone = readFileSync(join(root, "../docs/styles.css"), "utf8");
  assert.match(phone, /body\.launch-open\s*\{[^}]*--mobile-chrome-space:\s*28px/);
});

test("a failed trending fetch is an error with Retry, not the empty week", () => {
  const failed = launchTrendMarkup([], { failed: true });
  assert.match(failed, /Hot list didn't load/);
  assert.match(failed, />Retry</);
  assert.doesNotMatch(failed, /Nothing's moving yet/);
  const empty = launchTrendMarkup([]);
  assert.match(empty, /Nothing's moving yet this week/);
  assert.doesNotMatch(empty, /Retry/);
  const app = readFileSync(join(root, "../docs/app.js"), "utf8");
  assert.match(app, /paintLaunchTrend\(trendFailed\)/);
});
