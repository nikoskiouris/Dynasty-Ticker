import { isRealUserId, ownerIdFromRoster } from "./franchise.js";
import { leagueUsesFuturePicks } from "./league-format.js";

// Which draft years a league actually owns. The price board runs six years
// ahead so a missing year can be discounted. That board is not a pick inventory.
export function inferPickSeasonSpan({
  leagueSeason = null,
  explicitSeasons = [],
  tradedSeasons = [],
  minOpenSeason = null,
} = {}) {
  const observed = [...explicitSeasons, ...tradedSeasons]
    .map((season) => Number(season))
    .filter((season) => Number.isFinite(season));
  const base = Number(leagueSeason);
  const baseSeason = Number.isFinite(base) ? base : new Date().getUTCFullYear();
  let startSeason = observed.length ? Math.min(...observed) : baseSeason;
  if (startSeason < baseSeason) startSeason = baseSeason;
  const openSeason = Number(minOpenSeason);
  if (Number.isFinite(openSeason) && startSeason < openSeason) startSeason = openSeason;
  const inWindow = observed.filter((season) => season >= startSeason);
  const endSeason = Math.max(
    startSeason + (inWindow.length > 0 ? 1 : 2),
    ...(inWindow.length ? inWindow : [startSeason]),
  );
  const seasons = [];
  for (let season = startSeason; season <= endSeason; season += 1) seasons.push(String(season));
  return seasons;
}

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

function normalizeRosterIdKey(value) {
  if (value == null || value === "") return null;
  return String(value);
}

function toNumericIfPossible(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && String(numeric) === String(value) ? numeric : value;
}

function draftStatusIsComplete(status) {
  return String(status || "").trim().toLowerCase() === "complete";
}

export function buildOwnedPickKey(season, round, originalOwnerKey) {
  return `${season}:${round}:${originalOwnerKey}`;
}

export function normalizeOwnedPickRecord(pick, fallbackOwnerId = null) {
  const season = pick?.season != null ? String(pick.season) : "";
  const round = Number(pick?.round);
  if (!season || !Number.isFinite(round)) return null;

  const originalOwner = pick?.original_owner ?? pick?.roster_id ?? fallbackOwnerId ?? "any";
  const currentOwner = pick?.owner_id ?? fallbackOwnerId ?? originalOwner;

  return {
    ...pick,
    season,
    round,
    roster_id: originalOwner,
    original_owner: originalOwner,
    owner_id: currentOwner,
    previous_owner_id: pick?.previous_owner_id ?? currentOwner,
  };
}

export function normalizeTradedPickRecord(pick) {
  const season = pick?.season != null ? String(pick.season) : "";
  const round = Number(pick?.round);
  const originalOwner = pick?.roster_id ?? pick?.original_owner;
  const currentOwner = pick?.owner_id;
  if (!season || !Number.isFinite(round) || originalOwner == null || currentOwner == null) {
    return null;
  }

  return {
    ...pick,
    season,
    round,
    roster_id: originalOwner,
    original_owner: originalOwner,
    owner_id: currentOwner,
    previous_owner_id: pick?.previous_owner_id ?? currentOwner,
  };
}

export function getMinOpenPickSeason(currentDraftContext) {
  if (!draftStatusIsComplete(currentDraftContext?.status)) return null;
  const draftedSeason = Number(currentDraftContext?.season);
  return Number.isFinite(draftedSeason) ? draftedSeason + 1 : null;
}

export function isConsumedDraftPick(pick, currentDraftContext, assignedDraftSlot = null) {
  if (!pick || !currentDraftContext) return false;

  const pickSeason = String(pick.season || "");
  const draftSeason = String(currentDraftContext.season || "");
  if (!pickSeason || !draftSeason || pickSeason !== draftSeason) return false;
  if (draftStatusIsComplete(currentDraftContext.status)) return true;

  const round = Number(pick.round);
  const originalOwnerKey = normalizeRosterIdKey(pick.original_owner ?? pick.roster_id);
  if (
    originalOwnerKey
    && Number.isFinite(round)
    && currentDraftContext.usedPickKeys?.has(buildOwnedPickKey(pickSeason, round, originalOwnerKey))
  ) {
    return true;
  }

  const slot = Number(assignedDraftSlot?.slot ?? pick.assignedDraftSlot);
  return Number.isFinite(round)
    && Number.isFinite(slot)
    && currentDraftContext.usedSlotKeys?.has(`${round}:${slot}`);
}

export function inferLeaguePickSeasons(league, rosters, tradedPicks = [], _pickValueCatalog = [], currentDraftContext = null) {
  const explicitSeasons = (Array.isArray(rosters) ? rosters : [])
    .flatMap((roster) => Array.isArray(roster?.picks) ? roster.picks : [])
    .map((pick) => Number(pick?.season))
    .filter(Number.isFinite);
  const tradedSeasons = (Array.isArray(tradedPicks) ? tradedPicks : [])
    .map((pick) => Number(pick?.season))
    .filter(Number.isFinite);
  return inferPickSeasonSpan({
    leagueSeason: league?.season,
    explicitSeasons,
    tradedSeasons,
    minOpenSeason: getMinOpenPickSeason(currentDraftContext),
  });
}

