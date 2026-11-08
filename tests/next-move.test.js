import test from "node:test";
import assert from "node:assert/strict";
import { pickNextMove } from "../docs/modules/next-move.js";

const row = (position, rank, percentile, total = 10) => ({ position, rank, percentile, rankLabel: `${rank} / ${total}` });

test("every group in the top half: no weak spot, not 'Upgrade QB' at 4th of 10", () => {
  const move = pickNextMove([row("QB", 4, 0.6), row("RB", 4, 0.62), row("WR", 2, 0.9), row("TE", 3, 0.8)], 10);
  assert.equal(move.kind, "hold");
  assert.equal(move.weakest.position, "QB");
});

test("a bottom-half group is still the upgrade", () => {
  const move = pickNextMove([row("QB", 12, 0.05, 12), row("RB", 1, 1, 12), row("WR", 12, 0.06, 12), row("TE", 7, 0.4, 12)], 12);
  assert.equal(move.kind, "upgrade");
  assert.equal(move.weakest.position, "QB");
  assert.equal(move.strongest.position, "RB");
  // 7th of 12 is bottom half.
  assert.equal(pickNextMove([row("QB", 7, 0.4, 12), row("RB", 2, 0.9, 12)], 12).kind, "upgrade");
  // 6th of 12 is top half.
  assert.equal(pickNextMove([row("QB", 6, 0.5, 12), row("RB", 2, 0.9, 12)], 12).kind, "hold");
});

test("no ranked groups: nothing to say", () => {
  assert.equal(pickNextMove([], 12), null);
  assert.equal(pickNextMove([{ position: "QB" }], 12), null);
});
