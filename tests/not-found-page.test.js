import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createSiteServer } from "../scripts/serve_site.mjs";

const docs = join(dirname(fileURLToPath(import.meta.url)), "../docs");
const localRefs = (html) => [...html.matchAll(/\s(?:href|src)="([^"]+)"/g)]
  .map((m) => m[1])
  .filter((ref) => !/^(?:https?:|mailto:|#)/.test(ref));

test("404, privacy, and terms use root URLs, so nested paths resolve", () => {
  for (const page of ["404.html", "privacy.html", "terms.html"]) {
    const refs = localRefs(readFileSync(join(docs, page), "utf8"));
    assert.ok(refs.length > 0, page);
    for (const ref of refs) assert.match(ref, /^\/(?!\/)/, `${page} ${ref}`);
  }
});

test("404 served at a nested path loads its assets and links home to /", async () => {
  const server = createSiteServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    for (const nested of ["/garbage/x", "/a/b/c/d", "/l/x.json", "/player/9221.png"]) {
      const res = await fetch(`${base}${nested}`);
      assert.equal(res.status, 404, nested);
      const html = await res.text();
      assert.match(html, /Page not found/, nested);
      const back = html.match(/<a class="legal-btn" href="([^"]+)">Back to Dynasty Ticker<\/a>/);
      assert.equal(back?.[1], "/", nested);
      for (const ref of localRefs(html)) {
        const url = new URL(ref, `${base}${nested}`);
        const asset = await fetch(url);
        assert.equal(asset.status, 200, `${nested} -> ${url.pathname}`);
        await asset.arrayBuffer();
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