export function inferLeagueDraftRounds(league, rosters, tradedPicks = []) {
  const configuredRounds = Number(league?.settings?.draft_rounds);
  const explicitRounds = (Array.isArray(rosters) ? rosters : [])
    .flatMap((roster) => Array.isArray(roster?.picks) ? roster.picks : [])
    .map((pick) => Number(pick?.round))
    .filter(Number.isFinite);
  const tradedRounds = (Array.isArray(tradedPicks) ? tradedPicks : [])
    .map((pick) => Number(pick?.round))
    .filter(Number.isFinite);

  if (Number.isFinite(configuredRounds) && configuredRounds > 0) {
    return Math.max(configuredRounds, ...explicitRounds, ...tradedRounds);
  }

  return Math.max(...explicitRounds, ...tradedRounds, 5);
}

// Current owner is Sleeper owner_id. roster_id / original_owner is who the pick
// belonged to before trades. A traded pick moves; it is not counted twice.
export function buildOwnedPicksByRoster(league, rosters, tradedPicks = [], pickValueCatalog = [], currentDraftContext = null) {
  const rosterList = Array.isArray(rosters) ? rosters : [];
  const rosterKeys = rosterList
    .map((roster) => normalizeRosterIdKey(roster.roster_id))
    .filter(Boolean);
  const ownedByRoster = new Map(rosterKeys.map((rosterKey) => [rosterKey, []]));
  const explicitPickCount = rosterList.reduce(
    (total, roster) => total + (Array.isArray(roster?.picks) ? roster.picks.length : 0),
    0
  );

  if (explicitPickCount > 0) {
    rosterList.forEach((roster) => {
      const rosterKey = normalizeRosterIdKey(roster.roster_id);
      if (!rosterKey) return;
      ownedByRoster.set(
        rosterKey,
        (Array.isArray(roster.picks) ? roster.picks : [])
          .map((pick) => normalizeOwnedPickRecord(pick, roster.roster_id))
          .filter((pick) => pick && !isConsumedDraftPick(pick, currentDraftContext))
      );
    });
    return ownedByRoster;
  }

  if (!leagueUsesFuturePicks(league)) {
    const rosterKeySet = new Set(rosterKeys);
    (Array.isArray(tradedPicks) ? tradedPicks : [])
      .map((pick) => normalizeTradedPickRecord(pick))
      .filter(Boolean)
      .forEach((pick) => {
        const currentOwnerKey = normalizeRosterIdKey(pick.owner_id);
        if (!currentOwnerKey || !rosterKeySet.has(currentOwnerKey)) return;
        const targetList = ownedByRoster.get(currentOwnerKey);
        if (!targetList) return;
        if (isConsumedDraftPick(pick, currentDraftContext)) return;
        targetList.push(pick);
      });
    return ownedByRoster;
  }

  const seasons = inferLeaguePickSeasons(league, rosterList, tradedPicks, pickValueCatalog, currentDraftContext);
  const draftRounds = inferLeagueDraftRounds(league, rosterList, tradedPicks);
  if (seasons.length === 0 || draftRounds <= 0) return ownedByRoster;

  const rosterKeySet = new Set(rosterKeys);
  const currentOwnerByPick = new Map();

  for (const season of seasons) {
    for (let round = 1; round <= draftRounds; round += 1) {
      for (const originalOwnerKey of rosterKeys) {
        currentOwnerByPick.set(buildOwnedPickKey(season, round, originalOwnerKey), originalOwnerKey);
      }
    }
  }

  (Array.isArray(tradedPicks) ? tradedPicks : [])
    .map((pick) => normalizeTradedPickRecord(pick))
    .filter(Boolean)
    .forEach((pick) => {
      const originalOwnerKey = normalizeRosterIdKey(pick.roster_id);
      const currentOwnerKey = normalizeRosterIdKey(pick.owner_id);
      if (
        !originalOwnerKey
        || !currentOwnerKey
        || !rosterKeySet.has(originalOwnerKey)
        || !rosterKeySet.has(currentOwnerKey)
      ) {
        return;
      }
      currentOwnerByPick.set(buildOwnedPickKey(pick.season, pick.round, originalOwnerKey), currentOwnerKey);
    });

  currentOwnerByPick.forEach((currentOwnerKey, ownershipKey) => {
    const targetList = ownedByRoster.get(currentOwnerKey);
    if (!targetList) return;

    const [season, roundToken, originalOwnerKey] = ownershipKey.split(":");
    const pick = {
      season,
      round: Number(roundToken),
      roster_id: toNumericIfPossible(originalOwnerKey),
      original_owner: toNumericIfPossible(originalOwnerKey),
      owner_id: toNumericIfPossible(currentOwnerKey),
      previous_owner_id: toNumericIfPossible(currentOwnerKey),
    };
    if (isConsumedDraftPick(pick, currentDraftContext)) return;
    targetList.push(pick);
  });

  ownedByRoster.forEach((picks) => {
    picks.sort((a, b) => {
      const seasonDiff = Number(a.season) - Number(b.season);
      if (seasonDiff !== 0) return seasonDiff;
      const roundDiff = Number(a.round) - Number(b.round);
      if (roundDiff !== 0) return roundDiff;
      return String(a.original_owner).localeCompare(String(b.original_owner));
    });
  });

  return ownedByRoster;
}

