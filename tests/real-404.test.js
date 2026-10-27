// Launch item 5 (B): a missing file gets a real 404, never the SPA shell with
// a 200. App routes still fall back to index.html. This checks the Netlify
// config itself (netlify.toml + docs/_redirects), and the local server that
// mirrors it. scripts/post_deploy_smoke.mjs checks the same thing live.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classifyRequest } from "../scripts/serve_site.mjs";
import { isAssetLikePath } from "../docs/modules/asset-path.js";
import { readDeployConfig } from "../scripts/deploy_bundle_expect.mjs";

const root = new URL("../", import.meta.url);
const toml = readFileSync(new URL("netlify.toml", root), "utf8");

function redirects() {
  return [...toml.matchAll(/\[\[redirects\]\]([\s\S]*?)(?=\n\[\[|\n\[[a-z]|$)/g)].map((m) => {
    const field = (name) => (new RegExp(`\\n\\s*${name}\\s*=\\s*"?([^"\\n]+)"?`).exec(m[1]) || [])[1];
    return { from: field("from"), to: field("to"), status: Number(field("status")), force: field("force") === "true" };
  });
}

const ASSET_MISSES = Object.freeze([
  "/assets/app.js", "/assets/x.css", "/nope.png", "/app.min.js", "/styles2.css", "/og/missing.png",
  "/modules/missing.js", "/data/missing.json", "/brand/missing.svg", "/fonts/x.woff2",
  "/players/x.js", "/trade/x.css", "/connect/a.png", "/l/1180000000000000/x.js", "/l/x.json",
  "/player/9509/a.png", "/player/9509.webp",
]);
const APP_ROUTES = Object.freeze([
  "/", "/players", "/trade", "/connect", "/l/1180000000000000", "/l/1180000000000000/week",
  "/l/1180000000000000/activity", "/l/1180000000000000/history", "/player/9509/bijan-robinson", "/trade/",
]);

test("netlify.toml: SPA rewrites are exact app routes; the catch-all is a 404", () => {
  const rows = redirects();
  const edgePrefixes = readDeployConfig(new URL(".", root).pathname).edgeDecls
    .filter((row) => row.function === "asset-404")
    .map((row) => row.path.replace(/\*$/, ""));
  const spa = rows.filter((row) => row.to === "/index.html");
  assert.ok(spa.length > 0);
  for (const row of spa) {
    assert.equal(row.status, 200, row.from);
    assert.equal(row.force, false, `${row.from} must not shadow real files`);
    assert.doesNotMatch(row.from, /\*/, `${row.from}: a splat SPA rewrite would 200 every missing file`);
    // A :placeholder can match "x.js", so it must sit under the asset-404 edge function.
    if (row.from.includes(":")) assert.ok(edgePrefixes.some((p) => row.from.startsWith(p)), `${row.from} has no asset-404 edge cover`);
  }
  const last = rows.at(-1);
  assert.deepEqual(last, { from: "/*", to: "/404.html", status: 404, force: false });
  assert.equal(rows.filter((row) => row.from === "/*").length, 1);
  assert.doesNotMatch(readFileSync(new URL("docs/_redirects", root), "utf8"), /index\.html/);
});

test("asset-like paths under placeholder prefixes are caught by the edge rule", () => {
  for (const path of ASSET_MISSES.filter((p) => p.startsWith("/l/") || p.startsWith("/player/"))) {
    assert.equal(isAssetLikePath(path), true, path);
  }
  for (const path of APP_ROUTES.filter((p) => p.startsWith("/l/") || p.startsWith("/player/"))) {
    assert.equal(isAssetLikePath(path), false, path);
  }
});

test("local server: missing files 404, app routes fall back, real files load", () => {
  for (const path of ASSET_MISSES) assert.equal(classifyRequest(path).status, 404, path);
  for (const path of APP_ROUTES) {
    const hit = classifyRequest(path);
    assert.equal(hit.status, 200, path);
    assert.match(String(hit.file), /index\.html$/, path);
  }
  for (const path of ["/app.js", "/styles.css", "/404.html"]) {
    assert.match(String(classifyRequest(path).file), new RegExp(`${path.replace(/\./g, "\\.")}$`), path);
  }
});
