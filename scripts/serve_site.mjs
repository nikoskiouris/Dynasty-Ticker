import { createReadStream, existsSync, statSync } from "node:fs";
import http from "node:http";
import { extname, join, normalize } from "node:path";
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

function fileFor(requestPath) {
  const clean = decodeURIComponent(String(requestPath || "/").split("?")[0]);
  if (clean === "/api" || clean.startsWith("/api/")) return null;
  if (clean !== "/") {
    const staticFile = fileAt(clean);
    if (staticFile) return staticFile;
  }
  return fileAt("/index.html");
}

const server = http.createServer((req, res) => {
  const file = fileFor(new URL(req.url || "/", "http://127.0.0.1").pathname);
  if (!file) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" });
  createReadStream(file).pipe(res);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`desk http://127.0.0.1:${port}`);
});
