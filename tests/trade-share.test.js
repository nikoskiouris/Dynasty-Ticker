import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
  assert.deepEqual(decodeTradeShare(code), { ...trade, stamp: "" });
  assert.deepEqual(decodeTradeShare(encodeTradeShare({ ...trade, format: "sf" })), { ...trade, format: "sf", stamp: "" });
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
  // A broken link opens the calculator with the broken-link notice, not home.
  assert.equal(matchRoute("/t/garbage").badShare, true);
  assert.equal(matchRoute("/t/garbage").name, "trade");
  assert.equal(resolveLocation("/t/garbage").unknown, false);
  assert.equal(resolveLocation("/t/garbage").badShare, true);
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
  assert.equal(bad.status, 404);
  assert.equal(bad.headers.get("x-robots-tag"), "noindex");
  const badHtml = await bad.text();
  assert.match(badHtml, /og-image\.jpg/);
  assert.match(badHtml, /<meta name="robots" content="noindex" \/>/);
});

// The PNG path needs @resvg/resvg-wasm (a dependency; CI's `npm install` in
// .github/workflows/test.yml installs it). Without node_modules, skip locally
// with a clear message, but never in CI.
const resvgMissing = !existsSync(join(root, "../node_modules/@resvg/resvg-wasm/index_bg.wasm"));
const resvgSkip = resvgMissing && !process.env.CI
  ? "@resvg/resvg-wasm is not installed; run `npm ci` to render card PNGs (CI always runs this)"
  : false;

