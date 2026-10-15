import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { asset404 } from "../netlify/edge-functions/asset-404.js";

const root = dirname(fileURLToPath(import.meta.url));

test("edge function 404s file-like app paths and passes pages through", async () => {
  const notFound = new Response("<title>Page not found</title>", { status: 200 });
  const fetchImpl = async (url) => {
    assert.equal(new URL(url).pathname, "/404.html");
    return notFound.clone();
  };
  const passed = new Response("app", { status: 200 });
  for (const path of ["/l/x.json", "/player/9221.png", "/player/9221/jahmyr-gibbs.webp", "/l/42/team.js"]) {
    const res = await asset404(new Request(`https://dynastyticker.com${path}`), () => passed, fetchImpl);
    assert.equal(res.status, 404, path);
    assert.match(await res.text(), /Page not found/, path);
  }
  for (const path of ["/player/9221", "/player/9221/jahmyr-gibbs", "/l/1360686137898700800/team"]) {
    const res = await asset404(new Request(`https://dynastyticker.com${path}`), () => passed, fetchImpl);
    assert.equal(res, passed, path);
  }
  const offline = await asset404(new Request("https://dynastyticker.com/l/x.json"), () => passed, async () => { throw new Error("down"); });
  assert.equal(offline.status, 404);
});

test("netlify.toml runs asset-404 on the placeholder route prefixes", () => {
  const toml = readFileSync(join(root, "../netlify.toml"), "utf8");
  assert.match(toml, /\[\[edge_functions\]\]\s*\n\s*path = "\/player\/\*"\s*\n\s*function = "asset-404"/);
  assert.match(toml, /\[\[edge_functions\]\]\s*\n\s*path = "\/l\/\*"\s*\n\s*function = "asset-404"/);
});
