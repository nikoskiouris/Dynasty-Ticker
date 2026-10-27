// First-party analytics beacon (POST /api/collect). Cookieless.
// ANALYTICS_SALT (optional, Functions runtime) turns on daily uniques. Unset
// means counts only. Never commit a value. See netlify/lib/site-analytics.js.
import { getStore } from "@netlify/blobs";
import { COLLECT_STORE, createCollectHandler } from "../lib/site-analytics.js";

export default createCollectHandler({ getStore: () => getStore(COLLECT_STORE) });
