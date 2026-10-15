import { createReadStream, existsSync, statSync } from "node:fs";
import http from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { isSpaPath } from "../docs/modules/history-route.js";
import { createSharePageHandler } from "../netlify/lib/trade-share.js";
import { createTradeCardHandler } from "../netlify/lib/trade-card.js";

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

// A real file wins. SPA_REWRITES (the same placeholder rules as netlify.toml,
// including the trailing-slash forms) fall back to index.html. A segment
// like x.js matches too. /api stays a 404. Everything else, including a
// /data miss, returns 404.html.
export function classifyRequest(pathname) {
  const clean = decodePath(pathname);
  if (clean == null) return { status: 400, file: null };
  if (clean.startsWith("/api/") || clean.startsWith("/.netlify/")) return { status: 404, file: fileAt("/404.html") };
  // Same as netlify.toml: shared trades and their cards go to the functions.
  if (/^\/t\/[^/]+\/?$/.test(clean)) return { status: 200, file: fileAt("/index.html"), fn: "trade-page" };
  if (/^\/og\/t\/[^/]+$/.test(clean)) return { status: 200, file: null, fn: "trade-card" };
  const staticFile = clean === "/" ? null : fileAt(clean);
  if (staticFile) return { status: 200, file: staticFile };
  if (clean === "/" || isSpaPath(clean)) return { status: 200, file: fileAt("/index.html") };
  return { status: 404, file: fileAt("/404.html") };
}

async function sendResponse(res, response) {
  const headers = Object.fromEntries(response.headers.entries());
  res.writeHead(response.status, headers);
  res.end(Buffer.from(await response.arrayBuffer()));
}

export function createSiteServer(deps = {}) {
  const origin = deps.origin || `http://127.0.0.1:${port}`;
  const fns = {
    "trade-page": createSharePageHandler({ origin, ...deps }),
    "trade-card": createTradeCardHandler({ origin, ...deps }),
  };
  return http.createServer((req, res) => {
    let classified;
    try {
      classified = classifyRequest(new URL(req.url || "/", "http://127.0.0.1").pathname);
    } catch {
      classified = { status: 400, file: null };
    }
    if (classified.fn) {
      fns[classified.fn](new Request(new URL(req.url || "/", origin)))
        .then((response) => sendResponse(res, response))
        .catch(() => {
          res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
          res.end("Function error");
        });
      return;
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
