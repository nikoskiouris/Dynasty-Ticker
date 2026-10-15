import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expectedBundle, readDeployConfig, staticDeployProblems } from "../scripts/deploy_bundle_expect.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("this checkout ships every expected function, edge function, and included file", () => {
  const { want, problems } = staticDeployProblems(root);
  assert.deepEqual(problems, []);
  assert.ok(want.functions.includes("rather-vote"));
  assert.ok(want.edge.includes("asset-404"));
  assert.ok(readDeployConfig(root).edgeDecls.some((row) => row.function === "asset-404"));
});

function fixture({ share = false, asset = false, toml = "" } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "deploy-expect-"));
  mkdirSync(join(dir, "docs/modules"), { recursive: true });
  mkdirSync(join(dir, "netlify/functions"), { recursive: true });
  mkdirSync(join(dir, "netlify/edge-functions"), { recursive: true });
  for (const name of ["rather-vote", "searched-user"]) writeFileSync(join(dir, `netlify/functions/${name}.js`), "");
  if (share) writeFileSync(join(dir, "docs/modules/trade-share.js"), "");
  if (asset) writeFileSync(join(dir, "docs/modules/asset-path.js"), "");
  writeFileSync(join(dir, "netlify.toml"), toml);
  return dir;
}

test("the expected list follows whichever PR has landed", () => {
  const neither = fixture();
  assert.deepEqual(expectedBundle(neither), { functions: ["rather-vote", "searched-user"], edge: [] });
  assert.deepEqual(staticDeployProblems(neither).problems, []);

  const only165 = fixture({ asset: true });
  assert.deepEqual(expectedBundle(only165).edge, ["asset-404"]);
  assert.match(staticDeployProblems(only165).problems.join("\n"), /asset-404 missing/);

  const only164 = fixture({ share: true });
  assert.deepEqual(expectedBundle(only164).functions, ["rather-vote", "searched-user", "trade-page", "trade-card"]);
  const missing = staticDeployProblems(only164).problems.join("\n");
  assert.match(missing, /function trade-page missing/);
  assert.match(missing, /function trade-card missing/);
  for (const dir of [neither, only165, only164]) rmSync(dir, { recursive: true, force: true });
});

test("undeclared edge functions and empty included_files globs fail", () => {
  const dir = fixture({ asset: true, toml: '[functions]\n  included_files = ["docs/data/price-history/*.json"]\n' });
  writeFileSync(join(dir, "netlify/edge-functions/asset-404.js"), "");
  const problems = staticDeployProblems(dir).problems.join("\n");
  assert.match(problems, /asset-404 has no \[\[edge_functions\]\]/);
  assert.match(problems, /included_files docs\/data\/price-history\/\*\.json matches nothing/);
  rmSync(dir, { recursive: true, force: true });
});
