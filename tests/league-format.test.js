import test from "node:test";
import assert from "node:assert/strict";
import {
  hiddenRoomsForLeague,
  isRoomVisible,
  leagueTypeId,
  leagueTypeLabel,
  leagueUsesFuturePicks,
  marketCaveat,
  pageHintForLeague,
  roomLabelFor,
  roomsForPage,
  visibleRoomFor,
  windowCallHorizon,
} from "../docs/modules/league-format.js";

function leagueWithType(type) {
  return { settings: { type } };
}

test("Sleeper type 0/1/2 maps to redraft, keeper, dynasty", () => {
  assert.equal(leagueTypeId(leagueWithType(0)), "redraft");
  assert.equal(leagueTypeId(leagueWithType("0")), "redraft");
  assert.equal(leagueTypeId(leagueWithType("redraft")), "redraft");
  assert.equal(leagueTypeId(leagueWithType(1)), "keeper");
  assert.equal(leagueTypeId(leagueWithType(2)), "dynasty");
  assert.equal(leagueTypeId(leagueWithType("dynasty")), "dynasty");
  assert.equal(leagueTypeId({}), "dynasty");
  assert.equal(leagueTypeLabel(leagueWithType(0)), "Redraft");
  assert.equal(leagueTypeLabel(leagueWithType(2)), "Dynasty");
});

test("redraft hides loyalty and the rookie mock, keeper and dynasty do not", () => {
  const redraft = leagueWithType(0);
  const keeper = leagueWithType(1);
  const dynasty = leagueWithType(2);
  assert.deepEqual(
    hiddenRoomsForLeague(redraft).map((row) => `${row.page}:${row.room}`).sort(),
    ["teams:loyalty", "teams:mock"],
  );
  assert.equal(hiddenRoomsForLeague(keeper).length, 0);
  assert.equal(hiddenRoomsForLeague(dynasty).length, 0);
  assert.equal(isRoomVisible("teams", "loyalty", redraft), false);
  assert.equal(isRoomVisible("teams", "mock", redraft), false);
  assert.equal(isRoomVisible("teams", "call", redraft), true);
  assert.equal(isRoomVisible("teams", "loyalty", dynasty), true);
  assert.ok(!roomsForPage("teams", redraft).includes("loyalty"));
  assert.ok(roomsForPage("teams", dynasty).includes("mock"));
  assert.equal(visibleRoomFor("teams", "loyalty", redraft), "roster");
  assert.equal(visibleRoomFor("teams", "call", redraft), "call");
  assert.ok(!roomsForPage("league").includes("start"));
  assert.equal(visibleRoomFor("league", "start"), "start");
  assert.deepEqual(roomsForPage("teams"), ["roster", "call", "loyalty", "passports", "mock"]);
  assert.deepEqual(roomsForPage("trades"), ["match", "value", "ranks", "calculator", "lab", "log"]);
});

test("only dynasty invents a future pick grid", () => {
  assert.equal(leagueUsesFuturePicks(leagueWithType(0)), false);
  assert.equal(leagueUsesFuturePicks(leagueWithType(1)), false);
  assert.equal(leagueUsesFuturePicks(leagueWithType(2)), true);
  assert.equal(windowCallHorizon(leagueWithType(0)), "season");
  assert.equal(windowCallHorizon(leagueWithType(2)), "dynasty");
});

test("redraft copy names the season call and warns about dynasty prices", () => {
  const redraft = leagueWithType(0);
  assert.equal(roomLabelFor("teams", "call", redraft), "In it or out");
  assert.equal(roomLabelFor("teams", "call", leagueWithType(2)), "Tank or contend");
  assert.equal(pageHintForLeague("teams", redraft), "Roster, in it or out");
  assert.match(marketCaveat(redraft), /redraft/i);
  assert.match(marketCaveat(redraft), /dynasty market/i);
  assert.equal(marketCaveat(leagueWithType(2)), "");
});
