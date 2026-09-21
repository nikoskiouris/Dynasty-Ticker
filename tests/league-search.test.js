import test from "node:test";
import assert from "node:assert/strict";
import {
  findRosterForSleeperUser,
  leagueStatusLabel,
  renderLeaguePickerMarkup,
  renderMeSelectOptions,
  resolveDefaultMeRoster,
} from "../docs/modules/league-search.js";

test("leagueStatusLabel humanizes sleeper status", () => {
  assert.equal(leagueStatusLabel("in_season"), "in season");
  assert.equal(leagueStatusLabel(""), "league");
});

test("resolveDefaultMeRoster prefers the searched Sleeper user over the first roster", () => {
  const rosters = [
    { rosterId: 1, manager: { userId: "u-alpha", displayName: "Alpha" } },
    { rosterId: 7, manager: { userId: "u-niko", displayName: "NikoSkiouris" } },
    { rosterId: 3, manager: { userId: "u-zeta", displayName: "Zeta" } },
  ];
  const chosen = resolveDefaultMeRoster({
    rosters,
    sleeperUser: { user_id: "u-niko", username: "NikoSkiouris", display_name: "Niko" },
  });
  assert.equal(chosen.rosterId, 7);
});

test("resolveDefaultMeRoster keeps a share-link team ahead of the searched user", () => {
  const rosters = [
    { rosterId: 1, manager: { userId: "u-alpha", displayName: "Alpha" } },
    { rosterId: 7, manager: { userId: "u-niko", displayName: "NikoSkiouris" } },
  ];
  const chosen = resolveDefaultMeRoster({
    rosters,
    pendingMeRosterId: 1,
    sleeperUser: { user_id: "u-niko" },
  });
  assert.equal(chosen.rosterId, 1);
});

test("resolveDefaultMeRoster keeps a manual team pick after the league is loaded", () => {
  const rosters = [
    { rosterId: 1, manager: { userId: "u-alpha", displayName: "Alpha" } },
    { rosterId: 7, manager: { userId: "u-niko", displayName: "NikoSkiouris" } },
  ];
  const chosen = resolveDefaultMeRoster({
    rosters,
    selectedRosterId: 1,
    sleeperUser: { user_id: "u-niko" },
    userPickedMe: true,
  });
  assert.equal(chosen.rosterId, 1);
});

test("resolveDefaultMeRoster ignores a leftover roster id when a username was searched", () => {
  const rosters = [
    { rosterId: 1, manager: { userId: "u-alpha", displayName: "Alpha" } },
    { rosterId: 7, manager: { userId: "u-niko", displayName: "NikoSkiouris" } },
  ];
  const chosen = resolveDefaultMeRoster({
    rosters,
    selectedRosterId: 1,
    sleeperUser: { user_id: "u-niko" },
    userPickedMe: false,
  });
  assert.equal(chosen.rosterId, 7);
});

test("findRosterForSleeperUser matches co-owners and display names", () => {
  const rosters = [
    { rosterId: 2, manager: { userId: "u-alpha", displayName: "Alpha" } },
    { rosterId: 9, manager: { userId: "u-main", displayName: "NikoSkiouris" } },
  ];
  assert.equal(
    findRosterForSleeperUser(rosters, { user_id: "u-niko" }, [
      { roster_id: 2, owner_id: "u-alpha" },
      { roster_id: 9, owner_id: "u-main", co_owners: ["u-niko"] },
    ])?.rosterId,
    9,
  );
  assert.equal(
    findRosterForSleeperUser(
      [{ rosterId: 4, manager: { userId: "x", displayName: "NikoSkiouris" } }],
      { username: "nikoskiouris" },
    )?.rosterId,
    4,
  );
});

test("me select markup marks the searched roster selected even when it is not first alphabetically", () => {
  const html = renderMeSelectOptions([
    { rosterId: 1, manager: { displayName: "Alpha" } },
    { rosterId: 7, manager: { displayName: "NikoSkiouris" } },
  ], 7);
  assert.match(html, /value="7" selected/);
  assert.doesNotMatch(html, /value="1" selected/);
});

test("league picker markup lists seasons and marks the selected desk", () => {
  const html = renderLeaguePickerMarkup([
    { league_id: "111", name: "Try Hard or Die Hard", season: "2026", total_rosters: 12, status: "in_season", avatar: "abc123" },
    { league_id: "222", name: "Old Room", season: "2025", total_rosters: 10, status: "complete" },
  ], "2026", "111");
  assert.match(html, /Try Hard or Die Hard/);
  assert.match(html, /data-league-id="111"/);
  assert.match(html, /league-pick current selected/);
  assert.match(html, /alt="Try Hard or Die Hard logo"/);
  assert.match(html, /2025 · 10 teams · Dynasty · complete/);
  assert.equal(renderLeaguePickerMarkup([]), "");
});

test("league picker names redraft and keeper rooms", () => {
  const html = renderLeaguePickerMarkup([
    { league_id: "r1", name: "Sunday Redraft", season: "2026", total_rosters: 12, status: "in_season", settings: { type: 0 } },
    { league_id: "k1", name: "Keep 3", season: "2026", total_rosters: 10, status: "in_season", settings: { type: 1 } },
  ], "2026", "r1");
  assert.match(html, /12 teams · Redraft · in season/);
  assert.match(html, /10 teams · Keeper · in season/);
});
