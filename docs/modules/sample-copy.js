// Sample league is someone else's team. These lines stay third person.

export function ownerPossessive(name) {
  const clean = String(name || "").trim();
  if (!clean) return "";
  return /s$/i.test(clean) ? `${clean}'` : `${clean}'s`;
}

export function sampleRosterCopy({ viewingSample = false, ownerName = "" } = {}) {
  if (!viewingSample) return null;
  const name = String(ownerName || "").trim();
  const poss = name ? ownerPossessive(name) : "this team's";
  const roster = `${poss} roster`;
  return {
    shopOption: name ? `Shop a player or pick ${name} owns` : "Shop a player or pick this team owns",
    heatOnRoster: `is on ${roster}`,
    searchEmpty: `No matching assets found on ${roster}.`,
    alreadyOnRoster: `He is already on ${roster}.`,
    alreadyPick: `This pick is already on ${roster}.`,
    agingStars: `Do not sell ${poss} aging stars for picks.`,
  };
}
