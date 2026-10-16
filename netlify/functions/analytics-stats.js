// Token-gated read of the first-party analytics counters
// (GET /api/analytics-stats?days=14, Authorization: Bearer <ANALYTICS_READ_TOKEN>).
// Without ANALYTICS_READ_TOKEN (24+ chars) set on the site, this answers 404.
import { getStore } from "@netlify/blobs";
import { COLLECT_STORE, createStatsHandler } from "../lib/site-analytics.js";

export default createStatsHandler({ getStore: () => getStore(COLLECT_STORE) });
