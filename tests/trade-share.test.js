import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SHARE_MAX_LENGTH,
  SHARE_MAX_SIDE,
  decodeTradeShare,
  encodeShareAsset,
  encodeTradeShare,
  shareImagePath,
  sharePath,
  shareSummary,
} from "../docs/modules/trade-share.js";
import { isSpaPath, matchRoute, resolveLocation } from "../docs/modules/history-route.js";
import {
  CARD_CACHE,
  codeFromPath,
  compactSleeperNames,
  createSharePageHandler,
  escapeMarkup,
  injectShareMeta,
  loadPlayerNames,
} from "../netlify/lib/trade-share.js";
import { createTradeCardHandler, renderCardSvg } from "../netlify/lib/trade-card.js";
import { classifyRequest } from "../scripts/serve_site.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const values = JSON.parse(readFileSync(join(root, "../docs/data/player_values.json"), "utf8"));
const indexHtml = readFileSync(join(root, "../docs/index.html"), "utf8");
// Real Sleeper ids: 4984 Josh Allen, 9221 Jahmyr Gibbs, 9509 Bijan Robinson.
const NAMES = { 4984: "Josh Allen", 9221: "Jahmyr Gibbs", 9509: "Bijan Robinson" };
const deps = { loadValues: async () => values, loadPlayerNames: async () => NAMES, readIndex: async () => indexHtml };

test("encode and decode round trip players, picks, and format", () => {
  const trade = { give: ["player:4984", "pick:2027:r1:early"], get: ["player:9221", "pick:2028:r2:any"], format: "oneQb" };
  const code = encodeTradeShare(trade);
  assert.equal(code, "1q4984.p27r1e~9221.p28r2a");
  assert.match(code, /^[0-9a-z.~]+$/);
  assert.deepEqual(decodeTradeShare(code), trade);
  assert.deepEqual(decodeTradeShare(encodeTradeShare({ ...trade, format: "sf" })), { ...trade, format: "sf" });
  for (const bucket of ["any", "early", "mid", "late"]) {
    assert.equal(decodeTradeShare(encodeTradeShare({ give: [`pick:2029:r3:${bucket}`], get: ["player:9509"] })).give[0], `pick:2029:r3:${bucket}`);
  }
});

test("a league pick shares as the generic pick, so no roster id leaves the league", () => {
  assert.equal(encodeShareAsset("pick:2027:r1:7"), "p27r1a");
  const code = encodeTradeShare({ give: ["pick:2027:r1:7"], get: ["player:9221"] });
  assert.doesNotMatch(code, /7~/);
  assert.equal(decodeTradeShare(code).give[0], "pick:2027:r1:any");
});

test("codes refuse empty sides, unknown ids, and oversize trades", () => {
  assert.equal(encodeTradeShare({ give: [], get: ["player:9221"] }), "");
  assert.equal(encodeTradeShare({ give: ["player:abc"], get: ["player:9221"] }), "");
  assert.equal(encodeTradeShare({ give: ["player:0"], get: ["player:9221"] }), "");
  const many = Array.from({ length: SHARE_MAX_SIDE + 1 }, (_, i) => `player:${1000 + i}`);
  assert.equal(encodeTradeShare({ give: many, get: ["player:9221"] }), "");
  const full = Array.from({ length: SHARE_MAX_SIDE }, (_, i) => `player:${100000000000 + i}`);
  const longest = encodeTradeShare({ give: full, get: full });
  assert.ok(longest.length <= SHARE_MAX_LENGTH, String(longest.length));
  assert.ok(decodeTradeShare(longest));
  for (const bad of [
    "", "1s", "1s4984", "1s~9221", "1s4984~", "2s4984~9221", "1x4984~9221", "1s4984~9221~1",
    "1s4984..9221~1", "1s0~9221", "1sp27r9e~9221", "1sp27r1z~9221", "1S4984~9221",
    "1s<script>~9221", "1s4984~9221%22", `1s${"1".repeat(SHARE_MAX_LENGTH)}~9221`, null, undefined, 42,
  ]) {
    assert.equal(decodeTradeShare(bad), null, String(bad));
  }
});

