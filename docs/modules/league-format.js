import { PAGE_HINTS, PAGE_ROOMS, ROOM_HINTS, ROOM_LABELS } from "./constants.js";

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
    hiddenRooms: Object.freeze([
      { page: "teams", room: "loyalty" },
      { page: "teams", room: "mock" },
    ]),
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
  return Boolean(leagueTypeMeta(league).keepsPlayers);
}

export function leagueUsesFuturePicks(league) {
  return Boolean(leagueTypeMeta(league).futurePicks);
}

export function windowCallHorizon(league) {
  return leagueTypeMeta(league).horizon === "season" ? "season" : "dynasty";
}

export function hiddenRoomsForLeague(league) {
  if (!league) return [];
  return [...(leagueTypeMeta(league).hiddenRooms || [])];
}

export function roomsForPage(page, league) {
  const rooms = PAGE_ROOMS[page] || [];
  if (!league) return rooms;
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
  const rooms = roomsForPage(page, league);
  if (rooms.includes(room)) return room;
  const fallback = rooms[0];
  return fallback || room || "";
}

export function roomLabelFor(page, room, league) {
  if (leagueTypeId(league) === "redraft" && page === "teams" && room === "call") {
    return "In it or out";
  }
  return ROOM_LABELS[page]?.[room] || room || "";
}

export function roomHintFor(page, room, league) {
  if (leagueTypeId(league) === "redraft") {
    if (page === "league" && room === "power") {
      return "This-year roster board. Prices are still dynasty for now";
    }
    if (page === "teams" && room === "call") {
      return "Playoff push, bubble, or out";
    }
    if (page === "teams" && room === "roster") {
      return "Sit/start this week and scout card";
    }
  }
  return ROOM_HINTS[page]?.[room] || "";
}

export function roomDescriptionFor(page, room, league) {
  if (leagueTypeId(league) === "redraft" && page === "teams" && room === "call") {
    return "Desk call for this roster: push for the playoffs, sit on the bubble, or you are out. Built from playoff odds and this year's lineup.";
  }
  return "";
}

export function pageHintForLeague(page, league) {
  if (page === "teams" && leagueTypeId(league) === "redraft") {
    return "Roster, in it or out";
  }
  return PAGE_HINTS[page] || "";
}

export function marketCaveat(league) {
  const type = leagueTypeId(league);
  if (type === "redraft") {
    return "This is a redraft league. Prices are still the dynasty market, so youth looks rich. Scores, standings, and odds are this season.";
  }
  if (type === "keeper") {
    return "Keeper league. Prices are the dynasty market; dumped names may not match this year's board.";
  }
  return "";
}
