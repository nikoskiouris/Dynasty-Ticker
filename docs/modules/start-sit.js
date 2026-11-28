import { chooseBestLineup } from "./lineup.js";
import { weeklyPlayer, weeklyScoring, weeklyUnavailable } from "./weekly-slate.js";

const NON_STARTERS = new Set(["BN", "BENCH", "IR", "TAXI", "RES", "RESERVE", "PUP", "NA", "INJURED_RESERVE"]);
const playerId = (value) => value && String(value) !== "0" ? String(value) : null;

function projectedWorkload(stats) {
  const measures = [["pass_att", "pass att."], ["rush_att", "carries"], ["rec_tgt", "targets"]];
  return measures
    .filter(([key]) => Number.isFinite(stats?.[key]) && stats[key] >= 0.05)
    .map(([key, label]) => `${stats[key].toFixed(1)} ${label}`);
}

function rosterPlayer(id, directory, slate, reserve, owned, scoring, now) {
  const bio = directory?.[id];
  const row = weeklyPlayer(slate, id, bio);
  const kickoff = Date.parse(row.kickoff);
  const locked = row.locked || kickoff <= now;
  const kickoffKnown = Number.isFinite(kickoff) || row.availability === "bye" || (!row.team && row.availability === "inactive");
  const unowned = !owned.has(id);
  const reason = locked ? "Game has started" : unowned ? "No longer eligible on this roster"
    : reserve.get(id) || weeklyUnavailable(row, now);
  const projection = scoring.project(row);
  const name = row?.name || bio?.full_name || [bio?.first_name, bio?.last_name].filter(Boolean).join(" ") || `Player ${id}`;
  const positions = row.positions?.length ? row.positions : bio?.fantasy_positions || [];
  const unknown = row.availability === "unknown" || (!reason && !Number.isFinite(projection)) || !kickoffKnown;
  return {
    id, name, positions: positions.length ? positions : [row?.position || bio?.position].filter(Boolean),
    position: row.position || bio?.position, team: row.team, opponent: row.opponent, away: row.away,
    kickoff: row.kickoff, status: row.status, availability: row.availability, workload: projectedWorkload(row.stats),
    points: projection, locked, unknown, unowned, kickoffKnown,
    reserve: reserve.has(id), reason: reason || (unknown ? "Weekly data unavailable" : null),
  };
}

// A player eligible for several slots can keep their Sleeper slot when the
// same projected lineup fits. Only displace a teammate to seat a new starter.
function seatSelected(open, selected, canFill) {
  const byId = new Map(selected.map(player => [player.id, player]));
  const seated = open.map(({ current, slot }) => byId.has(current?.id) && canFill(current, slot) ? current : null);
  const incumbents = new Set(seated.filter(Boolean).map(player => player.id));
  function place(entrant) {
    // Follow the shortest chain to an empty seat. This avoids asking a manager
    // to swap two RB slots when the new starter can go directly into Flex.
    const queue = [{ player: entrant, from: -1 }];
    const parent = new Map();
    for (const { player, from } of queue) {
      for (let index = 0; index < open.length; index++) {
        if (parent.has(index) || !canFill(player, open[index].slot)) continue;
        parent.set(index, from);
        if (seated[index]) {
          queue.push({ player: seated[index], from: index });
          continue;
        }
        for (let to = index; to >= 0; to = parent.get(to)) {
          const previous = parent.get(to);
          seated[to] = previous < 0 ? entrant : seated[previous];
        }
        return;
      }
    }
  }
  for (const player of selected) {
    if (!incumbents.has(player.id)) place(player);
  }
  return seated;
}

