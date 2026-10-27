import { isAssetLikePath } from "../../docs/modules/asset-path.js";
import { SECURITY_HEADERS } from "../lib/security-headers.js";

// Runs on /player/* and /l/* only (netlify.toml). A real page passes through
// to the rewrites. A file-like path gets the 404 page with a real 404 status.
export async function asset404(request, next, fetchImpl = fetch) {
  const url = new URL(request.url);
  if (!isAssetLikePath(url.pathname)) return next();
  let body = "Not found";
  let type = "text/plain; charset=utf-8";
  try {
    const page = await fetchImpl(new URL("/404.html", url));
    if (page.ok) {
      body = await page.text();
      type = "text/html; charset=utf-8";
    }
  } catch {
    // plain text fallback
  }
  return new Response(body, {
    status: 404,
    headers: { ...SECURITY_HEADERS, "content-type": type, "cache-control": "public, max-age=0, must-revalidate" },
  });
}

export default (request, context) => asset404(request, () => context.next());
