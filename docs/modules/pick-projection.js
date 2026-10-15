// One projection and one label for every draft pick.
// Partial week rows are not a table. Callers pass settled: true only after
// the matchup load finishes, so a lead cannot paint twice.

import { ordinal } from "./season.js";
import {
  buildCurrentPlaceLookup,
  formatHybridFirstName,
  formatPickSlotLabel,
  projectedDraftSlot,
} from "./mock-drafts.js";
import { bucketForProjectedSlot, formatPickBucketLabel } from "./values.js";

// league is the Sleeper league. standings.settled is false while week rows
// are still arriving. Returns null until then, otherwise a Map of roster id
// to { rank, total, placeLabel, slot, bucket }.
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

// One sentence for every round.
// "2029 Early 1st (1.01), projected to finish 12th of 12 from skolnickavery"
// A mock prospect keeps the slot in the same parentheses: "(1.04 Dante Moore)".
export function formatPickLabel(pick = {}) {
  const season = String(pick.season ?? "").trim();
  const round = Number(pick.round) || 1;
  const ownerName = String(pick.ownerName || "").trim();
  const mockName = String(pick.mockName || "").trim();
  const slot = Number(pick.slot);
  const hasSlot = Number.isFinite(slot) && slot > 0;
  const rank = Number(pick.rank);
  const total = Number(pick.total);
  const hasPlace = Number.isFinite(rank) && Number.isFinite(total) && rank >= 1 && total >= 1;

  if (mockName && hasSlot) {
    return formatHybridFirstName({
      season,
      round,
      ownerName,
      placeLabel: pick.placeLabel || (hasPlace ? ordinal(rank) : ""),
      mockName,
      mockSlot: slot,
    });
  }

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