function weekLineup({ league, roster, players, slate, scoring, now, canFill }) {
  if (!Array.isArray(league.roster_positions) || !Array.isArray(roster?.starters) || !Array.isArray(roster.players)) return null;
  const slots = league.roster_positions.filter(slot => !NON_STARTERS.has(slot));
  const starters = roster.starters.map(playerId);
  const currentIds = new Set(starters.filter(Boolean));
  if (!slots.length || slots.length !== starters.length || starters.filter(Boolean).length !== currentIds.size) return null;

  const reserve = new Map();
  for (const id of roster.reserve || []) reserve.set(String(id), "On injured reserve");
  for (const id of roster.taxi || []) reserve.set(String(id), "On the taxi squad");
  const owned = new Set(roster.players.map(playerId).filter(Boolean));
  // A started game can put an already-traded player in the weekly matchup
  // after they leave the roster. Keep their submitted points in their slot.
  const ids = new Set([...owned, ...currentIds]);
  const pool = [...ids].map(id => rosterPlayer(id, players, slate, reserve, owned, scoring, now));
  const byId = new Map(pool.map(player => [player.id, player]));
  const seats = slots.map((slot, index) => {
    const current = byId.get(starters[index]);
    // An unverified kickoff, projection, or eligibility cannot justify benching an incumbent.
    const hold = current && (current.locked || (current.unowned
      ? !current.kickoffKnown
      : current.unknown || !canFill(current, slot)));
    return { slot, current, suggested: hold ? current : null, hold };
  });
  const held = new Set(seats.filter(seat => seat.hold).map(seat => seat.current.id));
  const eligible = pool.filter(player => !held.has(player.id) && !player.reason && !player.locked && Number.isFinite(player.points));
  const open = seats.filter(seat => !seat.hold);
  // Optimize in order: fill legal seats, maximize projected points, keep incumbents.
  // Integer hundredths avoid breaking actual ties on floating-point rounding.
  const hundredths = player => Math.round(player.points * 100);
  const slotBonus = 1 + eligible.reduce((sum, player) => sum + Math.abs(hundredths(player)), 0);
  const plan = chooseBestLineup(open, eligible, canFill, {
    valueFor: player => (slotBonus + hundredths(player)) * (open.length + 1) + Number(currentIds.has(player.id)),
  });
  if (!plan) return null;
  const selected = plan.picks.filter(index => index !== null).map(index => eligible[index]);
  const assignments = seatSelected(open, selected, canFill);
  open.forEach((seat, index) => { seat.suggested = assignments[index]; });
  return { seats, pool };
}

// A Flex relocation changes two slot rows but contributes no additional points.
// Cancel retained players first so a locked or unpriced starter cannot distort
// the swing. Confirmed byes and outs contribute zero when they leave the lineup.
function projectedLineupGain(seats, submitted, projected) {
  let gain = 0;
  for (const { current, suggested } of seats) {
    if (suggested && !submitted.has(suggested.id)) gain += suggested.points;
    if (!current || projected.has(current.id)) continue;
    if (current.availability === "bye" || current.availability === "out") continue;
    if (current.reason || !Number.isFinite(current.points)) return null;
    gain -= current.points;
  }
  return Math.round(gain * 100) / 100;
}

export function buildStartSitModel({ league, roster, players, slate, canFill, now = Date.now() }) {
  if (slate?.offSeason) return { message: "Weekly recommendations return during the NFL regular season." };
  if (!slate?.week || !slate.season) return { message: "Weekly projections are unavailable." };
  if (String(league.season) !== String(slate.season)) return { message: `Open your ${slate.season} league to see this week’s lineup.` };
  if (["pre_draft", "drafting", "complete"].includes(league.status)) return { message: "Weekly recommendations are available while this league’s season is active." };
  if (Number(league.settings?.best_ball) === 1) return { message: "Sleeper selects starters automatically in this best ball league." };
  const scoring = weeklyScoring(league);
  const model = weekLineup({ league, roster, players, slate, scoring, canFill, now });
  if (!model) return { message: "A weekly lineup could not be matched to this roster’s starting slots." };

  const { pool, seats } = model;
  const submitted = new Set(seats.map(seat => seat.current?.id).filter(Boolean));
  const projected = new Set(seats.map(seat => seat.suggested?.id).filter(Boolean));
  const changes = seats.filter(seat => seat.suggested && seat.suggested.id !== seat.current?.id);
  const review = seats.filter(seat => !seat.suggested || (seat.hold && !seat.current.locked));
  const unknownBench = pool.filter(player => player.unknown && !submitted.has(player.id) && !player.locked && !player.reserve
    && (!player.positions.length || seats.some(seat => canFill(player, seat.slot))));
  const bench = pool.filter(player => !projected.has(player.id)).sort((a, b) =>
    Number(Boolean(a.reason)) - Number(Boolean(b.reason)) || (b.points ?? -Infinity) - (a.points ?? -Infinity) || a.name.localeCompare(b.name)
  );
  const availableBench = bench.filter(player => !player.reason);
  const closeCalls = [];
  for (const seat of seats) {
    seat.alternatives = seat.hold ? [] : availableBench.filter(player => canFill(player, seat.slot));
    const backup = seat.alternatives[0];
    if (!backup || !seat.suggested) continue;
    const gap = Math.round((seat.suggested.points - backup.points) * 100) / 100;
    if (gap >= 0 && gap <= 2) closeCalls.push({ seat, bench: backup, gap });
  }
  closeCalls.sort((a, b) => a.gap - b.gap);
  return {
    seats, changes, review, unknownBench, bench, closeCalls, scoring,
    projectedGain: projectedLineupGain(seats, submitted, projected),
  };
}
