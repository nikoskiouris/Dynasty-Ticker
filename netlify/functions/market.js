import { getStore } from "@netlify/blobs";
import { MARKET_STORE, createMarketHandler } from "../lib/market-data.js";

export default createMarketHandler({ getStore: () => getStore(MARKET_STORE) });
