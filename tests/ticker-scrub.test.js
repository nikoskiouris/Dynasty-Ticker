import test from "node:test";
import assert from "node:assert/strict";
import {
  isTickerTap,
  tickerOffsetFromTime,
  tickerTimeFromOffset,
  wrapTickerOffset,
} from "../docs/modules/ticker-scrub.js";

test("ticker offsets wrap so drag can go backward or forward", () => {
  assert.equal(wrapTickerOffset(-10, 100), 90);
  assert.equal(wrapTickerOffset(110, 100), 10);
  assert.equal(tickerOffsetFromTime(500, 1000, 200), 100);
  assert.equal(tickerTimeFromOffset(50, 1000, 200), 250);
  assert.equal(isTickerTap(3), true);
  assert.equal(isTickerTap(20), false);
});
