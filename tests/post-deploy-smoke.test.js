import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSiteServer } from "../scripts/serve_site.mjs";
import { indexAssets, runSmoke, smokeChecks } from "../scripts/post_deploy_smoke.mjs";

async function listen() {
  const server = createSiteServer();
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

test("load check passes against the local site (routes, assets, OG png, real 404s)", { timeout: 60000 }, async () => {
  const { server, base } = await listen();
  try {
    // The local server has no /api functions, so the deployed-endpoint check is off here.
    const { ok, results } = await runSmoke({ base, api: false });
    const failed = results.filter((row) => !row.ok).map((row) => `${row.name}: ${row.detail}`);
    assert.deepEqual(failed, []);
    assert.equal(ok, true);
    const names = results.map((row) => row.name);
    for (const name of ["route /", "route /trade", "boot.js loads", "app.js loads", "styles.css loads", "OG card png", "real 404 /assets/smoke-missing.js"]) {
      assert.ok(names.includes(name), name);
    }
  } finally {
    server.close();
  }
});

test("load check fails loudly on an SPA-200 miss, a non-PNG card, or a down host", async () => {
  const fetchImpl = async (url) => {
    const path = new URL(url).pathname;
    if (path === "/og/t/1s9221~p27r1e.p28r1a.png") return new Response("<html>", { status: 200, headers: { "content-type": "image/png" } });
    if (path.endsWith(".js") && path.includes("smoke")) return new Response("<html>", { status: 200, headers: { "content-type": "text/html" } });
    if (path === "/app.js") throw new Error("ECONNRESET");
    return new Response("x".repeat(2000), { status: 200, headers: { "content-type": path.endsWith(".css") ? "text/css" : "text/html" } });
  };
  const { ok, results } = await runSmoke({ base: "https://example.test", fetchImpl, api: false });
  assert.equal(ok, false);
  const bad = Object.fromEntries(results.filter((row) => !row.ok).map((row) => [row.name, row.detail]));
  assert.match(bad["OG card png"], /not a PNG/);
  assert.match(bad["real 404 /assets/smoke-missing.js"], /status 200, want 404/);
  assert.match(bad["app.js loads"], /request failed/);
  await assert.rejects(runSmoke({}), /--base is required/);
});

test("load check is read-only and never deploys", () => {
  const src = readFileSync(new URL("../scripts/post_deploy_smoke.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(src, /method:\s*"(POST|PUT|DELETE|PATCH)"/);
  assert.doesNotMatch(src, /child_process|execSync|spawn\(/);
  assert.doesNotMatch(src.replace(/^\/\/.*$/gm, ""), /deploy_live_site|netlify deploy|NETLIFY_AUTH_TOKEN/);
  assert.ok(smokeChecks().some((row) => row.path === "/api/collect" && row.status === 405));
  assert.deepEqual(indexAssets('<link rel="stylesheet" href="./styles.css?v=2" /><script type="module" src="./boot.js"></script>').map((row) => row.path), ["./boot.js", "/app.js", "./styles.css?v=2"]);
});
