import { isRealUserId, ownerIdFromRoster } from "./franchise.js";

export function draftedPickRosterKey(season, round, originalRosterId) {
  return `${String(season || "")}:${Number(round) || 0}:roster:${String(originalRosterId ?? "")}`;
}

export function draftedPickOwnerKey(season, round, ownerKey) {
  return `${String(season || "")}:${Number(round) || 0}:owner:${String(ownerKey || "")}`;
}

export function pickMetaName(pick) {
  const first = String(pick?.metadata?.first_name || "").trim();
  const last = String(pick?.metadata?.last_name || "").trim();
  return `${first} ${last}`.trim();
}

export function ownerKeyByRosterIdFromRosters(rosters = []) {
  const map = new Map();
  (Array.isArray(rosters) ? rosters : []).forEach((roster) => {
    const rosterId = roster?.roster_id != null ? String(roster.roster_id) : "";
    if (!rosterId) return;
    const userId = ownerIdFromRoster(roster);
    map.set(rosterId, userId ? `user:${userId}` : "");
  });
  return map;
}

export function slotToRosterIdFromDraft(draftDetails, rosters = []) {
  const direct = draftDetails?.slot_to_roster_id;
  if (direct && typeof direct === "object" && Object.keys(direct).length) {
    return { ...direct };
  }

  const inverted = {};
  const rosterIdByOwnerId = new Map();
  (Array.isArray(rosters) ? rosters : []).forEach((roster) => {
    const rosterId = String(roster?.roster_id ?? "");
    if (!rosterId) return;
    const ids = [];
    if (isRealUserId(roster?.owner_id)) ids.push(String(roster.owner_id).trim());
    (Array.isArray(roster?.co_owners) ? roster.co_owners : []).forEach((id) => {
      if (isRealUserId(id)) ids.push(String(id).trim());
    });
    ids.forEach((id) => {
      if (!rosterIdByOwnerId.has(id)) rosterIdByOwnerId.set(id, rosterId);
    });
  });
  const draftOrder = draftDetails?.draft_order && typeof draftDetails.draft_order === "object"
    ? draftDetails.draft_order
    : {};
  Object.entries(draftOrder).forEach(([ownerId, slotToken]) => {
    const rosterId = rosterIdByOwnerId.get(String(ownerId));
    if (!rosterId || slotToken == null || slotToken === "") return;
    inverted[String(slotToken)] = rosterId;
  });
  return inverted;
}

export function sortDraftsForSelectionIngest(drafts = []) {
  return [...(Array.isArray(drafts) ? drafts : [])].sort((left, right) => {
    const leftRounds = Number(left?.settings?.rounds) || 0;
    const rightRounds = Number(right?.settings?.rounds) || 0;
    return rightRounds - leftRounds;
  });
}

export function indexDraftSelections({
  season,
  slotToRosterId,
  ownerKeyByRosterId,
  picks,
} = {}) {
  const map = new Map();
  const slotMap = slotToRosterId && typeof slotToRosterId === "object" ? slotToRosterId : {};
  const ownerMap = ownerKeyByRosterId instanceof Map ? ownerKeyByRosterId : new Map();

  (Array.isArray(picks) ? picks : []).forEach((pick) => {
    const playerId = String(pick?.player_id || pick?.metadata?.player_id || "").trim();
    const round = Number(pick?.round);
    if (!playerId || !Number.isFinite(round) || round <= 0) return;

    const slot = Number(pick?.draft_slot ?? pick?.slot);
    if (!Number.isFinite(slot)) return;
    const originalRosterId = slotMap[String(slot)] ?? slotMap[slot];
    if (originalRosterId == null || originalRosterId === "") return;

    const record = {
      playerId,
      metaName: pickMetaName(pick),
      round,
      season: String(season || ""),
      originalRosterId: String(originalRosterId),
    };
    map.set(draftedPickRosterKey(season, round, originalRosterId), record);
    const ownerKey = ownerMap.get(String(originalRosterId)) || ownerMap.get(originalRosterId);
    if (ownerKey) {
      map.set(draftedPickOwnerKey(season, round, ownerKey), record);
    }
  });

  return map;
}

export function mergeDraftSelectionIndex(target, incoming) {
  const dest = target instanceof Map ? target : new Map();
  if (incoming instanceof Map) {
    incoming.forEach((value, key) => dest.set(key, value));
  }
  return dest;
}

export function lookupDraftedSelection(index, {
  season,
  round,
  originalRosterId,
  ownerKey,
} = {}) {
  const source = index instanceof Map ? index : new Map();
  const byRoster = source.get(draftedPickRosterKey(season, round, originalRosterId));
  if (byRoster) return byRoster;
  const owner = String(ownerKey || "").trim();
  if (!owner) return null;
  return source.get(draftedPickOwnerKey(season, round, owner)) || null;
}

export function formatPickWithSelection(pickName, playerName, playerValue, formatNumber) {
  const name = String(pickName || "").trim();
  const player = String(playerName || "").trim();
  if (!name || !player) return name;
  const value = Number(playerValue) || 0;
  if (value > 0) {
    const formatted = typeof formatNumber === "function" ? formatNumber(value) : String(value);
    return `${name} (${player}, ${formatted})`;
  }
  return `${name} (${player})`;
}
