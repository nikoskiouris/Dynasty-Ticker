import test from "node:test";
import assert from "node:assert/strict";
import {
  describeUserSearchFailure,
  findRosterForSleeperUser,
  isMissingSleeperUser,
  isSleeperUnreachable,
  leagueStatusLabel,
  renderLeaguePickerMarkup,
  renderLeagueSearchNote,
  renderMeSelectOptions,
  resolveDefaultMeRoster,
  seasonSearchHardFailField,
  seasonSearchHardFailStatus,
  seasonSearchSoftFailNote,
} from "../docs/modules/league-search.js";
import { createSleeperClient, fetchUserLeagues } from "../docs/modules/sleeper.js";

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
  const sample = renderMeSelectOptions([
    { rosterId: 1, manager: { displayName: "Alpha" } },
    { rosterId: 7, manager: { displayName: "chrisalberts" } },
  ], 7, { sample: true, rosterId: 7 });
  assert.match(sample, /Viewing chrisalberts · sample/);
  assert.doesNotMatch(sample, /\(you\)/);
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

test("season search failure copy stays short in the field and full in the status", () => {
  assert.equal(
    seasonSearchHardFailStatus("2026"),
    "Couldn't load 2026 leagues from Sleeper. Try again — we won't open a league until this year's list comes back.",
  );
  assert.equal(seasonSearchHardFailField("2026"), "Couldn't load 2026 leagues.");
  assert.equal(seasonSearchSoftFailNote(["2025"]), "Also couldn't load 2025.");
  assert.equal(seasonSearchSoftFailNote(["2025", "2024"]), "Also couldn't load 2025 and 2024.");
  assert.equal(seasonSearchSoftFailNote([]), "");
  const note = renderLeagueSearchNote(["2025"]);
  assert.match(note, /class="league-picker-note muted"/);
  assert.match(note, /Also couldn&#39;t load 2025\./);
  assert.equal(renderLeagueSearchNote([]), "");
});

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    async json() {
      return payload;
    },
  };
}

test("only a missing Sleeper user is 'no user'; everything else can retry", () => {
  assert.equal(isMissingSleeperUser({ status: 404, message: "Sleeper API returned 404" }), true);
  assert.equal(isMissingSleeperUser(new Error('No Sleeper user named "nobody".')), true);
  assert.equal(isMissingSleeperUser({ status: 200, message: 'No Sleeper user named "nobody".' }), true);
  assert.equal(isMissingSleeperUser({ status: 500, message: "Sleeper API returned 500" }), false);
  assert.equal(isMissingSleeperUser({ status: 429, message: "Sleeper API returned 429" }), false);
  assert.equal(isMissingSleeperUser(new SyntaxError("Unexpected token")), false);
  assert.equal(isMissingSleeperUser(new Error("Network/CORS error while contacting Sleeper API")), false);

  assert.deepEqual(describeUserSearchFailure({ status: 404 }, "Niko"), {
    message: "No Sleeper user named Niko.",
    retry: false,
  });
  assert.deepEqual(describeUserSearchFailure(new Error('No Sleeper user named "Niko".'), "Niko"), {
    message: "No Sleeper user named Niko.",
    retry: false,
  });
  for (const err of [
    { status: 500, message: "Sleeper API returned 500" },
    new SyntaxError("Unexpected token"),
  ]) {
    const failure = describeUserSearchFailure(err, "Niko");
    assert.equal(failure.retry, true);
    assert.equal(failure.message, "Sleeper failed for Niko.");
    assert.doesNotMatch(failure.message, /No Sleeper user/);
  }

  const offline = describeUserSearchFailure(new Error("Network/CORS error while contacting Sleeper API"), "Niko");
  assert.equal(offline.retry, true);
  assert.equal(offline.message, "Couldn't reach Sleeper.");
  assert.doesNotMatch(offline.message, /Sleeper failed/);

  const dropped = describeUserSearchFailure(new Error("Sleeper API timed out after 10s"), "Niko");
  assert.equal(dropped.message, "Couldn't reach Sleeper.");
  assert.equal(isSleeperUnreachable(new TypeError("Failed to fetch")), true);
  assert.equal(isSleeperUnreachable(new Error("Sleeper API timed out after 10s")), true);
  assert.equal(isSleeperUnreachable(new Error("Network/CORS error while contacting Sleeper API")), true);
  assert.equal(isSleeperUnreachable({ status: 500, message: "Sleeper API returned 500" }), false);
  assert.equal(isSleeperUnreachable(new SyntaxError("Unexpected token")), false);

  const busy = describeUserSearchFailure({ status: 429, message: "Sleeper API returned 429" }, "Niko");
  assert.equal(busy.retry, true);
  assert.equal(busy.message, "Sleeper is busy. Try again.");
  assert.doesNotMatch(busy.message, /Sleeper failed/);
});

test("live Sleeper failures keep status and SyntaxError for the search copy", async () => {
  async function failureFrom(fetchImpl) {
    const client = createSleeperClient({
      minIntervalMs: 0,
      sleep: async () => {},
      fetchImpl,
    });
    try {
      await fetchUserLeagues(client, "Niko", ["2026"]);
    } catch (err) {
      return describeUserSearchFailure(err, "Niko");
    }
    throw new Error("expected fetchUserLeagues to fail");
  }

  const missing = await failureFrom(async () => jsonResponse(null, 200));
  assert.equal(missing.retry, false);
  assert.equal(missing.message, "No Sleeper user named Niko.");

  const noId = await failureFrom(async () => jsonResponse({ display_name: "Niko" }, 200));
  assert.equal(noId.retry, false);

  const missingUser = await failureFrom(async () => jsonResponse({}, 404));
  assert.equal(missingUser.retry, false);
  assert.equal(missingUser.message, "No Sleeper user named Niko.");

  const down = await failureFrom(async () => jsonResponse({}, 500));
  assert.equal(down.message, "Sleeper failed for Niko.");
  assert.equal(down.retry, true);

  const limited = await failureFrom(async () => jsonResponse({}, 429));
  assert.equal(limited.retry, true);
  assert.equal(limited.message, "Sleeper is busy. Try again.");
  assert.doesNotMatch(limited.message, /Sleeper failed/);

  const badJson = await failureFrom(async () => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json() {
      return Promise.reject(new SyntaxError("Unexpected token"));
    },
  }));
  assert.equal(badJson.retry, true);
  assert.equal(badJson.message, "Sleeper failed for Niko.");

  const offline = await failureFrom(async () => {
    throw new TypeError("Failed to fetch");
  });
  assert.equal(offline.retry, true);
  assert.equal(offline.message, "Couldn't reach Sleeper.");
  assert.doesNotMatch(offline.message, /Sleeper failed/);

  const timeout = await failureFrom(async () => {
    throw new Error("Sleeper API timed out after 8s");
  });
  assert.equal(timeout.message, "Couldn't reach Sleeper.");
  assert.equal(timeout.retry, true);
});

test("league picker names redraft and keeper rooms", () => {
  const html = renderLeaguePickerMarkup([
    { league_id: "r1", name: "Sunday Redraft", season: "2026", total_rosters: 12, status: "in_season", settings: { type: 0 } },
    { league_id: "k1", name: "Keep 3", season: "2026", total_rosters: 10, status: "in_season", settings: { type: 1 } },
  ], "2026", "r1");
  assert.match(html, /12 teams · Redraft · in season/);
  assert.match(html, /10 teams · Keeper · in season/);
});