test("share paths and the route table", () => {
  const code = "1s4984~9221";
  assert.equal(sharePath(code), "/t/1s4984~9221");
  assert.equal(shareImagePath(code, "20261014"), "/og/t/1s4984~9221.png?v=20261014");
  const hit = matchRoute("/t/1s4984~9221");
  assert.equal(hit.name, "trade");
  assert.equal(hit.page, "trades");
  assert.equal(hit.room, "calculator");
  assert.deepEqual(hit.give, ["player:4984"]);
  assert.deepEqual(hit.get, ["player:9221"]);
  assert.equal(hit.format, "sf");
  assert.equal(hit.leagueId, "");
  assert.equal(matchRoute("/t/garbage"), null);
  assert.equal(resolveLocation("/t/garbage").unknown, true);
  assert.equal(isSpaPath("/t/1s4984~9221"), true);
  assert.equal(isSpaPath("/t/1s4984~9221/"), true);
  assert.equal(isSpaPath("/t"), false);
});

test("summary uses the calculator's prices and verdict", () => {
  const summary = shareSummary(decodeTradeShare("1s4984.p27r1e~9221"), values, NAMES);
  assert.equal(summary.give[0].name, "Josh Allen");
  assert.equal(summary.give[0].value, values.sf["player:4984"]);
  assert.equal(summary.give[1].name, "2027 Early 1st");
  assert.equal(summary.giveTotal, values.sf["player:4984"] + values.sf["pick:2027:r1:early"]);
  assert.equal(summary.formatLabel, "Superflex");
  assert.ok(summary.pct > 0);
  assert.equal(shareSummary(decodeTradeShare("1s123456789~9221"), values, {}).give[0].name, "Player 123456789");
});

