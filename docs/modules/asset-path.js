// A :placeholder rewrite also matches "x.json" or "9221.png". Those are file
// requests, not pages, so they 404. Player slugs and ids never contain a dot,
// so no real page is caught. No imports: the asset-404 edge function uses this.
const ASSET_TAIL = /\.[A-Za-z0-9]{1,8}$/;
export const ASSET_404_PREFIXES = Object.freeze(["/l/", "/player/"]);

export function isAssetLikePath(pathname) {
  const raw = String(pathname || "").split("?")[0];
  if (!ASSET_404_PREFIXES.some((prefix) => raw.startsWith(prefix))) return false;
  const last = raw.replace(/\/+$/, "").split("/").pop() || "";
  return ASSET_TAIL.test(last);
}
