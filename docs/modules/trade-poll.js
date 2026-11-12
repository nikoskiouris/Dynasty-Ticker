import { decodeTradeShare, encodeShareAsset } from "./trade-share.js";

// Crowd call on a trade: people drag one slider to say who the trade favors.
// This is opinion, not price. It never feeds player_values.json or the
// market verdict (AGENTS.md: one price; evidence is not proof).
//
// Stops run -4..4. Negative favors Team 1, the team that sends the Give side
// and receives the Get side (the person who built or shared the trade).
// Positive favors Team 2. Labels follow the owner's sketch, outside in:
// Veto, Clear winner, Unfair but OK, Slight edge, Even.
export const POLL_PATH = "/api/trade-poll";
export const POLL_MAX_STOP = 4;
export const POLL_STOPS = Object.freeze([-4, -3, -2, -1, 0, 1, 2, 3, 4]);
export const POLL_MIN_VOTES = 5;
const MAGNITUDE = Object.freeze(["Even", "Slight edge", "Unfair but OK", "Clear winner", "Veto"]);
const VOTER_ID = /^[a-z0-9-]{16,64}$/;

export function isPollStop(value) {
  return Number.isInteger(value) && Math.abs(value) <= POLL_MAX_STOP;
}

export function stopMagnitudeLabel(stop) {
  return isPollStop(stop) ? MAGNITUDE[Math.abs(stop)] : "";
}

// "Clear winner · You", "Even". teams: { one, two } display names.
export function stopLine(stop, teams = {}) {
  if (!isPollStop(stop)) return "";
  if (stop === 0) return MAGNITUDE[0];
  const team = stop < 0 ? (teams.one || "Team 1") : (teams.two || "Team 2");
  return `${MAGNITUDE[Math.abs(stop)]} · ${team}`;
}

export function cleanVoterId(value) {
  const id = String(value ?? "").trim().toLowerCase();
  return VOTER_ID.test(id) ? id : "";
}

// Same assets and format = same poll, whatever order they were added in,
// whatever price date the link carries, and whichever side shared it.
// "Bijan for Nabers" and "Nabers for Bijan" are one poll, seen from the
// other chair: flip says the caller's Team 1 is the poll's Team 2.
export function pollKeyFromCode(code) {
  const decoded = decodeTradeShare(code);
  if (!decoded) return null;
  const side = (list) => list.map(encodeShareAsset).sort().join(".");
  const give = side(decoded.give);
  const get = side(decoded.get);
  if (!give || !get || give === get) return null;
  const flip = give > get;
  const fmt = decoded.format === "oneQb" ? "q" : "s";
  return { key: `${fmt}${flip ? get : give}~${flip ? give : get}`, flip };
}

export function isPollKey(key) {
  const text = String(key ?? "");
  if (!/^[sq][0-9a-z.~]+$/.test(text) || text.length > 220) return false;
  return Boolean(pollKeyFromCode(`1${text}`));
}

// A stop in the caller's chair <-> the poll's stored chair.
export function orientStop(stop, flip) {
  return flip && stop !== 0 ? -stop : stop;
}

// counts[i] is the number of votes at POLL_STOPS[i].
export function emptyCounts() {
  return POLL_STOPS.map(() => 0);
}

export function orientCounts(counts, flip) {
  const list = POLL_STOPS.map((_, i) => Math.max(0, Math.floor(Number(counts?.[i]) || 0)));
  return flip ? list.reverse() : list;
}

export function countsFromVotes(votes = {}) {
  const counts = emptyCounts();
  for (const stop of Object.values(votes || {})) {
    if (isPollStop(stop)) counts[stop + POLL_MAX_STOP] += 1;
  }
  return counts;
}

// The middle vote. With fewer than POLL_MIN_VOTES the crowd has no call yet:
// a couple of votes is not a consensus, and the panel says so.
export function pollSummary(counts) {
  const list = orientCounts(counts, false);
  const total = list.reduce((sum, n) => sum + n, 0);
  const teamOne = list.slice(0, POLL_MAX_STOP).reduce((sum, n) => sum + n, 0);
  const even = list[POLL_MAX_STOP];
  const teamTwo = total - teamOne - even;
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
  let median = null;
  if (total) {
    const mid = (total - 1) / 2;
    const at = (rank) => {
      let seen = 0;
      for (let i = 0; i < list.length; i += 1) {
        seen += list[i];
        if (rank < seen) return POLL_STOPS[i];
      }
      return 0;
    };
    // An even count with two middle votes takes the milder one. Middle votes
    // on opposite sides mean the crowd is split down the middle: Even.
    const low = at(Math.floor(mid));
    const high = at(Math.ceil(mid));
    if (Math.sign(low) * Math.sign(high) < 0) median = 0;
    else median = Math.abs(low) <= Math.abs(high) ? low : high;
  }
  return {
    total,
    counts: list,
    median,
    ready: total >= POLL_MIN_VOTES,
    split: { one: pct(teamOne), even: pct(even), two: pct(teamTwo) },
  };
}

export function pollGetUrl(code) {
  return `${POLL_PATH}?code=${encodeURIComponent(code)}`;
}
