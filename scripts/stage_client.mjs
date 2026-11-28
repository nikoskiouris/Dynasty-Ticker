// Keep editable browser modules in docs/. Publish the same entry points as bundles
// so opening a tool on a cold connection does not fetch the whole import graph.
import { cp, mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";
import { PAGE_FILES } from "../docs/modules/page-files.js";

const target = process.argv[2];
if (!target) throw new Error("Pass a new staging directory.");
const outdir = resolve(target);
await mkdir(outdir); // Never overwrite a source tree or an existing release.
await cp("docs", outdir, { recursive: true });
const options = { bundle: true, minify: true, format: "esm", target: "es2022", outdir };
// Keep the app import boundary so boot can display its existing retry UI.
await build({ ...options, entryPoints: ["docs/app.js"] });
const templates = await Promise.all(PAGE_FILES.map(file => readFile(resolve("docs", file), "utf8")));
await build({
  ...options,
  entryPoints: ["docs/boot.js"],
  external: ["./app.js"],
  define: { __BUNDLED_PAGE_SHELLS__: JSON.stringify(templates.join("\n")) },
});
