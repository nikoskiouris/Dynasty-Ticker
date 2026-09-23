import test from "node:test";
import assert from "node:assert/strict";
import { ideaPackageKey, selectNextDiverse } from "../docs/modules/deal-more.js";

function idea(lead, extra = "") {
  return {
    lead,
    counterpartyRosterId: lead,
    myAssets: [{ assetId: extra ? `${lead}+${extra}` : lead }],
    theirAssets: [{ assetId: `back-${lead}${extra}` }],
  };
}

const tooSimilar = (candidate, picked) => candidate.lead === picked.lead;

test("first batch stays the top distinct deals", () => {
  const ideas = [idea("a"), idea("a", "2"), idea("c"), idea("d")];
  const first = selectNextDiverse(ideas, 2, { keyOf: ideaPackageKey, tooSimilar });
  assert.deepEqual(first.map((row) => row.lead), ["a", "c"]);
});

test("find more skips deals already on the board and prefers a new shape", () => {
  const ideas = [idea("a"), idea("a", "2"), idea("c"), idea("d")];
  const first = selectNextDiverse(ideas, 2, { keyOf: ideaPackageKey, tooSimilar });
  const more = selectNextDiverse(ideas, 2, { prior: first, keyOf: ideaPackageKey, tooSimilar });
  assert.deepEqual(more.map((row) => row.myAssets[0].assetId), ["d", "a+2"]);
});

test("find more takes the next ranked packages without scanning the whole tail", () => {
  const ideas = [idea("a")];
  for (let index = 0; index < 300; index += 1) ideas.push(idea("a", String(index)));
  ideas.push(idea("z"));
  const first = selectNextDiverse(ideas, 1, { keyOf: ideaPackageKey, tooSimilar });
  const more = selectNextDiverse(ideas, 1, { prior: first, keyOf: ideaPackageKey, tooSimilar });
  assert.equal(more.length, 1);
  assert.equal(more[0].lead, "a");
  assert.notEqual(more[0].myAssets[0].assetId, first[0].myAssets[0].assetId);
});

test("find more stops when every package is already shown", () => {
  const ideas = [idea("a"), idea("c")];
  const more = selectNextDiverse(ideas, 3, { prior: ideas, keyOf: ideaPackageKey });
  assert.deepEqual(more, []);
});

test("package key ignores order and separates multi-team routes", () => {
  const twoTeam = ideaPackageKey({
    counterpartyRosterId: 4,
    myAssets: [{ assetId: "b" }, { assetId: "a" }],
    theirAssets: [{ assetId: "z" }],
  });
  assert.equal(twoTeam, "4=>a|b=>z");
  const multi = ideaPackageKey({
    participants: [
      { roster: { rosterId: 2 }, outgoingAssets: [{ assetId: "q" }] },
      { roster: { rosterId: 1 }, outgoingAssets: [{ assetId: "b" }, { assetId: "a" }] },
    ],
  });
  assert.equal(multi, "1:a|b::2:q");
});
