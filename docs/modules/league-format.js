import { HOME_ROOM, PAGE_ROOMS, ROOM_HINTS, ROOM_LABELS } from "./constants.js";

export const LEAGUE_TYPE_IDS = Object.freeze({
  redraft: "redraft",
  keeper: "keeper",
  dynasty: "dynasty",
});

export const LEAGUE_TYPES = Object.freeze({
  redraft: {
    id: "redraft",
    label: "Redraft",
    sleeperType: 0,
    keepsPlayers: false,
    futurePicks: false,
    horizon: "season",
    hiddenRooms: Object.freeze([]),
  },
  keeper: {
    id: "keeper",
    label: "Keeper",
    sleeperType: 1,
    keepsPlayers: true,
    futurePicks: false,
    horizon: "dynasty",
    hiddenRooms: Object.freeze([]),
  },
  dynasty: {
    id: "dynasty",
    label: "Dynasty",
    sleeperType: 2,
    keepsPlayers: true,
    futurePicks: true,
    horizon: "dynasty",
    hiddenRooms: Object.freeze([]),
  },
});

function sleeperTypeToken(league) {
  const raw = league?.settings?.type;
  if (raw == null || raw === "") return "";
  return String(raw).trim().toLowerCase();
}

export function leagueTypeId(league) {
  const token = sleeperTypeToken(league);
  if (token === "0" || token === "redraft") return LEAGUE_TYPE_IDS.redraft;
  if (token === "1" || token === "keeper") return LEAGUE_TYPE_IDS.keeper;
  if (token === "2" || token === "dynasty") return LEAGUE_TYPE_IDS.dynasty;
  return LEAGUE_TYPE_IDS.dynasty;
}

export function leagueTypeMeta(league) {
  return LEAGUE_TYPES[leagueTypeId(league)] || LEAGUE_TYPES.dynasty;
}

export function leagueTypeLabel(league) {
  return leagueTypeMeta(league).label;
}

export function leagueKeepsPlayers(league) {
  return true;
}

export function leagueUsesFuturePicks(league) {
  return leagueTypeMeta(league).futurePicks;
}

export function hiddenRoomsForLeague() { return []; }

export function roomsForPage(page, league) {
  const rooms = PAGE_ROOMS[page] || [];
  // My League rooms other than the team need a loaded league. Guests stay on team.
  if (page === "league" && !league) return rooms.filter((room) => room === HOME_ROOM);
  const hidden = new Set(
    hiddenRoomsForLeague(league)
      .filter((entry) => entry.page === page)
      .map((entry) => entry.room),
  );
  return rooms.filter((room) => !hidden.has(room));
}

export function isRoomVisible(page, room, league) {
  return roomsForPage(page, league).includes(room);
}

export function visibleRoomFor(page, room, league) {
  if (page === "league" && room === HOME_ROOM) return HOME_ROOM;
  const rooms = roomsForPage(page, league);
  if (rooms.includes(room)) return room;
  const fallback = rooms[0];
  return fallback || room || "";
}

export function roomLabelFor(page, room) {
  return ROOM_LABELS[page]?.[room] || room || "";
}

export function roomHintFor(page, room) {
  return ROOM_HINTS[page]?.[room] || "";
}

export function roomDescriptionFor() { return ""; }

function leagueShape(league) {
  const slots = (league?.roster_positions || []).map((slot) => String(slot).trim().toUpperCase());
  const flexCount = slots.filter((slot) => ["SUPER_FLEX", "SUPERFLEX", "OP"].includes(slot)).length;
  const qbCount = slots.filter((slot) => slot === "QB").length;
  const sf = flexCount === 1 && qbCount === 1;
  const qbFormat = sf ? "SF" : [`${qbCount}QB`, flexCount === 1 ? "SF" : flexCount > 1 ? `${flexCount} SF` : ""].filter(Boolean).join(" + ");
  // Sleeper omits unscored stats. A present scoring table with no rec is standard scoring.
  const rec = league?.scoring_settings ? Number(league.scoring_settings.rec ?? 0) : NaN;
  const scoring = rec === 1 ? "PPR" : rec === 0.5 ? "Half PPR" : rec === 0 ? "Standard"
    : Number.isFinite(rec) ? `${rec} PPR` : "Unknown scoring";
  return { teams: Number(league?.total_rosters), sf, qbFormat: slots.length ? qbFormat : "Unknown lineup", scoring, ppr: rec === 1, tep: Number(league?.scoring_settings?.bonus_rec_te) > 0 };
}

export function leagueFormat(league) {
  const { teams, qbFormat, scoring, tep } = leagueShape(league);
  const chip = [teams ? `${teams}-team` : "", qbFormat, scoring, tep ? "TE bonus" : "", leagueTypeLabel(league)].filter(Boolean).join(" · ");
  return { chip };
}

// League settings describe a warning only. They never select another price map.
export function marketCaveat(league) {
  if (!league) return "";
  const { teams, sf, qbFormat, ppr, scoring, tep } = leagueShape(league);
  const dynasty = leagueTypeId(league) === "dynasty";
  if (teams === 12 && sf && ppr && dynasty && !tep) return "";
  const shape = [Number.isFinite(teams) && teams > 0 ? `${teams}-team` : "custom-size", sf ? "Superflex" : qbFormat, scoring, tep ? "TE premium" : "", leagueTypeLabel(league).toLowerCase()].filter(Boolean).join(" ");
  // Name what differs, not just QBs: each gap affects different prices.
  const care = [
    !sf && "QB values (they assume Superflex)",
    !ppr && "pass-catcher values (they assume full PPR)",
    tep && "TE values (they assume no TE premium)",
    !(teams === 12) && "depth and pick values (they assume 12 teams)",
    !dynasty && "long-term values (they assume dynasty)",
  ].filter(Boolean);
  const list = care.length > 1 ? `${care.slice(0, -1).join(", ")} and ${care[care.length - 1]}` : care[0];
  return `Values are built for 12-team Superflex PPR dynasty. Your league is ${shape}, so treat ${list} with care.`;
}
