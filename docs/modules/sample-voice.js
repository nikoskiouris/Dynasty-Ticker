// Sample league (?sample=1) is someone else's team. Roster copy stays third person.
export function sampleRosterLabels({ viewingSample = false, ownerName = "" } = {}) {
  if (!viewingSample) return null;
  const name = String(ownerName || "").trim();
  return {
    roster: name ? `${name}'s roster` : "This team's roster",
    shopOption: name ? `Shop a player or pick ${name} owns` : "Shop a player or pick this team owns",
    oneOfMine: name ? `One of ${name}'s` : "One of theirs",
    youGive: name || "This team",
    heatOnRoster: name ? `is on ${name}'s roster` : "is on this team's roster",
    teamTab: name || "This team",
  };
}
