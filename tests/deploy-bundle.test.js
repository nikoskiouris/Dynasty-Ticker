import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BASE_FUNCTIONS, expectedBundle, readDeployConfig, staticDeployProblems } from "../scripts/deploy_bundle_expect.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("this checkout ships every expected function, edge function, and included file", () => {
  const { want, problems } = staticDeployProblems(root);
  assert.deepEqual(problems, []);
  assert.equal(want.functions.includes("rather-vote"), false);
  assert.ok(want.functions.includes("collect"));
  assert.ok(want.functions.includes("analytics-stats"));
  assert.ok(want.edge.includes("asset-404"));
  assert.ok(readDeployConfig(root).edgeDecls.some((row) => row.function === "asset-404"));
});

function fixture({ share = false, asset = false, toml = "" } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "deploy-expect-"));
  mkdirSync(join(dir, "docs/modules"), { recursive: true });
  mkdirSync(join(dir, "netlify/functions"), { recursive: true });
  mkdirSync(join(dir, "netlify/edge-functions"), { recursive: true });
  for (const name of BASE_FUNCTIONS) writeFileSync(join(dir, `netlify/functions/${name}.js`), "");
  if (share) writeFileSync(join(dir, "docs/modules/trade-share.js"), "");
  if (asset) writeFileSync(join(dir, "docs/modules/asset-path.js"), "");
  writeFileSync(join(dir, "netlify.toml"), toml);
  return dir;
}

test("the expected list follows whichever PR has landed", () => {
  const neither = fixture();
  assert.deepEqual(expectedBundle(neither), { functions: [...BASE_FUNCTIONS], edge: [], resvg: false });
  assert.deepEqual(staticDeployProblems(neither).problems, []);

  const only165 = fixture({ asset: true });
  assert.deepEqual(expectedBundle(only165).edge, ["asset-404"]);
  assert.match(staticDeployProblems(only165).problems.join("\n"), /asset-404 missing/);

  const only164 = fixture({ share: true });
  assert.deepEqual(expectedBundle(only164).functions, [...BASE_FUNCTIONS, "trade-page", "trade-card"]);
  const missing = staticDeployProblems(only164).problems.join("\n");
  assert.match(missing, /function trade-page missing/);
  assert.match(missing, /function trade-card missing/);
  // The PNG card cannot render without resvg: package, install, wasm, included_files.
  assert.equal(expectedBundle(only164).resvg, true);
  assert.match(missing, /@resvg\/resvg-wasm is not a dependency/);
  assert.match(missing, /@resvg\/resvg-wasm is not installed/);
  assert.match(missing, /node_modules\/@resvg\/resvg-wasm\/index_bg\.wasm missing/);
  assert.match(missing, /included_files lacks node_modules\/@resvg\/resvg-wasm\/index_bg\.wasm/);
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

test("the live bundle check requires resvg code and wasm in trade-card.zip", async () => {
  const { readFileSync } = await import("node:fs");
  const verify = readFileSync(join(root, "scripts/verify_deploy_bundle.mjs"), "utf8");
  assert.match(verify, /trade-card\.zip lacks \$\{RESVG_WASM\}/);
  assert.match(verify, /trade-card\.zip lacks @resvg\/resvg-wasm code/);
});

test("deploy script checks the live card is image/png after upload, read-only", async () => {
  const { readFileSync } = await import("node:fs");
  const script = readFileSync(join(root, "scripts/deploy_live_site.sh"), "utf8");
  const deployAt = script.indexOf("netlify-cli@${NETLIFY_CLI_VERSION}\" deploy");
  const checkAt = script.indexOf("post-deploy check");
  assert.ok(deployAt > 0 && checkAt > deployAt, "check runs after the deploy");
  assert.match(script, /card_url="\$\{check_origin\}\/og\/t\/\$\{check_code\}\.png/);
  assert.match(script, /"200 image\/png"\*/);
  assert.match(script, /post-deploy check FAILED[^\n]*\n\s*exit 1/);
  assert.doesNotMatch(script.slice(checkAt), /curl[^\n]*-X (POST|PUT|DELETE)/);
});
