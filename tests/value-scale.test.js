import test from "node:test";
import assert from "node:assert/strict";
import {
  DISPLAY_SCALE,
  TEN_THOUSAND_NOTE,
  VALUE_TIERS,
  playerSeries,
  playerValueTrend,
  renderValueScaleExplainer,
  renderValueSparkline,
  renderValueTierBadge,
  renderTrendSoon,
  renderValueTrend,
  tierForValue,
  formatSince,
  topMovers,
  valuationStamp,
  valueChange,
  valueTrend,
  valuesUpdatedStatus,
} from "../docs/modules/value-scale.js";
import { fetchPriceHistory, fetchValuationBundles } from "../docs/modules/values.js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

test("tier bands follow the published cuts, including both edges", () => {
  assert.deepEqual(VALUE_TIERS.map((tier) => [tier.id, tier.label, tier.min, tier.blurb]), [
    ["elite", "Elite", 8000, "Top ~25 players"],
    ["starter", "Starter", 3000, "Weekly starter"],
    ["solid", "Solid", 1000, "Startable some weeks"],
    ["depth", "Depth", 250, "Bye-week or injury fill-in."],
    ["deep", "Deep stash", 1, "Roster filler"],
  ]);
  assert.equal(DISPLAY_SCALE, 20);
  assert.equal(tierForValue(14620).id, "elite");
  assert.equal(tierForValue(8000).id, "elite");
  assert.equal(tierForValue(7999).id, "starter");
  assert.equal(tierForValue(3000).id, "starter");
  assert.equal(tierForValue(2999).id, "solid");
  assert.equal(tierForValue(1000).id, "solid");
  assert.equal(tierForValue(999).id, "depth");
  assert.equal(tierForValue(250).id, "depth");
  assert.equal(tierForValue(249).id, "deep");
  assert.equal(tierForValue(1).id, "deep");
  assert.equal(tierForValue(0), null);
  assert.equal(tierForValue(-5), null);
  assert.equal(tierForValue(Number.NaN), null);
  assert.equal(renderValueTierBadge(0), "");
  assert.match(renderValueTierBadge(3000), /Value tier: Starter/);
  assert.match(renderValueTierBadge(8000), /class="value-tier"/);
  assert.doesNotMatch(renderValueTierBadge(8000), /value-tier-elite|amber|green/);
});

