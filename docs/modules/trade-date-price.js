import { priceRowForTrade } from "./trade-grade.js";
import { priceStamp, snapshotPath } from "./trade-share.js";
import { PRICE_HISTORY_INDEX_PATH, snapshotPrices } from "./values.js";

const INDEX_TTL_MS = 5 * 60 * 1000;
let indexRequest = null;
let indexExpires = 0;
const boards = new Map();

async function readIndex() {
  const response = await fetch(PRICE_HISTORY_INDEX_PATH, { cache: "no-cache" });
  if (!response.ok) throw new Error("Trade-date price index could not load.");
  const index = await response.json();
  if (index?.schemaVersion !== 1 || !Array.isArray(index.snapshots) || !index.snapshots.every(
    row => row?.stamp && row.stamp === priceStamp(row.asOf),
  )) throw new Error("Trade-date price index is unreadable.");
  return index.snapshots;
}

function getIndex() {
  if (!indexRequest || Date.now() >= indexExpires) {
    indexExpires = Date.now() + INDEX_TTL_MS;
    const request = readIndex().catch(error => {
      if (indexRequest === request) indexRequest = null;
      throw error;
    });
    indexRequest = request;
  }
  return indexRequest;
}

async function readBoard(row) {
  const response = await fetch(snapshotPath(row.stamp));
  if (response.status === 404) return { snapshot: null, reason: "The price board for that date is unavailable." };
  if (!response.ok) throw new Error("Trade-date prices could not load.");
  const board = await response.json();
  if (Date.parse(board?.asOf) !== Date.parse(row.asOf) || !board?.sf || typeof board.sf !== "object"
      || (row.modelVersion && board.modelVersion && row.modelVersion !== board.modelVersion)
      || (row.valueScale != null && board.valueScale != null && row.valueScale !== board.valueScale)) {
    throw new Error("Trade-date price board does not match the archive.");
  }
  // Some early files were written before modelVersion was included in the
  // board itself. Their index rows identify the historical pricing model.
  const snapshot = { ...row, ...board };
  if (!snapshotPrices(snapshot)) return { snapshot: null, reason: "These archived prices use an unsupported scale." };
  return { snapshot, reason: "" };
}

export async function loadTradeDatePrices(trade) {
  if (!(Number(trade?.created) > 0)) return { snapshot: null, reason: "Trade date unavailable." };
  const row = priceRowForTrade(await getIndex(), trade);
  if (!row) return { snapshot: null, reason: "No archived price board in the seven days leading up to this trade." };
  if (!boards.has(row.stamp)) {
    const request = readBoard(row).then(result => {
      if (!result.snapshot) boards.delete(row.stamp);
      return result;
    }).catch(error => {
      boards.delete(row.stamp);
      throw error;
    });
    boards.set(row.stamp, request);
  }
  return boards.get(row.stamp);
}
