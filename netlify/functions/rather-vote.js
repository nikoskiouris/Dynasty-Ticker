import { getStore } from "@netlify/blobs";
import { createRatherVoteHandler } from "../lib/rather-crowd.js";

// RATHER_SALT must be a Netlify env var, 16+ random characters. A missing or
// previously published salt refuses the write.
const ratherVoteHandler = createRatherVoteHandler({
  getStore: () => getStore("desk-rather"),
});

export default ratherVoteHandler;