test("how values work names every band and does not call 10000 the ceiling", () => {
  const html = renderValueScaleExplainer();
  for (const tier of VALUE_TIERS) {
    assert.match(html, new RegExp(tier.label));
    assert.match(html, new RegExp(tier.blurb.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(html, /How values work/);
  assert.equal(TEN_THOUSAND_NOTE, "Values aren't capped at 10,000. Elite players start around 8,000; the very best are higher. Superflex leagues can start two QBs, so QBs are worth more there than in 1QB leagues.");
  assert.match(html, /Superflex leagues can start two QBs, so QBs are worth more there than in 1QB leagues/);
  assert.match(html, /Values aren&#39;t capped at 10,000/);
});

test("trend needs two points inside 30 days", () => {
  const now = new Date("2026-10-15T22:00:00Z");
  assert.equal(valueTrend(null, { now }), null);
  assert.equal(valueTrend([], { now }), null);
  assert.equal(valueTrend([{ date: "2026-10-14", value: 1000 }], { now }), null);
  const oneOld = valueTrend([
    { date: "2026-08-01", value: 1000 },
    { date: "2026-10-14", value: 1400 },
  ], { now });
  assert.equal(oneOld, null);
  const many = valueTrend([
    { date: "2026-09-20", value: 1000 },
    { date: "2026-10-01", value: 900 },
    { date: "2026-10-14", value: 1200 },
  ], { now });
  assert.equal(many.delta, 200);
  assert.equal(many.direction, "up");
  assert.equal(many.series.length, 3);
  assert.equal(many.first, 1000);
  assert.equal(many.last, 1200);
  const down = valueTrend([
    { date: "2026-10-01", value: 5000 },
    { date: "2026-10-14", value: 4500 },
  ], { now });
  assert.equal(down.direction, "down");
  assert.equal(down.delta, -500);
  const flat = valueTrend([
    { date: "2026-10-01", value: 250 },
    { date: "2026-10-14", value: 250 },
  ], { now });
  assert.equal(flat.direction, "flat");
  assert.equal(flat.delta, 0);
  const edge = valueTrend([
    { date: "2026-09-15", value: 10 },
    { date: "2026-10-15", value: 12 },
  ], { now });
  assert.equal(edge.delta, 2);
  const outside = valueTrend([
    { date: "2026-09-14", value: 10 },
    { date: "2026-10-15", value: 12 },
  ], { now });
  assert.equal(outside, null);
});

const TWO_DAYS = {
  schemaVersion: 1,
  snapshots: [
    {
      asOf: "2026-09-28T21:49:04+00:00",
      stamp: "202609282149",
      sf: { "player:1": 8000, "player:4984": 14839, "player:9": 0 },
      oneQb: { "player:1": 4000, "player:4984": 8452, "player:9": 0 },
    },
    {
      asOf: "2026-10-14T19:17:17+00:00",
      stamp: "202610141917",
      sf: { "player:1": 8200, "player:2": 1000, "player:4984": 14620, "player:9": 500 },
      oneQb: { "player:1": 3900, "player:4984": 8175, "player:9": 500 },
    },
  ],
};

test("two saved days draw the arrow and sparkline", () => {
  const now = new Date("2026-10-15T12:00:00Z");
  const trend = playerValueTrend(TWO_DAYS, "player:4984", "sf", now);
  assert.equal(trend.series.length, 2);
  assert.equal(trend.series[0].date, "2026-09-28");
  assert.equal(trend.series[1].date, "2026-10-14");
  assert.equal(trend.direction, "down");
  const html = renderValueTrend(trend, { spark: true, now });
  assert.match(html, /value-spark/);
  assert.match(html, /since Sep 28/);
  assert.doesNotMatch(html, /7d|30d|30 days/);
  assert.equal(trend.fromDate, "2026-09-28");
  assert.match(renderValueSparkline(trend.series), /polyline/);
  assert.equal(playerValueTrend(TWO_DAYS, "player:1", "sf", now).delta, 200);
  assert.equal(playerValueTrend(TWO_DAYS, "player:1", "oneQb", now).delta, -100);
  assert.equal(playerValueTrend(TWO_DAYS, "2", "sf", now), null);
  assert.equal(playerSeries(null, "player:1").length, 0);
  assert.deepEqual(playerSeries(TWO_DAYS, "player:missing", "oneQb"), []);
  assert.equal(playerSeries(TWO_DAYS, "2", "oneQb")[0].value, 1000);
});

test("valueChange uses the closest snapshot on or before each end", () => {
  const now = new Date("2026-10-15T22:00:00Z");
  assert.equal(valueChange("1", { days: 7, format: "sf" }), null);
  assert.equal(valueChange("missing", { days: 7, history: TWO_DAYS, now }), null);
  assert.equal(valueChange("2", { days: 7, history: TWO_DAYS, now }), null);
  const week = valueChange("player:1", { days: 7, format: "sf", history: TWO_DAYS, now });
  assert.deepEqual(week, {
    from: 8000,
    to: 8200,
    delta: 200,
    pct: 2.5,
    fromDate: "2026-09-28",
    toDate: "2026-10-14",
  });
  const oneQb = valueChange("1", { days: 7, format: "oneQb", history: TWO_DAYS, now });
  assert.equal(oneQb.from, 4000);
  assert.equal(oneQb.to, 3900);
  assert.equal(oneQb.delta, -100);
  assert.equal(oneQb.pct, -2.5);
  assert.equal(valueChange("1", { days: 30, format: "sf", history: TWO_DAYS, now }), null);
  const zeroBase = valueChange("9", { days: 7, history: TWO_DAYS, now });
  assert.equal(zeroBase.from, 0);
  assert.equal(zeroBase.to, 500);
  assert.equal(zeroBase.pct, null);
  assert.equal(valueChange("1", { days: 7, history: TWO_DAYS, now: new Date("2026-09-01T00:00:00Z") }), null);
  assert.equal(formatSince(week.fromDate, now), "since Sep 28");
  assert.equal(formatSince("2025-09-28", now), "since Sep 28, 2025");
  assert.equal(formatSince(""), "");
});

test("trend label uses valueChange fromDate and never a fixed 7d or 30d", () => {
  const now = new Date("2026-10-15T22:00:00Z");
  const change = valueChange("player:4984", { days: 7, format: "sf", history: TWO_DAYS, now });
  const trend = playerValueTrend(TWO_DAYS, "4984", "sf", now);
  assert.equal(trend.fromDate, change.fromDate);
  const html = renderValueTrend({ ...trend, fromDate: change.fromDate }, { spark: true, now });
  assert.match(html, /since Sep 28/);
  assert.match(html, /↓219/);
  assert.match(html, /down 219 since Sep 28/);
  assert.doesNotMatch(html, /-219|−219|\+219/);
  assert.match(html, /value-spark/);
  assert.doesNotMatch(html, /7d|30d|30 days/);
  const up = renderValueTrend({ delta: 1069, direction: "up", fromDate: "2026-09-28", series: [] }, { now });
  assert.match(up, /↑1,069|↑1069/);
  assert.doesNotMatch(up, /\+1,069|\+1069|-[0-9]/);
  assert.match(renderTrendSoon(), /No trend yet/);
  assert.doesNotMatch(renderTrendSoon(), /coming soon/);
  const ui = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../docs/modules/value-scale.js"), "utf8");
  assert.doesNotMatch(ui, /['"`][^'"`]*\b(?:7d|30d)\b/);
  assert.doesNotMatch(ui, /30 days/);
});

test("topMovers ranks percent change and skips cheap or missing rows", () => {
  const now = new Date("2026-10-15T22:00:00Z");
  const history = {
    schemaVersion: 1,
    snapshots: [
      {
        asOf: "2026-09-28T21:49:04+00:00",
        stamp: "202609282149",
        sf: { "player:a": 1000, "player:b": 4000, "player:c": 100 },
        oneQb: { "player:a": 1000, "player:b": 2000, "player:c": 100 },
      },
      {
        asOf: "2026-10-14T19:17:17+00:00",
        stamp: "202610141917",
        sf: { "player:a": 1500, "player:b": 4000, "player:c": 400, "player:d": 9000 },
        oneQb: { "player:a": 1500, "player:b": 1000, "player:c": 400, "player:d": 9000 },
      },
    ],
  };
  const movers = topMovers(2, { days: 7, format: "sf", minValue: 1000, history, now });
  assert.deepEqual(movers.map((row) => row.playerId), ["a"]);
  assert.equal(movers[0].pct, 50);
  const both = topMovers(5, { days: 7, format: "sf", minValue: 0, history, now });
  assert.deepEqual(both.map((row) => row.playerId), ["c", "a"]);
  const quarterbacks = topMovers(1, { days: 7, format: "oneQb", minValue: 1000, history, now });
  assert.equal(quarterbacks[0].playerId, "b");
  assert.equal(quarterbacks[0].pct, -50);
  assert.deepEqual(topMovers(3, { days: 30, history, now }), []);
  assert.deepEqual(topMovers(0, { days: 7, history, now }), []);
});

test("relative time uses the real stamp and marks anything older than 7 days", () => {
  const now = new Date("2026-10-15T19:17:17Z");
  const fresh = valuesUpdatedStatus("2026-10-14T19:17:17+00:00", now);
  assert.equal(fresh.label, "Values updated 1 day ago");
  assert.equal(fresh.stale, false);
  assert.equal(fresh.absolute, "2026-10-14 19:17 UTC");
  const hours = valuesUpdatedStatus("2026-10-15T16:00:00Z", now);
  assert.equal(hours.label, "Values updated 3 hours ago");
  assert.equal(hours.stale, false);
  const minutes = valuesUpdatedStatus("2026-10-15T19:00:00Z", now);
  assert.equal(minutes.label, "Values updated 17 minutes ago");
  const just = valuesUpdatedStatus("2026-10-15T19:17:00Z", now);
  assert.equal(just.label, "Values updated just now");
  const week = valuesUpdatedStatus("2026-10-08T19:17:17Z", now);
  assert.equal(week.label, "Values updated 7 days ago");
  assert.equal(week.stale, false);
  const stale = valuesUpdatedStatus("2026-10-08T19:17:16Z", now);
  assert.equal(stale.label, "Values from 7 days ago");
  assert.equal(stale.stale, true);
  const older = valuesUpdatedStatus("2026-10-01T19:17:17Z", now);
  assert.equal(older.label, "Values from 14 days ago");
  assert.doesNotMatch(older.label, /Stale/);
  assert.equal(valuesUpdatedStatus("", now), null);
  assert.equal(valuesUpdatedStatus("not-a-date", now), null);
});

test("stamp prefers generatedAt, then asOf, then Last-Modified", async () => {
  assert.equal(valuationStamp({ generatedAt: "2026-10-14T19:17:17Z", asOf: "2026-10-01T00:00:00Z" }), "2026-10-14T19:17:17Z");
  assert.equal(valuationStamp({ asOf: "2026-10-14T19:17:17+00:00", lastModified: "Wed, 01 Oct 2026 00:00:00 GMT" }), "2026-10-14T19:17:17+00:00");
  assert.equal(valuationStamp({ lastModified: "Wed, 01 Oct 2026 00:00:00 GMT" }), "Wed, 01 Oct 2026 00:00:00 GMT");
  const status = valuesUpdatedStatus(valuationStamp({ lastModified: "Wed, 01 Oct 2026 00:00:00 GMT" }), new Date("2026-10-15T00:00:00Z"));
  assert.equal(status.stale, true);
  assert.equal(status.absolute, "2026-10-01 00:00 UTC");

  const files = {
    "./data/player_values.json": {
      modelVersion: "football-forecast-v1",
      sf: { "player:1": 8000 },
      oneQb: { "player:1": 5000 },
      names: {},
      players: {},
      meta: {},
    },
  };
  const fetchImpl = async (path) => ({
    ok: path in files,
    json: async () => files[path],
    headers: { get: (name) => (name === "last-modified" ? "Wed, 14 Oct 2026 19:17:17 GMT" : "") },
  });
  const bundle = await fetchValuationBundles(fetchImpl);
  assert.equal(bundle.generatedAt, "");
  assert.equal(bundle.asOf, "");
  assert.equal(valuationStamp(bundle), "Wed, 14 Oct 2026 19:17:17 GMT");
});

test("fetchPriceHistory loads one archive and a later same-day snapshot wins", async () => {
  const early = {
    asOf: "2026-10-14T01:00:00+00:00",
    sf: { "player:4984": 14000 },
    oneQb: { "player:4984": 8000 },
  };
  const late = {
    asOf: "2026-10-14T19:17:17+00:00",
    sf: { "player:4984": 14620 },
    oneQb: { "player:4984": 8175 },
  };
  const prior = {
    asOf: "2026-09-28T21:49:04+00:00",
    sf: { "player:4984": 14839 },
    oneQb: { "player:4984": 8452 },
  };
  const files = {
    "./data/price-history/index.json": {
      schemaVersion: 1,
      retentionDays: 90,
      snapshots: [
        { stamp: "202601010000", asOf: "2026-01-01T12:00:00+00:00" },
        { stamp: "202609010000", asOf: "2026-09-01T12:00:00+00:00" },
        { stamp: "202609282149", asOf: prior.asOf },
        { stamp: "202610140100", asOf: early.asOf },
        { stamp: "202610141917", asOf: late.asOf },
      ],
    },
    "./data/price-history/202601010000.json": { asOf: "2026-01-01T12:00:00+00:00", sf: { "player:1": 1 }, oneQb: { "player:1": 1 } },
    "./data/price-history/202609010000.json": { asOf: "2026-09-01T12:00:00+00:00", sf: { "player:1": 1 }, oneQb: { "player:1": 1 } },
    "./data/price-history/202609282149.json": prior,
    "./data/price-history/202610140100.json": early,
    "./data/price-history/202610141917.json": late,
  };
  const calls = [];
  const now = new Date("2026-10-15T22:00:00Z");
  const fetchImpl = async (path) => {
    calls.push(path);
    return {
      ok: Object.prototype.hasOwnProperty.call(files, path),
      json: async () => files[path],
    };
  };
  const history = await fetchPriceHistory(fetchImpl, { now, days: 30 });
  assert.equal(history.snapshots.length, 4);
  assert.ok(calls.includes("./data/price-history/202609010000.json"));
  assert.equal(calls.includes("./data/price-history/202601010000.json"), false);
  const series = playerSeries(history, "4984", "sf");
  assert.deepEqual(series, [
    { date: "2026-09-28", value: 14839 },
    { date: "2026-10-14", value: 14620 },
  ]);
  const change = valueChange("4984", { days: 7, history, now });
  assert.equal(change.from, 14839);
  assert.equal(change.to, 14620);
  assert.equal(formatSince(change.fromDate, now), "since Sep 28");
  assert.equal(await fetchPriceHistory(async () => ({ ok: false, json: async () => null })), null);
  assert.equal(await fetchPriceHistory(async (path) => (
    path.endsWith("index.json")
      ? { ok: true, json: async () => ({ schemaVersion: 2, snapshots: [] }) }
      : { ok: false, json: async () => null }
  )), null);
});

function cssDeclaration(css, selector, prop) {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /([^{}]+)\{([^{}]+)\}/g;
  let found = null;
  for (const match of source.matchAll(re)) {
    const selectors = match[1].split(",").map((part) => part.trim().replace(/\s+/g, " "));
    if (!selectors.includes(selector)) continue;
    const decl = match[2].match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`));
    if (decl) found = decl[1].trim();
  }
  return found;
}

function cssVars(css) {
  const vars = {};
  for (const block of css.matchAll(/:root\s*\{([^}]+)\}/g)) {
    for (const decl of block[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
      vars[decl[1]] = decl[2].trim();
    }
  }
  return vars;
}

function resolveVars(value, vars, depth = 0) {
  if (!value || depth > 8) return value || "";
  return value.replace(/var\(\s*(--[a-z0-9-]+)\s*(?:,\s*([^)]+))?\)/gi, (_, name, fallback) => {
    const raw = vars[name] ?? (fallback || "");
    return resolveVars(String(raw).trim(), vars, depth + 1);
  });
}

function parseColor(input) {
  const value = String(input || "").trim();
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = [...h].map((ch) => ch + ch).join("");
    const n = Number.parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const rgb = value.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/i);
  if (rgb) {
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]), a: rgb[4] == null ? 1 : Number(rgb[4]) };
  }
  const mix = value.match(/^color-mix\(\s*in\s+srgb\s*,\s*(.+?)\s+([\d.]+)%\s*,\s*(.+)\)$/i);
  if (mix) {
    const left = parseColor(mix[1]);
    const right = parseColor(mix[3]);
    const p = Number(mix[2]) / 100;
    if (!left || !right) return null;
    return {
      r: left.r * p + right.r * (1 - p),
      g: left.g * p + right.g * (1 - p),
      b: left.b * p + right.b * (1 - p),
      a: left.a * p + right.a * (1 - p),
    };
  }
  if (value === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  return null;
}

function paintStops(value) {
  const colors = [];
  const re = /#(?:[0-9a-f]{3}|[0-9a-f]{6})\b|rgba?\([^)]+\)|color-mix\([^)]+\)|transparent/gi;
  for (const match of String(value).matchAll(re)) {
    const color = parseColor(match[0]);
    if (color) colors.push(color);
  }
  return colors;
}

function composite(fg, bg) {
  const a = fg.a;
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: 1,
  };
}

function contrastRatio(fg, bg) {
  const lum = (color) => {
    const ch = [color.r, color.g, color.b].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const a = lum(fg);
  const b = lum(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

test("selected ranks down trend clears 4.5 against the painted row", () => {
  const styles = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../docs/styles.css"), "utf8");
  const vars = cssVars(styles);
  const fg = parseColor(resolveVars(cssDeclaration(styles, ".value-trend.down", "color"), vars));
  const page = parseColor(resolveVars(vars["--bg"], vars));
  assert.ok(fg && page);
  const selectors = [
    "button.ranks-row.active",
    "button.ranks-row.active:hover",
  ];
  for (const selector of selectors) {
    const declared = resolveVars(cssDeclaration(styles, selector, "background"), vars);
    const stops = paintStops(declared);
    assert.ok(stops.length > 0, `${selector} has no background paint`);
    const samples = [];
    for (const stop of stops) {
      assert.equal(stop.a, 1, `${selector} fill must be opaque so its channels are the paint`);
      samples.push(composite(stop, page));
    }
    for (let i = 0; i < stops.length - 1; i += 1) {
      const left = stops[i];
      const right = stops[i + 1];
      samples.push(composite({
        r: (left.r + right.r) / 2,
        g: (left.g + right.g) / 2,
        b: (left.b + right.b) / 2,
        a: 1,
      }, page));
    }
    for (const sample of samples) {
      const ratio = contrastRatio(fg, sample);
      assert.ok(ratio >= 4.5, `${selector} down trend is ${ratio.toFixed(2)}:1`);
    }
  }
});
