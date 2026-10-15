import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { classifyRequest, createSiteServer } from "../scripts/serve_site.mjs";

const root = dirname(fileURLToPath(import.meta.url));

test("npm run serve and the e2e use the spa fallback server", () => {
  const pkg = JSON.parse(readFileSync(join(root, "../package.json"), "utf8"));
  assert.equal(pkg.scripts.serve, "node scripts/serve_site.mjs");
  assert.doesNotMatch(pkg.scripts.serve, /http\.server/);
  const playwright = readFileSync(join(root, "../playwright.config.js"), "utf8");
  assert.match(playwright, /command:\s*"npm run serve"/);
});

test("extensionless app routes fall back to index.html and dotted paths 404", () => {
  assert.equal(classifyRequest("/players").status, 200);
  assert.match(classifyRequest("/players").file, /index\.html$/);
  assert.equal(classifyRequest("/player/9221").status, 200);
  assert.equal(classifyRequest("/l/1360686137898700800/team").status, 200);
  assert.equal(classifyRequest("/trade").status, 200);
  assert.equal(classifyRequest("/").status, 200);

  const missingData = classifyRequest("/data/does-not-exist.json");
  assert.equal(missingData.status, 404);
  assert.match(missingData.file, /404\.html$/);
  assert.doesNotMatch(missingData.file, /index\.html$/);

  const missingJs = classifyRequest("/missing.js");
  assert.equal(missingJs.status, 404);
  assert.match(missingJs.file, /404\.html$/);

  assert.equal(classifyRequest("/nope").status, 404);
  assert.match(classifyRequest("/nope").file, /404\.html$/);
  assert.equal(classifyRequest("/l").status, 404);
  assert.equal(classifyRequest("/player").status, 404);
  const playerFile = classifyRequest("/player/missing.js");
  assert.equal(playerFile.status, 404);
  assert.match(playerFile.file, /404\.html$/);
  assert.doesNotMatch(playerFile.file, /index\.html$/);
  assert.equal(classifyRequest("/api/rather-vote").status, 404);

  const css = classifyRequest("/styles.css");
  assert.equal(css.status, 200);
  assert.match(css.file, /styles\.css$/);
  const data = classifyRequest("/data/player_values.json");
  assert.equal(data.status, 200);
  assert.match(data.file, /player_values\.json$/);
});

test("the spa server returns 404 for /data misses and extension paths", async () => {
  const server = createSiteServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const players = await fetch(`http://127.0.0.1:${port}/players`);
    assert.equal(players.status, 200);
    assert.match(players.headers.get("content-type") || "", /text\/html/);
    assert.match(await players.text(), /id="ui-pages"/);

    const player = await fetch(`http://127.0.0.1:${port}/player/9221`);
    assert.equal(player.status, 200);

    const missingData = await fetch(`http://127.0.0.1:${port}/data/does-not-exist.json`);
    assert.equal(missingData.status, 404);
    const missingBody = await missingData.text();
    assert.match(missingBody, /Page not found/);
    assert.doesNotMatch(missingBody, /id="ui-pages"/);

    const missingJs = await fetch(`http://127.0.0.1:${port}/not-a-real-file.js`);
    assert.equal(missingJs.status, 404);
    assert.match(await missingJs.text(), /Page not found/);

    const realCss = await fetch(`http://127.0.0.1:${port}/styles.css`);
    assert.equal(realCss.status, 200);
    assert.match(realCss.headers.get("content-type") || "", /text\/css/);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});
