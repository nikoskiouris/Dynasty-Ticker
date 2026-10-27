#!/usr/bin/env node
// Post-deploy load check (launch item 5, A).
//
// "Load check" is not defined in the launch plan or PM docs. This is the
// interpretation: after a deploy, prove the site actually loads for a visitor,
// with read-only GETs only:
//   1. key app routes answer 200 text/html (/, /players, /trade, /connect, a
//      league room, a player page, a shared trade /t/<code>)
//   2. boot.js and styles.css as index.html references them, and app.js, load
//      (200, JavaScript / CSS content type, non-trivial size)
//   3. the shared-trade OG card /og/t/<code>.png is 200 image/png with PNG bytes
//   4. missing files get a real 404 (not the SPA shell)
//   5. the analytics beacon endpoint is deployed (GET /api/collect -> 405; no write)
//
// It never deploys, never runs scripts/deploy_live_site.sh, sends no POST, and
// needs no secrets. The base URL is required, so it never hits prod by accident:
//   node scripts/post_deploy_smoke.mjs --base https://<deploy>.netlify.app
//   node scripts/post_deploy_smoke.mjs --base https://dynastyticker.com --retries 6
// Exit 0 when every check passes, 1 otherwise.
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export const DEFAULT_CARD_CODE = "1s9221~p27r1e.p28r1a";
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function smokeChecks({ code = DEFAULT_CARD_CODE, api = true } = {}) {
  const html = (path) => ({ name: `route ${path}`, path, status: 200, type: /^text\/html/ });
  const miss = (path) => ({ name: `real 404 ${path}`, path, status: 404 });
  const checks = [
    html("/"),
    html("/players"),
    html("/trade"),
    html("/connect"),
    html("/l/1180000000000000/week"),
    html("/player/9509/bijan-robinson"),
    html(`/t/${code}`),
    { name: "OG card png", path: `/og/t/${code}.png`, status: 200, type: /^image\/png/, png: true },
    miss("/assets/smoke-missing.js"),
    miss("/smoke-missing.css"),
    miss("/smoke-missing.png"),
    miss("/l/1180000000000000/smoke-missing.js"),
  ];
  if (api) checks.push({ name: "analytics beacon endpoint deployed", path: "/api/collect", status: 405 });
  return checks;
}

// What index.html references (boot.js, styles.css, cache busters included),
// plus app.js, which boot.js imports. Loads exactly what a browser would.
export function indexAssets(html) {
  const boot = /<script[^>]+src="([^"]*\bboot\.js[^"]*)"/i.exec(html);
  const style = /<link[^>]+href="([^"]*\bstyles\.css[^"]*)"/i.exec(html);
  return [
    { name: "boot.js loads", path: boot ? boot[1] : "/boot.js", status: 200, type: /javascript/, minBytes: 200 },
    { name: "app.js loads", path: "/app.js", status: 200, type: /javascript/, minBytes: 1000 },
    { name: "styles.css loads", path: style ? style[1] : "/styles.css", status: 200, type: /^text\/css/, minBytes: 1000 },
  ];
}

async function runOne(base, check, fetchImpl) {
  const url = new URL(check.path, base);
  url.searchParams.set("smoke", String(Date.now()));
  const res = await fetchImpl(url, { redirect: "manual", headers: { "user-agent": "dynasty-ticker-post-deploy-smoke" } });
  const type = res.headers.get("content-type") || "";
  const bytes = new Uint8Array(await res.arrayBuffer());
  const problems = [];
  if (res.status !== check.status) problems.push(`status ${res.status}, want ${check.status}`);
  if (check.type && !check.type.test(type)) problems.push(`content-type "${type}"`);
  if (check.png && !PNG_MAGIC.every((b, i) => bytes[i] === b)) problems.push("body is not a PNG");
  if (check.minBytes && bytes.length < check.minBytes) problems.push(`only ${bytes.length} bytes`);
  return { ...check, url: url.href, ok: problems.length === 0, detail: problems.join("; ") || `${res.status} ${type}`, body: bytes };
}

export async function runSmoke({ base, code, api = true, fetchImpl = fetch, retries = 1, waitMs = 10000, log = () => {} } = {}) {
  if (!base) throw new Error("--base is required");
  const results = [];
  const checks = smokeChecks({ code, api });
  for (const check of checks) {
    let result;
    for (let attempt = 1; attempt <= Math.max(1, retries); attempt += 1) {
      try {
        result = await runOne(base, check, fetchImpl);
      } catch (error) {
        result = { ...check, ok: false, detail: `request failed: ${error.message}` };
      }
      if (result.ok || attempt === retries) break;
      log(`retry ${attempt}/${retries}: ${check.name} -> ${result.detail}`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
    results.push(result);
    if (check.path === "/" && result.ok) {
      checks.splice(checks.indexOf(check) + 1, 0, ...indexAssets(new TextDecoder().decode(result.body)));
    }
  }
  for (const row of results) delete row.body;
  return { ok: results.every((row) => row.ok), results };
}

function parseArgs(argv) {
  const out = { retries: 1, api: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--base") out.base = argv[++i];
    else if (arg === "--code") out.code = argv[++i];
    else if (arg === "--retries") out.retries = Number(argv[++i]) || 1;
    else if (arg === "--no-api") out.api = false;
    else if (arg === "--help" || arg === "-h") out.help = true;
  }
  return out;
}

const entry = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === entry) {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.base) {
    console.error("usage: node scripts/post_deploy_smoke.mjs --base <url> [--code <share code>] [--retries N] [--no-api]");
    process.exit(args.help ? 0 : 2);
  }
  const { ok, results } = await runSmoke({ ...args, log: (line) => console.error(line) });
  for (const row of results) console.log(`${row.ok ? "ok  " : "FAIL"} ${row.name}: ${row.detail}`);
  console.log(ok ? "post-deploy smoke: all checks passed" : "post-deploy smoke: FAILED");
  process.exit(ok ? 0 : 1);
}
