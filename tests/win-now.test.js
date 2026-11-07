import test from "node:test";
import assert from "node:assert/strict";
import { buildWinNowTargets } from "../docs/modules/win-now.js";

const teams = [
  { rosterId: 1, name: "me", teamState: "contending", record: "8-0" },
  { rosterId: 2, name: "finley_t", teamState: "rebuilding", record: "2-6" },
  { rosterId: 3, name: "kendall_w", teamState: "contending", record: "6-2" },
];
const players = [
  { assetId: "player:1", name: "Old QB", position: "QB", value: 7456, age: 31, rosterId: 2 },
  { assetId: "player:2", name: "Old WR", position: "WR", value: 5000, age: 29, rosterId: 2 },
  { assetId: "player:3", name: "Young WR", position: "WR", value: 6000, age: 23, rosterId: 2 },
  { assetId: "player:4", name: "Contender Vet", position: "WR", value: 6000, age: 30, rosterId: 3 },
  { assetId: "player:5", name: "Cheap Vet", position: "WR", value: 900, age: 33, rosterId: 2 },
  { assetId: "player:6", name: "My Vet", position: "QB", value: 6000, age: 33, rosterId: 1 },
];

test("a contender sees older starters on rebuilding teams, holes first, with owner and why", () => {
  const { hidden, targets } = buildWinNowTargets({
    teams, players, myRosterId: 1, myTeamState: "contending",
    holes: [{ position: "WR", rankLabel: "12th / 12" }],
  });
  assert.equal(hidden, false);
  assert.deepEqual(targets.map((row) => row.name), ["Old WR", "Old QB"]);
  assert.equal(targets[0].owner, "finley_t");
  assert.equal(targets[0].fills, "Your WR group ranks 12th of 12");
  assert.equal(targets[0].why, "finley_t is rebuilding (2-6). At 29, he helps a contender this year more than a rebuild later.");
  assert.equal(targets[1].fills, "");
});

test("only names actually on rebuilding rosters, never mine or a contender's", () => {
  const { targets } = buildWinNowTargets({ teams, players, myRosterId: 1, myTeamState: "middle" });
  assert.ok(targets.every((row) => row.rosterId === 2));
});

test("a rebuilder is told not to buy these and gets no names", () => {
  const result = buildWinNowTargets({ teams, players, myRosterId: 2, myTeamState: "rebuilding" });
  assert.equal(result.hidden, true);
  assert.deepEqual(result.targets, []);
  assert.match(result.reason, /Don't buy them\.$/);
});

test("no rebuilding team: empty list, not filler", () => {
  const { targets } = buildWinNowTargets({ teams: teams.map((t) => ({ ...t, teamState: "contending" })), players, myRosterId: 1, myTeamState: "contending" });
  assert.deepEqual(targets, []);
});
