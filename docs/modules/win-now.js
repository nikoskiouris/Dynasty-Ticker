// Tickets 005 and 008: win-now targets inside this league.
//
// For a contender: proven, older players on teams whose own call is
// "Rebuild". Those owners gain little from a 30-year-old this year, so they
// are the ones to call. Players at your weak positions come first. A
// rebuilding team is told not to buy these. Prices are the listed prices.

export const WIN_NOW_MIN_VALUE = 2000;
export const WIN_NOW_LIMIT = 5;

// Age from which a player is a win-now piece rather than a future one.
const WIN_NOW_AGE = Object.freeze({ QB: 30, RB: 26, WR: 28, TE: 29 });

// teams: [{ rosterId, name, teamState, record }]
// players: [{ assetId, name, position, value, age, rosterId }] (all rosters)
// holes: [{ position, rankLabel }] my weaker groups, weakest first
export function buildWinNowTargets({
  teams = [],
  players = [],
  myRosterId = null,
  myTeamState = "middle",
  holes = [],
  limit = WIN_NOW_LIMIT,
} = {}) {
  if (myTeamState === "rebuilding") {
    return { hidden: true, reason: "You're rebuilding, so this list is off: older starters help a contender this year, not your window. Don't buy them.", targets: [] };
  }
  const sellers = new Map(teams
    .filter((team) => team?.teamState === "rebuilding" && String(team.rosterId) !== String(myRosterId ?? ""))
    .map((team) => [String(team.rosterId), team]));
  const holeAt = new Map(holes.map((hole, index) => [String(hole.position || "").toUpperCase(), { ...hole, order: index }]));
  const targets = [];
  for (const row of players) {
    const team = sellers.get(String(row?.rosterId));
    if (!team) continue;
    const position = String(row.position || "").toUpperCase();
    const age = Number(row.age);
    const value = Number(row.value) || 0;
    if (!WIN_NOW_AGE[position] || !Number.isFinite(age) || age < WIN_NOW_AGE[position] || value < WIN_NOW_MIN_VALUE) continue;
    const hole = holeAt.get(position);
    const rank = String(hole?.rankLabel || "").replace(" / ", " of ");
    targets.push({
      ...row,
      position,
      age,
      value,
      owner: team.name || "",
      ownerRecord: team.record || "",
      fills: hole ? `Your ${position} group ranks ${rank || "low"}` : "",
      why: `${team.name || "Their owner"} is rebuilding${team.record ? ` (${team.record})` : ""}. At ${age}, he helps a contender this year more than a rebuild later.`,
      holeOrder: hole ? hole.order : Infinity,
    });
  }
  targets.sort((a, b) => a.holeOrder - b.holeOrder || b.value - a.value || String(a.name).localeCompare(String(b.name)));
  return { hidden: false, reason: "", targets: targets.slice(0, limit) };
}
