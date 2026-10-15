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

function fileFor(urlPath) {
  const clean = decodeURIComponent(String(urlPath || "/").split("?")[0]);
  if (clean.startsWith("/api/")) return null;
  const rel = clean === "/" || clean.startsWith("/player/") ? "/index.html" : clean;
  const full = normalize(join(root, rel));
  if (!full.startsWith(root)) return null;
  if (!existsSync(full) || !statSync(full).isFile()) return null;
  return full;
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
