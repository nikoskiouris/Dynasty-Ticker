// One projection and one label for every draft pick.
// Partial week rows are not a table. Callers pass settled: true only when
// the roster W-L table is complete, or the week loop has finished with no
// roster table. A lead cannot paint from a half-loaded season.

import { ordinal } from "./season.js";
import {
  buildCurrentPlaceLookup,
  formatPickSlotLabel,
  projectedDraftSlot,
  rosterPointsFor,
} from "./mock-drafts.js";
import { bucketForProjectedSlot, formatPickBucketLabel } from "./values.js";

// True when every roster already has Sleeper's cumulative wins, losses, and
// points, and at least one game is on the books. That table is enough to
// project slots. An all-zero preseason table is not.
export function rosterRecordsReady(rosters) {
  const rows = Array.isArray(rosters) ? rosters : [];
  if (!rows.length) return false;
  let decided = 0;
  for (const roster of rows) {
    const settings = roster?.settings;
    if (!settings || settings.fpts == null) return false;
    const wins = Number(settings.wins);
    const losses = Number(settings.losses);
    const ties = Number(settings.ties) || 0;
    const points = rosterPointsFor(roster);
    if (!Number.isFinite(wins) || !Number.isFinite(losses) || !Number.isFinite(points)) return false;
    decided += wins + losses + ties;
  }
  return decided > 0;
}

// league is the Sleeper league. standings.settled is false until the table
// is final. Returns null until then, otherwise a Map of roster id to
// { rank, total, placeLabel, slot, bucket }.
export function projectPickSlots(league, standings) {
  if (!standings || standings.settled !== true) return null;
  const rosters = Array.isArray(standings.rosters) ? standings.rosters : [];
  const rows = Array.isArray(standings.rows) ? standings.rows : [];
  const lookup = buildCurrentPlaceLookup(rosters, rows, standings.strengthByRosterId || null);
  const declared = Number(league?.total_rosters);
  const slots = new Map();
  lookup.byRosterId.forEach((place, rosterId) => {
    const total = place.total || (Number.isFinite(declared) && declared > 0 ? declared : 0);
    const slot = projectedDraftSlot(place.rank, total);
    slots.set(String(rosterId), {
      rosterId: String(rosterId),
      rank: place.rank,
      total,
      placeLabel: place.label,
      slot,
      bucket: bucketForProjectedSlot(slot, total),
    });
  });
  return slots;
}

// Snapshots that are not settled contribute nothing. The returned list is the
// leads that actually published, in order.
export function collectProjectedLeads(league, snapshots, toLead) {
  const leads = [];
  (Array.isArray(snapshots) ? snapshots : []).forEach((standings) => {
    const slots = projectPickSlots(league, standings);
    if (!slots) return;
    const lead = typeof toLead === "function" ? toLead(slots) : null;
    if (lead == null || lead === "") return;
    leads.push(lead);
  });
  return leads;
}

// The season after the league's current season is the only year we project.
export function nextDraftSeason(leagueSeason) {
  const season = Number(leagueSeason);
  return Number.isFinite(season) && season > 0 ? season + 1 : 0;
}

const GENERIC_PICK_TAIL = /^(any|early|mid|middle|late)$/i;

// Named 2028+ 1sts share one price: the mid 1st. Generic catalog rows
// already say Early, Mid, or Late in the name.
export function valuedAsMidFirstHint(asset, leagueSeason) {
  if (!asset || asset.assetType !== "pick") return "";
  const season = Number(asset.raw?.season ?? asset.season);
  const round = Number(asset.raw?.round ?? asset.round);
  const next = nextDraftSeason(leagueSeason);
  if (round !== 1 || !(next > 0 && Number.isFinite(season) && season > next)) return "";
  const parts = String(asset.assetId || "").split(":");
  const tail = parts.length > 1 ? parts[parts.length - 1] : "";
  if (GENERIC_PICK_TAIL.test(tail)) return "";
  const owner = asset.raw?.original_owner ?? asset.raw?.roster_id ?? asset.original_owner;
  const named = (owner != null && String(owner) !== "" && String(owner) !== "any")
    || (tail && !GENERIC_PICK_TAIL.test(tail) && !/^r\d+$/i.test(tail));
  if (!named) return "";
  return "valued as a mid 1st";
}

