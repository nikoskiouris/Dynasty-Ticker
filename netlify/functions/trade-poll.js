// Crowd call on a shared trade (GET/POST /api/trade-poll). Opinion only:
// votes never touch player prices. VISIT_SALT (Functions runtime) salts the
// voter and address hashes; unset, the poll answers 503 "off".
import { getStore } from "@netlify/blobs";
import { POLL_STORE, createTradePollHandler } from "../lib/trade-poll.js";

export default createTradePollHandler({ getStore: () => getStore(POLL_STORE) });
