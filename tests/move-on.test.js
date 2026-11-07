import test from "node:test";
import assert from "node:assert/strict";
import { buildMoveOnList } from "../docs/modules/move-on.js";

const players = [
  { assetId: "player:1", name: "Old WR Starter", position: "WR", value: 4200, age: 30, starter: true },
  { assetId: "player:2", name: "Young WR Bench", position: "WR", value: 2600, age: 23, starter: false },
  { assetId: "player:3", name: "Old RB Starter", position: "RB", value: 3000, age: 28, starter: true },
  { assetId: "player:4", name: "Old TE Bench", position: "TE", value: 2000, age: 31, starter: false },
  { assetId: "player:5", name: "Cheap Vet", position: "WR", value: 900, age: 33, starter: false },
];
const buyers = [
  { name: "kendall_w", teamState: "contending", needs: ["WR"] },
  { name: "quinn_h", teamState: "rebuilding", needs: ["WR"] },
  { name: "emery_k", teamState: "contending", needs: [] },
];
const names = (list) => list.map((row) => row.name);

test("a rebuild sells aging producers, starters included", () => {
  const list = buildMoveOnList({ players, teamState: "rebuilding", buyers });
  assert.deepEqual(names(list), ["Old WR Starter", "Old RB Starter", "Old TE Bench"]);
  assert.match(list[0].why, /^WR, 30: his price usually falls before a rebuild pays off/);
  assert.equal(list[0].ask, "a 1st");
  assert.deepEqual(list[0].buyers, ["kendall_w", "quinn_h"]);
});

test("in between sells bench depth and aging backs", () => {
  const list = buildMoveOnList({ players, teamState: "middle", buyers });
  assert.deepEqual(names(list), ["Old RB Starter", "Young WR Bench", "Old TE Bench"]);
  assert.equal(list.find((row) => row.name === "Young WR Bench").ask, "a 2nd and a young player");
});

test("a contender never sells its core, only aging bench pieces", () => {
  const list = buildMoveOnList({ players, teamState: "contending", buyers });
  assert.deepEqual(names(list), ["Old TE Bench"]);
  assert.ok(list.every((row) => !row.starter));
});

test("cheap players and empty rosters give no names", () => {
  assert.deepEqual(buildMoveOnList({ players: [players[4]], teamState: "rebuilding", buyers }), []);
  assert.deepEqual(buildMoveOnList({}), []);
});
