// What a live deploy must ship, and a static check that the repo can ship it.
// Used by scripts/deploy_live_site.sh (before anything touches Netlify) and
// tests/deploy-bundle.test.js. scripts/verify_deploy_bundle.mjs runs the real
// Netlify bundlers against the same list.
//
// Order tolerance: each optional entry is required only once the PR that adds
// it has landed, detected by a file that PR adds. #164 (shared trades) adds
// docs/modules/trade-share.js; #165 (launch fixes) adds docs/modules/asset-path.js.
// Either can merge first. Once both are on develop the list is fully strict.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

export const BASE_FUNCTIONS = Object.freeze(["rather-vote", "searched-user", "collect", "analytics-stats"]);
export const OPTIONAL = Object.freeze([
  { pr: "#164", marker: "docs/modules/trade-share.js", functions: ["trade-page", "trade-card"], edge: [], resvg: true },
  { pr: "#165", marker: "docs/modules/asset-path.js", functions: [], edge: ["asset-404"] },
]);

// The PNG card needs resvg's JS (bundled into trade-card) and its wasm
// (shipped via included_files). Without either, /og/t/<code>.png cannot render.
export const RESVG_PACKAGE = "@resvg/resvg-wasm";
export const RESVG_WASM = "node_modules/@resvg/resvg-wasm/index_bg.wasm";

export function expectedBundle(root) {
  const functions = [...BASE_FUNCTIONS];
  const edge = [];
  let resvg = false;
  for (const row of OPTIONAL) {
    if (!existsSync(join(root, row.marker))) continue;
    functions.push(...row.functions);
    edge.push(...row.edge);
    resvg = resvg || Boolean(row.resvg);
  }
  return { functions, edge, resvg };
}

// Small reader for the few netlify.toml keys this needs. No toml dependency.
export function readDeployConfig(root) {
  const toml = readFileSync(join(root, "netlify.toml"), "utf8");
  const included = /included_files\s*=\s*\[([^\]]*)\]/.exec(toml);
  const includedFiles = included ? [...included[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
  const edgeDecls = [...toml.matchAll(/\[\[edge_functions\]\]\s*\n\s*path\s*=\s*"([^"]+)"\s*\n\s*function\s*=\s*"([^"]+)"/g)]
    .map((m) => ({ path: m[1], function: m[2] }));
  return { includedFiles, edgeDecls };
}

function globToRegExp(glob) {
  const body = glob.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*");
  return new RegExp(`^${body}$`);
}

function listFiles(dir, root, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) listFiles(full, root, out);
    else out.push(relative(root, full));
  }
  return out;
}

function entryExists(dir, name) {
  return [".js", ".mjs", ".ts", ".mts", ".cjs"].some((ext) => existsSync(join(dir, `${name}${ext}`)));
}

export function staticDeployProblems(root) {
  const problems = [];
  const want = expectedBundle(root);
  const { includedFiles, edgeDecls } = readDeployConfig(root);
  for (const name of want.functions) {
    if (!entryExists(join(root, "netlify/functions"), name)) problems.push(`function ${name} missing from netlify/functions`);
  }
  for (const name of want.edge) {
    if (!entryExists(join(root, "netlify/edge-functions"), name)) problems.push(`edge function ${name} missing from netlify/edge-functions`);
    if (!edgeDecls.some((row) => row.function === name)) problems.push(`edge function ${name} has no [[edge_functions]] in netlify.toml`);
  }
  for (const row of edgeDecls) {
    if (!entryExists(join(root, "netlify/edge-functions"), row.function)) problems.push(`[[edge_functions]] ${row.path} names missing ${row.function}`);
  }
  if (want.resvg) {
    const pkgPath = join(root, "package.json");
    const pkg = existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, "utf8")) : {};
    if (!pkg.dependencies?.[RESVG_PACKAGE]) problems.push(`${RESVG_PACKAGE} is not a dependency in package.json`);
    if (!existsSync(join(root, "node_modules", RESVG_PACKAGE, "package.json"))) problems.push(`${RESVG_PACKAGE} is not installed (run npm ci)`);
    if (!existsSync(join(root, RESVG_WASM))) problems.push(`${RESVG_WASM} missing`);
    if (!includedFiles.includes(RESVG_WASM)) problems.push(`included_files lacks ${RESVG_WASM}`);
  }
  const files = [...listFiles(join(root, "docs"), root), ...listFiles(join(root, "netlify"), root), ...listFiles(join(root, "node_modules/@resvg"), root)];
  for (const glob of includedFiles) {
    const re = globToRegExp(glob);
    if (!files.some((file) => re.test(file))) problems.push(`included_files ${glob} matches nothing`);
  }
  return { want, includedFiles, problems };
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entry) {
  const root = process.argv[2] || process.cwd();
  const { want, problems } = staticDeployProblems(root);
  if (problems.length) {
    for (const line of problems) console.error(`deploy check: ${line}`);
    process.exit(1);
  }
  console.log(`deploy check ok: functions ${want.functions.join(", ")}; edge ${want.edge.join(", ") || "none"}`);
}