// Next year keeps a slot and a finish. Later years are the mid 1st (or that
// round's single price) with no slot and no finish claim. An assigned slot
// is a known pick, not a projection.
export function resolvePickProjection({
  season,
  round = 1,
  leagueSeason,
  place = null,
  assignedSlot = null,
  assignedTotal = null,
} = {}) {
  const year = Number(season);
  const nextYear = nextDraftSeason(leagueSeason);
  const rnd = Number(round) || 1;
  const later = nextYear > 0 && Number.isFinite(year) && year > nextYear;
  if (later) {
    return {
      project: false,
      slot: null,
      rank: null,
      total: null,
      valueBucket: rnd === 1 ? "mid" : "any",
      nameBucket: "any",
    };
  }

  const knownSlot = Number(assignedSlot);
  const hasAssigned = Number.isFinite(knownSlot) && knownSlot > 0;
  const project = !hasAssigned && year === nextYear;
  const teams = Number(hasAssigned ? assignedTotal : place?.total);
  const slot = hasAssigned
    ? knownSlot
    : (project ? projectedDraftSlot(place?.rank, teams) : null);
  const valueBucket = rnd === 1
    ? (slot ? bucketForProjectedSlot(slot, teams) : "any")
    : "any";
  return {
    project,
    slot: slot || null,
    rank: project ? place?.rank ?? null : null,
    total: project ? teams || null : null,
    valueBucket,
    nameBucket: project ? "any" : valueBucket,
  };
}

// "2027 1st (1.04), projected to finish 9th of 12 from YianGhan"
// A later year with no slot: "2028 1st from YianGhan".
// A mock prospect name is not part of the sentence.
export function formatPickLabel(pick = {}) {
  const season = String(pick.season ?? "").trim();
  const round = Number(pick.round) || 1;
  const ownerName = String(pick.ownerName || "").trim();
  const slot = Number(pick.slot);
  const hasSlot = Number.isFinite(slot) && slot > 0;
  const rank = Number(pick.rank);
  const total = Number(pick.total);
  const hasPlace = Number.isFinite(rank) && Number.isFinite(total) && rank >= 1 && total >= 1;

  const tier = formatPickBucketLabel(pick.bucket);
  const head = [season, tier, ordinal(round)].filter(Boolean).join(" ");
  const slotBit = hasSlot ? ` (${formatPickSlotLabel(round, slot)})` : "";
  const basis = hasPlace ? `, projected to finish ${ordinal(rank)} of ${total}` : "";
  const whose = ownerName ? ` from ${ownerName}` : "";
  return `${head}${slotBit}${basis}${whose}`;
}

export function formatProjectedFirstLabel({
  season,
  round = 1,
  bucket,
  ownerName = "",
  rank = null,
  total = null,
  slot = null,
} = {}) {
  const placeRank = Number(rank);
  const teamCount = Number(total);
  const derived = Number.isFinite(placeRank) && Number.isFinite(teamCount)
    ? projectedDraftSlot(placeRank, teamCount)
    : null;
  return formatPickLabel({
    season,
    round,
    bucket,
    ownerName,
    rank,
    total,
    slot: Number(slot) > 0 ? slot : derived,
  });
}

function slotRank(row) {
  const slot = Number(row?.slot ?? row?.projectedDraftSlot);
  return Number.isFinite(slot) && slot > 0 ? slot : Number.POSITIVE_INFINITY;
}

// Trade search: higher price first. A tie keeps the earlier slot.
export function compareTradeSearchPicks(a, b) {
  const valueDiff = Number(b?.value) - Number(a?.value);
  if (Number.isFinite(valueDiff) && valueDiff !== 0) return valueDiff;
  const slotDiff = slotRank(a) - slotRank(b);
  if (slotDiff) return slotDiff;
  const roundDiff = (Number(a?.round) || 99) - (Number(b?.round) || 99);
  if (roundDiff) return roundDiff;
  return String(a?.name || "").localeCompare(String(b?.name || ""));
}
