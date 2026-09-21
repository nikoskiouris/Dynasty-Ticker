import test from "node:test";
import assert from "node:assert/strict";
import { leagueHistoryRecords, pickLatestCrown } from "../docs/modules/league-crown.js";

test("latest crown is the newest finished champion, never current first place", () => {
  const crown = pickLatestCrown([
    {
      season: "2026",
      isCurrent: true,
      isComplete: false,
      champion: null,
      regularLeader: { managerName: "meechp3" },
    },
    {
      season: "2025",
      isCurrent: false,
      isComplete: true,
      champion: { managerName: "Old Champ" },
      regularLeader: { managerName: "Points Leader" },
    },
    {
      season: "2024",
      isCurrent: false,
      isComplete: true,
      champion: { managerName: "Earlier Champ" },
    },
  ]);
  assert.equal(crown.champion.managerName, "Old Champ");
  assert.equal(crown.season, "2025");
});

test("current first place does not count as latest crown even if labeled champion", () => {
  assert.equal(
    pickLatestCrown([
      {
        season: "2026",
        isCurrent: true,
        isComplete: false,
        champion: { managerName: "meechp3" },
      },
    ]),
    null,
  );
});

test("a completed current season can be the latest crown", () => {
  const crown = pickLatestCrown([
    {
      season: "2026",
      isCurrent: true,
      isComplete: true,
      champion: { managerName: "Just Won" },
    },
    {
      season: "2025",
      isCurrent: false,
      isComplete: true,
      champion: { managerName: "Last Year" },
    },
  ]);
  assert.equal(crown.champion.managerName, "Just Won");
});

test("league history keeps only the short record list", () => {
  const book = {
    records: [
      { id: "high", title: "Highest Score" },
      { id: "low", title: "Lowest Score" },
      { id: "blowout", title: "Biggest Blowout" },
      { id: "closest", title: "Closest Game" },
      { id: "win-streak", title: "Longest Win Streak" },
      { id: "season-points", title: "Most Points, One Season" },
    ],
  };
  assert.deepEqual(
    leagueHistoryRecords(book, ["high", "blowout", "win-streak", "season-points"]).map((row) => row.id),
    ["high", "blowout", "win-streak", "season-points"],
  );
});
