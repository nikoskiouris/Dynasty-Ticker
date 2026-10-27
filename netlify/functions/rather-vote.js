// RATHER_SALT must be set on the Netlify site (Functions / Runtime).
// The old public default dynasty-ticker-rather-v1 is rejected.
// scripts/ensure_netlify_salts.py fills a random secret at deploy time if needed.
import { getStore } from "@netlify/blobs";
import { createRatherVoteHandler } from "../lib/rather-crowd.js";

const ratherVoteHandler = createRatherVoteHandler({
  getStore: () => getStore("desk-rather"),
});

export default ratherVoteHandler;
