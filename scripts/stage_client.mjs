// Keep editable browser modules in docs/. Publish the same entry points as bundles
// so opening a tool on a cold connection does not fetch the whole import graph.
import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const target = process.argv[2];
if (!target) throw new Error("Pass a new staging directory.");
const outdir = resolve(target);
await mkdir(outdir); // Never overwrite a source tree or an existing release.
await cp("docs", outdir, { recursive: true });
const options = { bundle: true, minify: true, format: "esm", target: "es2022", outdir };
// Keep the app import boundary so boot can display its existing retry UI.
await build({ ...options, entryPoints: ["docs/app.js"] });
await build({ ...options, entryPoints: ["docs/boot.js"], external: ["./app.js"] });
