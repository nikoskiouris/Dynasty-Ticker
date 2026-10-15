import { createReadStream, existsSync, statSync } from "node:fs";
import http from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { isSpaPath } from "../docs/modules/history-route.js";

const root = join(process.cwd(), "docs");
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

function fileAt(rel) {
  const full = normalize(join(root, rel));
  const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;
  if (full !== root && !full.startsWith(rootPrefix)) return null;
  if (!existsSync(full) || !statSync(full).isFile()) return null;
  return full;
}

function decodePath(pathname) {
  try {
    return decodeURIComponent(String(pathname || "/").split("?")[0]);
  } catch {
    return null;
  }
}

// A real file wins. Extensionless app routes fall back to index.html.
// /data misses, dotted paths, and anything else return 404.html.
export function classifyRequest(pathname) {
  const clean = decodePath(pathname);
  if (clean == null) return { status: 400, file: null };
  if (clean.startsWith("/api/") || clean.startsWith("/.netlify/")) return { status: 404, file: fileAt("/404.html") };
  const staticFile = clean === "/" ? null : fileAt(clean);
  if (staticFile) return { status: 200, file: staticFile };
  if (clean === "/" || isSpaPath(clean)) return { status: 200, file: fileAt("/index.html") };
  return { status: 404, file: fileAt("/404.html") };
}

export function createSiteServer() {
  return http.createServer((req, res) => {
    let classified;
    try {
      classified = classifyRequest(new URL(req.url || "/", "http://127.0.0.1").pathname);
    } catch {
      classified = { status: 400, file: null };
    }
    if (!classified.file) {
      res.writeHead(classified.status || 404, { "content-type": "text/plain; charset=utf-8" });
      res.end(classified.status === 400 ? "Bad request" : "Not found");
      return;
    }
    res.writeHead(classified.status, { "content-type": types[extname(classified.file)] || "application/octet-stream" });
    createReadStream(classified.file).pipe(res);
  });
}

const entry = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === entry) {
  const server = createSiteServer();
  server.listen(port, "127.0.0.1", () => {
    console.log(`desk http://127.0.0.1:${port}`);
  });
}