test("card function renders an immutable PNG, an SVG, and 404s bad codes", { skip: resvgSkip }, async () => {
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

// ---- Dated links: the price snapshot archive ----
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { isPriceStamp, missingBoardNote, priceStamp, sameVerdict, snapshotPath, snapshotRequestForStamp, stampLabel } from "../docs/modules/trade-share.js";
import { loadSnapshot, summaryForCode } from "../netlify/lib/trade-share.js";

const STAMP = priceStamp(values.asOf);
// The same board a week earlier, with Gibbs priced far higher.
const older = { asOf: "2026-10-07T11:17:00+00:00", sf: { ...values.sf, "player:9221": values.sf["player:9221"] * 2 }, oneQb: values.oneQb };
const snapshots = { [STAMP]: { asOf: values.asOf, sf: values.sf, oneQb: values.oneQb }, "202610071117": older };
const dated = { ...deps, loadSnapshot: async (stamp) => snapshots[stamp] || null };

test("price stamps come from asOf in UTC and gate every lookup", () => {
  assert.equal(priceStamp("2026-10-14T19:17:17+00:00"), "202610141917");
  assert.equal(priceStamp("2026-10-14T15:17:17-04:00"), "202610141917");
  assert.equal(priceStamp("nope"), "");
  assert.equal(stampLabel("202610141917"), "Oct 14");
  assert.equal(stampLabel("202610141917", { year: true }), "Oct 14, 2026");
  assert.equal(missingBoardNote("Jan 1"), "That day's prices are no longer saved. Showing today's.");
  assert.equal(missingBoardNote(""), "");
  const index = { schemaVersion: 1, snapshots: [{ stamp: "202610141917" }] };
  assert.equal(snapshotRequestForStamp(index, "202501011200"), "");
  assert.equal(snapshotRequestForStamp(index, "202610141917"), "/data/price-history/202610141917.json");
  assert.equal(snapshotRequestForStamp(null, "202610141917"), "/data/price-history/202610141917.json");
  for (const bad of ["20261014191", "202613141917", "202610321917", "202610142417", "../../../x", ""]) {
    assert.equal(isPriceStamp(bad), false, bad);
    assert.equal(snapshotPath(bad), "");
  }
  assert.equal(snapshotPath("202610141917"), "/data/price-history/202610141917.json");
  const app = readFileSync(join(root, "../docs/app.js"), "utf8");
  const fn = app.slice(app.indexOf("async function loadSharedTrade"), app.indexOf("function activeSharedTrade"));
  assert.ok(fn.includes("PRICE_HISTORY_INDEX_PATH"));
  assert.ok(fn.indexOf("PRICE_HISTORY_INDEX_PATH") < fn.indexOf("snapshotRequestForStamp"));
  assert.match(fn, /if \(!path\)/);
  assert.doesNotMatch(fn, /fetch\(snapshotPath/);
});

test("a dated code round trips and an undated code stays v1", () => {
  const code = encodeTradeShare({ give: ["player:4984"], get: ["player:9221"], format: "sf", asOf: values.asOf });
  assert.equal(code, `2s${STAMP}4984~9221`);
  assert.deepEqual(decodeTradeShare(code), { format: "sf", give: ["player:4984"], get: ["player:9221"], stamp: STAMP });
  assert.equal(decodeTradeShare("1s4984~9221").stamp, "");
  assert.equal(decodeTradeShare("2s4984~9221"), null);
  assert.equal(decodeTradeShare("2s2026101419994984~9221"), null);
});

test("the archive has the live board's snapshot, and the writer is immutable and pruned", () => {
  const live = JSON.parse(readFileSync(join(root, `../docs/data/price-history/${STAMP}.json`), "utf8"));
  assert.deepEqual(live.sf, values.sf);
  assert.deepEqual(live.oneQb, values.oneQb);
  assert.equal(live.players, undefined);
  const workflow = readFileSync(join(root, "../.github/workflows/refresh-player-values.yml"), "utf8");
  assert.match(workflow, /python3 scripts\/archive_price_snapshot\.py/);
  assert.match(workflow, /git add [^\n]*docs\/data\/price-history/);

  const dir = mkdtempSync(join(tmpdir(), "prices-"));
  const run = (asOf, sf) => {
    writeFileSync(join(dir, "v.json"), JSON.stringify({ asOf, sf, oneQb: {} }));
    execFileSync("python3", ["-c", `import sys; sys.path.insert(0, "scripts"); import archive_price_snapshot as a; from pathlib import Path; a.archive(Path("${dir}/v.json"), Path("${dir}/h"), keep=2)`], { cwd: join(root, "..") });
  };
  run("2026-10-01T00:00:00+00:00", { a: 1 });
  run("2026-10-01T00:00:00+00:00", { a: 2 });
  assert.deepEqual(JSON.parse(readFileSync(join(dir, "h/202610010000.json"), "utf8")).sf, { a: 1 });
  run("2026-10-08T00:00:00+00:00", { a: 3 });
  run("2026-10-15T00:00:00+00:00", { a: 4 });
  assert.deepEqual(readdirSync(join(dir, "h")).sort(), ["202610080000.json", "202610150000.json"]);
});

test("snapshot lookup: hit, missing, tampered", async () => {
  assert.ok((await loadSnapshot(STAMP)).sf);
  assert.equal(await loadSnapshot("202001010000", { origin: "http://127.0.0.1:9" }), null);
  assert.equal(await loadSnapshot("../player_values"), null);
});

test("shared verdict comes from the snapshot; match vs differ; unknown dates fall back", async () => {
  const same = await summaryForCode(`2s${STAMP}4984~9221`, dated);
  assert.ok(same.shared);
  assert.equal(same.same, true);
  assert.equal(same.version, STAMP);

  const differ = await summaryForCode("2s2026100711174984~9221", dated);
  assert.equal(differ.same, false);
  assert.equal(differ.summary, differ.shared);
  assert.equal(differ.shared.getTotal, values.sf["player:9221"] * 2);
  assert.equal(differ.today.getTotal, values.sf["player:9221"]);
  assert.equal(sameVerdict(differ.shared, differ.today), false);

  // A real-looking date with no snapshot, or an undated v1 code: today's board.
  for (const code of ["2s2025010112004984~9221", "1s4984~9221"]) {
    const hit = await summaryForCode(code, dated);
    assert.equal(hit.shared, null, code);
    assert.equal(hit.summary, hit.today, code);
  }
});

test("meta and card say as of the snapshot date", async () => {
  const page = await createSharePageHandler({ ...dated, origin: "https://dynastyticker.com" })(
    new Request("https://dynastyticker.com/t/2s2026100711174984~9221"),
  );
  const html = await page.text();
  assert.match(html, /og:description" content="[^"]*as of Oct 7, 2026/);
  assert.match(html, /og\/t\/2s2026100711174984~9221\.png\?v=202610071117/);
  const svg = await createTradeCardHandler(dated)(new Request("https://dynastyticker.com/og/t/2s2026100711174984~9221.svg"));
  const text = await svg.text();
  assert.match(text, /as of Oct 7, 2026/);
  assert.match(text, new RegExp((values.sf["player:9221"] * 2).toLocaleString("en-US")));
});
