import test from "node:test";
import assert from "node:assert/strict";
import {
  draftedPickRosterKey,
  draftedPickOwnerKey,
  ownerKeyByRosterIdFromRosters,
  slotToRosterIdFromDraft,
  sortDraftsForSelectionIngest,
  indexDraftSelections,
  mergeDraftSelectionIndex,
  lookupDraftedSelection,
  formatPickWithSelection,
} from "../docs/modules/draft-picks.js";

test("indexDraftSelections keys a used pick by original roster and owner", () => {
  const indexed = indexDraftSelections({
    season: "2026",
    slotToRosterId: { 1: 3, 2: 8 },
    ownerKeyByRosterId: new Map([["3", "user:zim"], ["8", "user:other"]]),
    picks: [
      {
        player_id: "11631",
        round: 1,
        draft_slot: 1,
        metadata: { first_name: "Cam", last_name: "Ward" },
      },
      { player_id: "", round: 1, draft_slot: 2 },
    ],
  });

  const hit = lookupDraftedSelection(indexed, {
    season: "2026",
    round: 1,
    originalRosterId: 3,
  });
  assert.equal(hit.playerId, "11631");
  assert.equal(hit.metaName, "Cam Ward");
  assert.equal(
    lookupDraftedSelection(indexed, {
      season: "2026",
      round: 1,
      originalRosterId: 99,
      ownerKey: "user:zim",
    }).playerId,
    "11631"
  );
  assert.equal(
    lookupDraftedSelection(indexed, { season: "2026", round: 1, originalRosterId: 8 }),
    null
  );
  assert.equal(indexed.get(draftedPickRosterKey("2026", 1, 3)).playerId, "11631");
  assert.equal(indexed.get(draftedPickOwnerKey("2026", 1, "user:zim")).playerId, "11631");
});

test("slotToRosterIdFromDraft falls back to draft_order plus rosters", () => {
  const slotMap = slotToRosterIdFromDraft(
    { draft_order: { userA: 4, userB: 1 } },
    [
      { roster_id: 12, owner_id: "userA" },
      { roster_id: 7, owner_id: "userB" },
    ]
  );
  assert.equal(String(slotMap["4"]), "12");
  assert.equal(String(slotMap["1"]), "7");
});

test("slotToRosterIdFromDraft maps co-owners when owner_id is empty", () => {
  const slotMap = slotToRosterIdFromDraft(
    { draft_order: { userCo: 3, userMain: 1 } },
    [
      { roster_id: 9, owner_id: null, co_owners: ["userCo"] },
      { roster_id: 4, owner_id: "userMain", co_owners: [] },
    ]
  );
  assert.equal(String(slotMap["3"]), "9");
  assert.equal(String(slotMap["1"]), "4");
  const keys = ownerKeyByRosterIdFromRosters([
    { roster_id: 9, owner_id: null, co_owners: ["userCo"] },
  ]);
  assert.equal(keys.get("9"), "user:userCo");
});

test("sortDraftsForSelectionIngest puts the smaller/rookie draft last", () => {
  const sorted = sortDraftsForSelectionIngest([
    { draft_id: "rookie", settings: { rounds: 4 } },
    { draft_id: "startup", settings: { rounds: 22 } },
  ]);
  assert.equal(sorted[0].draft_id, "startup");
  assert.equal(sorted[1].draft_id, "rookie");
});

test("later indexes overwrite the same pick key", () => {
  const startup = indexDraftSelections({
    season: "2024",
    slotToRosterId: { 1: 2 },
    picks: [{ player_id: "startup-player", round: 1, draft_slot: 1 }],
  });
  const rookie = indexDraftSelections({
    season: "2024",
    slotToRosterId: { 1: 2 },
    picks: [{ player_id: "rookie-player", round: 1, draft_slot: 1 }],
  });
  const merged = mergeDraftSelectionIndex(startup, rookie);
  assert.equal(
    lookupDraftedSelection(merged, { season: "2024", round: 1, originalRosterId: 2 }).playerId,
    "rookie-player"
  );
});

test("formatPickWithSelection keeps the pick and adds player plus value", () => {
  assert.equal(
    formatPickWithSelection("2026 1st from zim8box", "Cam Ward", 8474, (value) => Number(value).toLocaleString("en-US")),
    "2026 1st from zim8box (Cam Ward, 8,474)"
  );
  assert.equal(
    formatPickWithSelection("2026 1st from zim8box", "Cam Ward", 0),
    "2026 1st from zim8box (Cam Ward)"
  );
  assert.equal(formatPickWithSelection("2026 1st from zim8box", "", 9000), "2026 1st from zim8box");
});

test("ownerKeyByRosterIdFromRosters uses Sleeper user ids", () => {
  const map = ownerKeyByRosterIdFromRosters([
    { roster_id: 12, owner_id: "abc" },
    { roster_id: 3, owner_id: "" },
  ]);
  assert.equal(map.get("12"), "user:abc");
  assert.equal(map.get("3"), "");
});
