import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const app = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../docs/app.js"), "utf8");

function sliceBetween(start, end) {
  const from = app.indexOf(start);
  const to = app.indexOf(end);
  assert.ok(from >= 0 && to > from, `${start} .. ${end}`);
  return app.slice(from, to);
}

test("choosing Trade from the phone rail scrolls Check an offer into view", () => {
  const menu = sliceBetween("function leavePhoneMenu", "function scrollMotion");
  const motion = sliceBetween("function scrollMotion", "function scrollCheckOfferIntoView");
  const scrollOffer = sliceBetween("function scrollCheckOfferIntoView", "function handlePhoneDeskClick");
  const handler = sliceBetween("function handlePhoneDeskClick", "function sampleVoice");

  assert.match(menu, /history\.replaceState/);
  assert.doesNotMatch(menu, /scrollIntoView|scrollCheckOfferIntoView/);
  assert.doesNotMatch(scrollOffer, /pushState|replaceState|scrollTo\(/);
  assert.doesNotMatch(motion, /pushState|replaceState/);

  assert.match(motion, /prefers-reduced-motion:\s*reduce/);
  assert.match(motion, /return reduce \? "auto" : "smooth"/);
  assert.match(scrollOffer, /#trades-page \[data-room-panel='calculator'\]/);
  assert.match(scrollOffer, /#calculator-section/);
  assert.match(scrollOffer, /scrollIntoView\(\{ behavior: scrollMotion\(\), block: "start" \}\)/);

  assert.match(
    handler,
    /openRoom\(page, room, \{ history: mode, scroll: "top" \}\);\s*if \(page === "trades" && room === "calculator"\) scrollCheckOfferIntoView\(\);/,
  );
  assert.match(
    handler,
    /setActivePage\(page, \{ history: mode, scroll: "top", landing: page === "players" \? "hide" : "" \}\);\s*if \(page === "trades" && getRoom\(page\) === "calculator"\) scrollCheckOfferIntoView\(\);/,
  );
  assert.match(handler, /\[data-phone-room='calculator'\]/);
  assert.match(handler, /scrollIntoView\(\{\s*behavior: scrollMotion\(\),\s*block: "start",\s*\}\)/);
});
