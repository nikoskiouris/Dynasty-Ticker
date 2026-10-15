import { getStore } from "@netlify/blobs";
import { SHARE_NAMES_STORE, createSharePageHandler } from "../lib/trade-share.js";

let store = null;
try {
  store = getStore(SHARE_NAMES_STORE);
} catch {
  store = null;
}

export default createSharePageHandler({ store });
