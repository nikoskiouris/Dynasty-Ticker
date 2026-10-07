const PLAYER_FIELDS = [
  "first_name",
  "last_name",
  "full_name",
  "position",
  "team",
  "age",
  "status",
  "active",
  "injury_status",
  "years_exp",
  "depth_chart_order",
  "depth_chart_position",
];

export function playerDisplayName(raw) {
  if (!raw || typeof raw !== "object") return "";
  const full = String(raw.full_name || "").trim();
  if (full) return full;
  return `${raw.first_name || ""} ${raw.last_name || ""}`.trim();
}

export function trimPlayerRecord(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = playerDisplayName(raw);
  if (!name) return null;
  const row = {};
  PLAYER_FIELDS.forEach((key) => {
    if (raw[key] != null && raw[key] !== "") row[key] = raw[key];
  });
  row.full_name = name;
  const positions = Array.isArray(raw.fantasy_positions)
    ? raw.fantasy_positions.map((position) => String(position || "").trim()).filter(Boolean).slice(0, 3)
    : [];
  if (positions.length) row.fantasy_positions = positions;
  const rookieYear = raw.metadata?.rookie_year;
  if (rookieYear != null && rookieYear !== "") row.metadata = { rookie_year: rookieYear };
  return row;
}

export function trimPlayersDirectory(players) {
  const out = {};
  let named = 0;
  let dropped = 0;
  Object.entries(players || {}).forEach(([id, raw]) => {
    const row = trimPlayerRecord(raw);
    if (!row) {
      dropped += 1;
      return;
    }
    out[id] = row;
    named += 1;
  });
  return { players: out, named, dropped };
}

export function playersFromCache(cached, { stateKey = "", now = Date.now(), ttl = 0 } = {}) {
  if (!cached?.players || typeof cached.players !== "object") return null;
  if (!Object.keys(cached.players).length) return null;
  const freshKey = Boolean(stateKey) && cached.stateKey === stateKey;
  const age = now - Number(cached.savedAt);
  const freshTime = Number.isFinite(Number(cached.savedAt)) && age >= 0 && age < ttl;
  if (freshKey || freshTime) return cached.players;
  return null;
}

export function playersFallback(cached) {
  if (!cached?.players || typeof cached.players !== "object") return null;
  if (!Object.keys(cached.players).length) return null;
  return cached.players;
}
