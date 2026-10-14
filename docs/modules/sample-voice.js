// Sample league (?sample=1) is someone else's team. Roster copy stays third person.

export function ownerPossessive(name) {
  const clean = String(name || "").trim();
  if (!clean) return "";
  return /s$/i.test(clean) ? `${clean}'` : `${clean}'s`;
}

export function sampleRosterLabels({ viewingSample = false, ownerName = "" } = {}) {
  if (!viewingSample) return null;
  const name = String(ownerName || "").trim();
  const poss = name ? ownerPossessive(name) : "this team's";
  const who = name || "This team";
  return {
    roster: name ? `${poss} roster` : "This team's roster",
    shopOption: name ? `Shop a player or pick ${name} owns` : "Shop a player or pick this team owns",
    oneOfMine: name ? `One of ${poss}` : "One of theirs",
    youGive: who,
    heatOnRoster: `is on ${poss} roster`,
    teamTab: who,
    mineLabel: who,
    shopPick: `Pick one player or pick from ${poss} roster. The app will shop it around the league.`,
    shopChoose: `Choose one of ${poss} players or picks to shop.`,
    draftSearchLeft: `${poss} players and picks`,
    favor: poss,
    strengthens: `This trade strengthens ${poss} starting lineup while making the other side weaker or thinner.`,
    tradeFile: `${poss} trade file`,
    teamOutlined: `${poss} team is outlined. Tap a team for the rank, the tank or contend call, and the lineup.`,
    giveLabel: name ? `${name} gives` : "This team gives",
    getLabel: "They get",
    giveGetHeading: name ? `${name} gives / They get` : "This team gives / They get",
  };
}
