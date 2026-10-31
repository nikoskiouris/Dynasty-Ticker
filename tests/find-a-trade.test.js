// Find a trade (report 2026-10-31): Shop a player finds fair offers, every
// offer is one Check a trade would call fair, and no text points at a missing control.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { shopOffers } from "../docs/modules/shop-player.js";
import { draftVerdictModel } from "../docs/modules/trade-draft.js";
import { verdictCopy, verdictLineNamed } from "../docs/modules/verdict-copy.js";

const model = (give, get) => draftVerdictModel(give, get, { globalMaxValue: 14821 });
const row = (name, value) => ({ asset: { assetId: `player:${name}`, name }, value });

test("shop: each team's best fair return, one-for-one first, never an overpay", () => {
  const offers = shopOffers({
    target: { asset: row("Star", 9000).asset, value: 9000 },
    payers: [
      { rosterId: 2, name: "A", assets: [row("Even", 8900), row("Junk", 300)] },
      { rosterId: 3, name: "B", assets: [row("Small", 2000), row("Tiny", 900)] },
      { rosterId: 4, name: "C", assets: [row("Half", 5200), row("Half2", 5100), row("Third", 3000)] },
    ],
    model,
  });
  assert.equal(offers[0].teamName, "A");
  assert.deepEqual(offers[0].assets.map((a) => a.name), ["Even"]);
  assert.ok(!offers.some((o) => o.teamName === "B"), "a team that can't pay fairly is left out");
  for (const offer of offers) {
    const tier = verdictCopy(model([9000], offer.values).verdict).tier;
    assert.ok(tier === "even" || tier === "edge", `${offer.teamName} ${tier}`);
  }
});

test("verdict sentences say 'You give 12% more', not 'Give side worth'", () => {
  const line = verdictLineNamed(model([10000], [11200]).verdict, { Give: "You give", Get: "You get" });
  assert.match(line, /You get 12% more$/);
});

test("Find a trade markup has no Find partners button and no pointer to a missing control", () => {
  const html = readFileSync(new URL("../docs/ui/trades.html", import.meta.url), "utf8");
  const app = readFileSync(new URL("../docs/app.js", import.meta.url), "utf8");
  assert.doesNotMatch(html, /Find partners/);
  assert.match(html, /id="shop-panel"/);
  for (const text of [html, app]) {
    assert.doesNotMatch(text, /Try Find deals on a specific name/);
    assert.doesNotMatch(text, /Match will look/);
    assert.doesNotMatch(text, /Lineup rank stays put/);
  }
});
