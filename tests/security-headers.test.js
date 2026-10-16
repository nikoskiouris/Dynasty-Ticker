import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SECURITY_HEADERS } from "../netlify/lib/security-headers.js";
import { asset404 } from "../netlify/edge-functions/asset-404.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function tomlHeadersFor(toml, path) {
  const blocks = toml.split("[[headers]]").slice(1);
  const block = blocks.find((text) => new RegExp(`^\\s*for = "${path.replace(/[*]/g, "\\*")}"`).test(text));
  assert.ok(block, `no [[headers]] for ${path}`);
  const values = block.split("[headers.values]")[1].split(/\n\s*\n|\n\[/)[0];
  return Object.fromEntries([...values.matchAll(/^\s*([A-Za-z-]+)\s*=\s*"([^"]*)"/gm)].map((m) => [m[1], m[2]]));
}

test("the shared security headers match netlify.toml /* exactly", () => {
  const toml = readFileSync(join(root, "netlify.toml"), "utf8");
  assert.deepEqual(tomlHeadersFor(toml, "/*"), { ...SECURITY_HEADERS });
  assert.match(SECURITY_HEADERS["Content-Security-Policy"], /frame-ancestors 'none'/);
});

test("the asset-404 edge response carries every security header", async () => {
  const res = await asset404(new Request("https://dynastyticker.com/l/x.json"), () => new Response("app"), async () => new Response("<p>Page not found</p>"));
  assert.equal(res.status, 404);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    assert.equal(res.headers.get(name), value, name);
  }
});
