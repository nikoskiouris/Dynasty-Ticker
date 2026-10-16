// Runs the same bundlers netlify-cli 27.12.1 uses for `deploy --no-build`
// (@netlify/zip-it-and-ship-it for functions with included_files,
// @netlify/edge-bundler for edge functions) into a temp dir, uploads nothing,
// and fails if an expected function, edge function, or included file is absent.
// deploy_live_site.sh installs the pinned bundlers into a temp prefix and runs
// this from there, so the repo does not carry them as dependencies.
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { resolveConfig } from "@netlify/config";
import { zipFunctions } from "@netlify/zip-it-and-ship-it";
import { bundle } from "@netlify/edge-bundler";

const root = process.argv[2];
if (!root) throw new Error("usage: verify_deploy_bundle.mjs <repo root>");
const { expectedBundle, readDeployConfig, RESVG_WASM } = await import(join(root, "scripts/deploy_bundle_expect.mjs"));
const want = expectedBundle(root);
const { includedFiles } = readDeployConfig(root);
const { config } = await resolveConfig({ cwd: root, repositoryRoot: root, offline: true, mode: "cli", context: "production" });

// Same translation as netlify-cli dist/lib/functions/config.js normalizeFunctionsConfig.
const functionsConfig = Object.fromEntries(Object.entries(config.functions || {}).map(([pattern, value]) => [pattern, {
  includedFiles: value.included_files,
  includedFilesBasePath: root,
  nodeBundler: value.node_bundler === "esbuild" ? "esbuild_zisi" : value.node_bundler,
  processDynamicNodeImports: true,
}]));
const problems = [];
const out = mkdtempSync(join(tmpdir(), "dt-functions-"));
const zips = await zipFunctions([join(root, "netlify/functions")], out, { basePath: root, repositoryRoot: root, config: functionsConfig });
const built = new Map(zips.map((zip) => [zip.name, zip.path]));
for (const name of want.functions) if (!built.has(name)) problems.push(`function ${name} not bundled`);

// Every included_files glob must land in each zip that has a function config of "*".
const globs = includedFiles.map((glob) => new RegExp(`^${glob.split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*")}$`));
for (const [name, path] of built) {
  const listing = execFileSync("unzip", ["-Z1", path], { encoding: "utf8" }).split("\n");
  globs.forEach((re, i) => {
    if (!listing.some((file) => re.test(file))) problems.push(`${name}.zip lacks included_files ${includedFiles[i]}`);
  });
}

// The card function must carry resvg: its JS in the bundle and the wasm file.
if (want.resvg) {
  const path = built.get("trade-card");
  if (!path) {
    problems.push("trade-card not bundled, so resvg cannot be checked");
  } else {
    const listing = execFileSync("unzip", ["-Z1", path], { encoding: "utf8" }).split("\n");
    if (!listing.includes(RESVG_WASM)) problems.push(`trade-card.zip lacks ${RESVG_WASM}`);
    const code = listing.filter((file) => /\.(m?js|cjs)$/.test(file))
      .map((file) => execFileSync("unzip", ["-p", path, file], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }))
      .join("\n");
    if (!/initWasm/.test(code) || !/Resvg/.test(code)) problems.push("trade-card.zip lacks @resvg/resvg-wasm code");
  }
}

const edgeDir = config.build?.edge_functions;
let edgeNames = [];
if (edgeDir) {
  const edgeOut = mkdtempSync(join(tmpdir(), "dt-edge-"));
  const result = await bundle([edgeDir], edgeOut, config.edge_functions || [], { basePath: root });
  edgeNames = result.functions.map((fn) => fn.name);
  const manifest = JSON.parse(readFileSync(join(edgeOut, "manifest.json"), "utf8"));
  for (const name of want.edge) {
    if (!edgeNames.includes(name)) problems.push(`edge function ${name} not bundled`);
    if (!manifest.routes.some((route) => route.function === name)) problems.push(`edge function ${name} has no route`);
  }
} else if (want.edge.length) {
  problems.push("no edge functions directory resolved");
}

if (problems.length) {
  for (const line of problems) console.error(`bundle check: ${line}`);
  process.exit(1);
}
console.log(`bundle check ok: functions ${[...built.keys()].join(", ")}; edge ${edgeNames.join(", ") || "none"}`);