test("meta escaping covers text and attributes", () => {
  assert.equal(escapeMarkup(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  const summary = shareSummary(decodeTradeShare("1s4984~9221"), values, { 4984: `"><script>alert(1)</script>`, 9221: "O'Neil & Co" });
  const html = injectShareMeta(indexHtml, { summary, code: "1s4984~9221", origin: "https://dynastyticker.com", version: "2026" });
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /O&#39;Neil &amp; Co/);
  assert.equal((html.match(/property="og:title"/g) || []).length, 1);
  assert.equal((html.match(/name="twitter:card" content="summary_large_image"/g) || []).length, 1);
  assert.match(html, /<meta property="og:image" content="https:\/\/dynastyticker\.com\/og\/t\/1s4984~9221\.png\?v=2026" \/>/);
  assert.match(html, /<meta property="og:url" content="https:\/\/dynastyticker\.com\/t\/1s4984~9221" \/>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/dynastyticker\.com\/t\/1s4984~9221" \/>/);
  // The app's scripts and CSP stay as they were.
  assert.match(html, /script-src 'self'/);
  assert.match(html, /<script src="\.\/desk-shut\.js"><\/script>/);
  const svg = renderCardSvg(summary);
  assert.doesNotMatch(svg, /<script/);
  assert.match(svg, /O&#39;Neil &amp; Co/);
});

test("page function serves index.html with the trade's meta and no PII", async () => {
  const handler = createSharePageHandler({ ...deps, origin: "https://dynastyticker.com" });
  const res = await handler(new Request("https://dynastyticker.com/.netlify/functions/trade-page?code=1s4984~9221"));
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/html/);
  assert.match(res.headers.get("cache-control"), /s-maxage/);
  assert.match(res.headers.get("content-security-policy"), /script-src 'self'/);
  const html = await res.text();
  assert.match(html, /og:title" content="[^"]*Josh Allen for Jahmyr Gibbs/);
  assert.match(html, /twitter:card" content="summary_large_image"/);
  assert.match(html, /id="app"|<body/);

  const direct = await handler(new Request("https://dynastyticker.com/t/1q4984~9221"));
  assert.match(await direct.text(), /1QB/);

  const bad = await handler(new Request("https://dynastyticker.com/t/nope"));
  assert.equal(bad.status, 200);
  assert.match(bad.headers.get("cache-control"), /max-age=0/);
  assert.match(await bad.text(), /og-image\.jpg/);
});

test("card function renders an immutable PNG, an SVG, and 404s bad codes", async () => {
  const handler = createTradeCardHandler(deps);
  const png = await handler(new Request("https://dynastyticker.com/.netlify/functions/trade-card?file=1s4984.p27r1e~9221.png"));
  assert.equal(png.status, 200);
  assert.equal(png.headers.get("content-type"), "image/png");
  assert.equal(png.headers.get("cache-control"), CARD_CACHE);
  const bytes = Buffer.from(await png.arrayBuffer());
  assert.deepEqual([...bytes.subarray(1, 4)], [0x50, 0x4e, 0x47]);
  assert.equal(bytes.readUInt32BE(16), 1200);
  assert.equal(bytes.readUInt32BE(20), 630);

  const svg = await handler(new Request("https://dynastyticker.com/og/t/1s4984~9221.svg"));
  assert.equal(svg.headers.get("content-type"), "image/svg+xml");
  assert.match(await svg.text(), /Jahmyr Gibbs/);

  const fallback = await createTradeCardHandler({ ...deps, renderPng: async () => { throw new Error("no wasm"); } })(
    new Request("https://dynastyticker.com/og/t/1s4984~9221.png"),
  );
  assert.equal(fallback.headers.get("content-type"), "image/svg+xml");
  assert.doesNotMatch(fallback.headers.get("cache-control"), /immutable/);

  for (const bad of ["/og/t/nope.png", "/og/t/1s4984~9221.gif", "/og/t/1s4984~9221"]) {
    assert.equal((await handler(new Request(`https://dynastyticker.com${bad}`))).status, 404, bad);
  }
});

test("player names come from one cached Sleeper fetch shared through blobs", async () => {
  assert.deepEqual(compactSleeperNames({ 4984: { full_name: "Josh Allen", team: "BUF" }, DEF: { first_name: "x" }, 9221: { first_name: "Jahmyr", last_name: "Gibbs" } }), { 4984: "Josh Allen", 9221: "Jahmyr Gibbs" });
  const saved = new Map();
  const store = {
    get: async (key) => saved.get(key) ?? null,
    setJSON: async (key, value) => saved.set(key, value),
  };
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response(JSON.stringify({ 4984: { full_name: "Josh Allen" } }));
  };
  const now = Date.now() + 10 * 24 * 60 * 60 * 1000;
  assert.deepEqual(await loadPlayerNames({ store, fetchImpl, now }), { 4984: "Josh Allen" });
  assert.equal(calls, 1);
  assert.ok(saved.size === 1);
});

test("local serve and netlify.toml send shared trades to the functions", () => {
  assert.equal(classifyRequest("/t/1s4984~9221").fn, "trade-page");
  assert.equal(classifyRequest("/t/1s4984~9221/").fn, "trade-page");
  assert.equal(classifyRequest("/og/t/1s4984~9221.png").fn, "trade-card");
  assert.equal(classifyRequest("/t").status, 404);
  assert.equal(codeFromPath("/t/1s4984~9221/"), "1s4984~9221");
  assert.equal(codeFromPath("/og/t/1s4984~9221.png", { suffix: ".png" }), "1s4984~9221");

  const toml = readFileSync(join(root, "../netlify.toml"), "utf8");
  const order = (needle) => toml.indexOf(needle);
  assert.ok(order('from = "/api/searched-user"') < order('from = "/t/:code"'));
  assert.ok(order('from = "/t/:code"') < order('from = "/*"'));
  assert.match(toml, /from = "\/t\/:code"\s*\n\s*to = "\/\.netlify\/functions\/trade-page\?code=:code"\s*\n\s*status = 200/);
  assert.match(toml, /from = "\/og\/t\/:file"\s*\n\s*to = "\/\.netlify\/functions\/trade-card\?file=:file"\s*\n\s*status = 200/);
  assert.match(toml, /included_files = \[[^\]]*resvg-wasm\/index_bg\.wasm/);
});
