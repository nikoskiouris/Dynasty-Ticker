import test from "node:test";
import assert from "node:assert/strict";
import { inventSampleCore, SAMPLE_LEAGUE_NAME, SAMPLE_MANAGERS } from "../docs/modules/sample-league.js";

const real = {
  league: { league_id: "1", name: "The Front Office", avatar: "abc", previous_league_id: "0" },
  users: Array.from({ length: 12 }, (_, i) => ({
    user_id: String(1000 + i), display_name: `realuser${i}`, username: `realuser${i}`, avatar: `av${i}`,
    metadata: { team_name: `Real Team ${i}`, avatar: "x" },
  })),
  rosters: [{ roster_id: 1, owner_id: "1000", players: ["1"], metadata: { p_nick_1: "crude nickname", record: "WWL" } }],
};

test("the sample league shows only invented names, no real usernames, team names, nicknames or avatars", () => {
  const core = inventSampleCore(real);
  const text = JSON.stringify(core);
  assert.doesNotMatch(text, /realuser|Real Team|Front Office|crude nickname|"av\d/);
  assert.equal(core.league.name, SAMPLE_LEAGUE_NAME);
  const invented = new Set(SAMPLE_MANAGERS.map(([u]) => u));
  core.users.forEach((user) => assert.ok(invented.has(user.display_name)));
  assert.equal(new Set(core.users.map((u) => u.display_name)).size, 12, "every manager gets a different name");
  assert.deepEqual(core.users.map((u) => u.user_id), real.users.map((u) => u.user_id), "ids stay so rosters still join");
  assert.deepEqual(core.rosters[0].players, ["1"]);
});

test("the same manager keeps the same invented name across seasons", () => {
  const a = inventSampleCore(real).users.find((u) => u.user_id === "1005").display_name;
  const b = inventSampleCore({ ...real, users: real.users.slice(3) }).users.find((u) => u.user_id === "1005").display_name;
  assert.equal(a, b);
});
