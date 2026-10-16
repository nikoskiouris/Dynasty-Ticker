import { getStore } from "@netlify/blobs";
import { SHARE_NAMES_STORE } from "../lib/trade-share.js";
import { createTradeCardHandler } from "../lib/trade-card.js";

let store = null;
try {
  store = getStore(SHARE_NAMES_STORE);
} catch {
  store = null;
}

export default createTradeCardHandler({ store });
