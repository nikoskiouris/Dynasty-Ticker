import { createReadStream, existsSync, statSync } from "node:fs";
import http from "node:http";
import { extname, join, normalize } from "node:path";
import { pathToFileURL } from "node:url";

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
  ".woff2": "font/woff2",
};

function fileAt(rel) {
  const full = normalize(join(root, rel));
  if (!full.startsWith(root)) return null;
  if (!existsSync(full) || !statSync(full).isFile()) return null;
  return full;
}

function cleanPath(requestPath) {
  return decodeURIComponent(String(requestPath || "/").split("?")[0]);
}

function lastSegmentHasExtension(pathname) {
  const last = String(pathname || "/").split("/").pop() || "";
  return last.includes(".");
}

// Existing files are served. /api, /data misses, and any missing path with a
// file extension are 404. Only extensionless app routes fall back to index.html.
export function classifySitePath(requestPath) {
  const clean = cleanPath(requestPath);
  if (clean === "/api" || clean.startsWith("/api/")) return { status: 404, file: null };
  if (clean !== "/") {
    const staticFile = fileAt(clean);
    if (staticFile) return { status: 200, file: staticFile };
  }
  if (lastSegmentHasExtension(clean) || clean === "/data" || clean.startsWith("/data/")) {
    return { status: 404, file: null };
  }
  const index = fileAt("/index.html");
  return index ? { status: 200, file: index } : { status: 404, file: null };
}

export function createSiteServer() {
  return http.createServer((req, res) => {
    let pathname = "/";
    try {
      pathname = new URL(req.url || "/", "http://127.0.0.1").pathname;
    } catch {
      pathname = "/";
    }
    const hit = classifySitePath(pathname);
    if (!hit.file) {
      res.writeHead(hit.status || 404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(hit.status, { "content-type": types[extname(hit.file)] || "application/octet-stream" });
    createReadStream(hit.file).pipe(res);
  });
}

const launchedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (launchedDirectly) {
  const server = createSiteServer();
  server.listen(port, "127.0.0.1", () => {
    console.log(`desk http://127.0.0.1:${port}`);
  });
}
