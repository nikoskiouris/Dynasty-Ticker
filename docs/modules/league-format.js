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
  return true;
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

// League settings describe a warning only. They never select another price map.
export function marketCaveat(league) {
  if (!league) return "";
  const teams = Number(league.total_rosters);
  const slots = (league.roster_positions || []).map((slot) => String(slot).trim().toUpperCase());
  const sf = slots.some((slot) => ["SUPER_FLEX", "SUPERFLEX", "OP"].includes(slot)) || slots.filter((slot) => slot === "QB").length >= 2;
  const ppr = Number(league.scoring_settings?.rec) === 1;
  const dynasty = leagueTypeId(league) === "dynasty";
  if (teams === 12 && sf && ppr && dynasty) return "";
  const shape = [Number.isFinite(teams) && teams > 0 ? `${teams}-team` : "custom-size", sf ? "Superflex" : "1QB", ppr ? "PPR" : "custom scoring", leagueTypeLabel(league).toLowerCase()].join(" ");
  return `Values are built for 12-team Superflex PPR dynasty. Your league is ${shape}, so treat QB values with care.`;
}
