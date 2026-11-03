// "Try the sample league" borrows a real Sleeper league's structure (rosters,
// picks, standings) so the numbers are real, but every person in it is
// invented: no real usernames, team names, nicknames, or avatars.
export const SAMPLE_LEAGUE_NAME = "Sample Dynasty League";

export const SAMPLE_MANAGERS = Object.freeze([
  ["avery_r", "Avery's Aces"],
  ["blake_m", "Blake Field"],
  ["casey_l", "Casey's Comets"],
  ["devon_p", "Devon Drive"],
  ["emery_k", "Emery Express"],
  ["finley_t", "Finley Five"],
  ["harper_j", "Harper Hustle"],
  ["jordan_s", "Jordan Jets"],
  ["kendall_w", "Kendall Kings"],
  ["logan_b", "Logan Line"],
  ["morgan_c", "Morgan Motion"],
  ["parker_d", "Parker Pace"],
  ["quinn_h", "Quinn Quest"],
  ["riley_n", "Riley Rush"],
  ["sawyer_g", "Sawyer Storm"],
  ["taylor_v", "Taylor Tempo"],
  ["rowan_f", "Rowan Rise"],
  ["skyler_o", "Skyler Sky"],
  ["reese_a", "Reese Rally"],
  ["dakota_e", "Dakota Dash"],
]);

function hash(text) {
  let h = 2166136261;
  for (const ch of String(text)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

// Same user id, same invented name, in every season of the sample.
export function sampleManagerFor(userId, taken = new Set()) {
  const start = hash(userId) % SAMPLE_MANAGERS.length;
  for (let i = 0; i < SAMPLE_MANAGERS.length; i++) {
    const index = (start + i) % SAMPLE_MANAGERS.length;
    if (!taken.has(index)) {
      taken.add(index);
      return SAMPLE_MANAGERS[index];
    }
  }
  return [`manager_${start}`, `Team ${start}`];
}

export function inventSampleUsers(users) {
  const taken = new Set();
  const list = Array.isArray(users) ? users : [];
  const ordered = [...list].sort((a, b) => String(a?.user_id).localeCompare(String(b?.user_id)));
  const byId = new Map(ordered.map((user) => [String(user?.user_id), sampleManagerFor(user?.user_id, taken)]));
  return list.map((user) => {
    const [username, teamName] = byId.get(String(user?.user_id)) || ["manager", "Team"];
    return {
      user_id: user?.user_id,
      league_id: user?.league_id,
      is_owner: Boolean(user?.is_owner),
      display_name: username,
      username,
      avatar: null,
      metadata: { team_name: teamName },
    };
  });
}

export function inventSampleLeague(league) {
  if (!league || typeof league !== "object") return league;
  return { ...league, name: SAMPLE_LEAGUE_NAME, avatar: null };
}

// Rosters can carry a nickname or co-owner ids in metadata; keep only what the math needs.
export function inventSampleRosters(rosters) {
  return (Array.isArray(rosters) ? rosters : []).map((roster) => ({ ...roster, metadata: {} }));
}

export function inventSampleCore(core) {
  if (!core) return core;
  return {
    ...core,
    league: inventSampleLeague(core.league),
    users: inventSampleUsers(core.users),
    rosters: inventSampleRosters(core.rosters),
  };
}
