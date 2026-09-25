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

test("three destinations stay short for every league type", () => {
  const redraft = leagueWithType(0);
  const keeper = leagueWithType(1);
  const dynasty = leagueWithType(2);
  assert.equal(hiddenRoomsForLeague(redraft).length, 0);
  assert.equal(hiddenRoomsForLeague(keeper).length, 0);
  assert.equal(hiddenRoomsForLeague(dynasty).length, 0);
  assert.deepEqual(roomsForPage("players"), ["ranks"]);
  assert.deepEqual(roomsForPage("trades"), ["calculator", "find"]);
  assert.deepEqual(roomsForPage("league"), ["team", "scores", "board", "activity", "history"]);
  assert.equal(visibleRoomFor("league", "team"), "team");
  assert.equal(isRoomVisible("trades", "calculator", redraft), true);
  assert.equal(isRoomVisible("league", "loyalty", dynasty), false);
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
  assert.equal(roomLabelFor("league", "team", redraft), "My team");
  assert.equal(roomLabelFor("league", "team", leagueWithType(2)), "My team");
  assert.equal(pageHintForLeague("league", redraft), "Your team, this week, and the league");
  assert.match(marketCaveat(redraft), /redraft/i);
  assert.match(marketCaveat(redraft), /dynasty market/i);
  assert.equal(marketCaveat(leagueWithType(2)), "");
});
