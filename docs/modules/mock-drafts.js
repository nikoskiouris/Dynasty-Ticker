import { ordinal } from "./season.js";

export const MOCK_DRAFTS_PATH = "./data/nfl_mock_drafts.json";
export const SKILL_POSITIONS = new Set(["QB", "RB", "WR", "TE"]);
export const MOCK_OVERLAY_MAX_ROUND = 2;

export function emptyMockDrafts() {
  return {
    season: 0,
    rounds: MOCK_OVERLAY_MAX_ROUND,
    round: MOCK_OVERLAY_MAX_ROUND,
    completedNflDraftYear: 0,
    updated: "",
    mocks: [],
  };
}

export function parseMockDrafts(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const mocks = (Array.isArray(source.mocks) ? source.mocks : [])
    .map(normalizeMock)
    .filter((mock) => mock.picks.length > 0);
  const rounds = Number(source.rounds || source.round) || MOCK_OVERLAY_MAX_ROUND;
  return {
    season: Number(source.season) || 0,
    rounds,
    round: rounds,
    completedNflDraftYear: Number(source.completedNflDraftYear) || 0,
    updated: String(source.updated || "").trim(),
    mocks,
  };
}

export async function fetchMockDrafts(fetchImpl = globalThis.fetch) {
  try {
    const response = await fetchImpl(MOCK_DRAFTS_PATH, { cache: "no-store" });
    if (!response?.ok) return emptyMockDrafts();
    return parseMockDrafts(await response.json());
  } catch {
    return emptyMockDrafts();
  }
}

export function nextMockSeason(board) {
  const season = Number(board?.season);
  if (Number.isFinite(season) && season > 0) return season;
  const completed = Number(board?.completedNflDraftYear);
  if (Number.isFinite(completed) && completed > 0) return completed + 1;
  return 0;
}

export function shouldAttachMock(pick, board) {
  const season = Number(pick?.season);
  const round = Number(pick?.round);
  const mockSeason = nextMockSeason(board);
  return Number.isFinite(round)
    && round >= 1
    && round <= MOCK_OVERLAY_MAX_ROUND
    && Number.isFinite(season)
    && season === mockSeason
    && mockSeason > 0;
}

export function projectedDraftSlot(placeRank, teamCount) {
  const rank = Number(placeRank);
  const total = Number(teamCount);
  if (!Number.isFinite(rank) || !Number.isFinite(total) || rank < 1 || total < 1) return null;
  if (rank > total) return null;
  return total - rank + 1;
}

export function rosterPointsFor(roster) {
  const settings = roster?.settings || {};
  if (settings.fpts == null) return 0;
  return Number(settings.fpts || 0) + Number(settings.fpts_decimal || 0) / 100;
}

export function buildCurrentPlaceLookup(rosters = [], standings = []) {
  if (Array.isArray(standings) && standings.length) {
    const byRosterId = new Map();
    const total = standings.length;
    standings.forEach((team, index) => {
      const rank = Number(team?.rank) || index + 1;
      const rosterId = String(team?.rosterId ?? "");
      if (!rosterId) return;
      byRosterId.set(rosterId, {
        rank,
        total,
        label: ordinal(rank),
      });
    });
    return { byRosterId, total };
  }

  const ranked = [...(Array.isArray(rosters) ? rosters : [])]
    .map((roster) => ({
      rosterId: String(roster?.roster_id ?? ""),
      wins: Number(roster?.settings?.wins || 0),
      losses: Number(roster?.settings?.losses || 0),
      ties: Number(roster?.settings?.ties || 0),
      points: rosterPointsFor(roster),
    }))
    .filter((row) => row.rosterId)
    .sort((a, b) => b.wins - a.wins
      || a.losses - b.losses
      || b.ties - a.ties
      || b.points - a.points
      || a.rosterId.localeCompare(b.rosterId, undefined, { numeric: true }));

  const byRosterId = new Map();
  const total = ranked.length;
  ranked.forEach((row, index) => {
    const rank = index + 1;
    byRosterId.set(row.rosterId, { rank, total, label: ordinal(rank) });
  });
  return { byRosterId, total };
}

export function currentPlaceForOwner(originalOwner, placeLookup) {
  if (originalOwner == null) return null;
  return placeLookup?.byRosterId?.get(String(originalOwner)) || null;
}

export function normalizeProspectName(name) {
  return String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function mockProspectAtSlot(board, slot, round = 1) {
  const pickSlot = Number(slot);
  const pickRound = Number(round) || 1;
  if (!Number.isFinite(pickSlot) || pickSlot < 1) return null;
  if (!Number.isFinite(pickRound) || pickRound < 1 || pickRound > MOCK_OVERLAY_MAX_ROUND) return null;
  const rows = (Array.isArray(board?.mocks) ? board.mocks : [])
    .map((mock) => {
      const pick = (mock.picks || []).find((row) => (
        Number(row.slot) === pickSlot && Number(row.round || 1) === pickRound
      ));
      if (!pick?.name) return null;
      if (pick.pos && !SKILL_POSITIONS.has(String(pick.pos).toUpperCase())) return null;
      return {
        name: pick.name,
        pos: pick.pos || "",
        school: pick.school || "",
        date: String(mock.date || ""),
        source: mock.short || mock.source || "",
      };
    })
    .filter(Boolean);
  if (!rows.length) return null;

  const counts = new Map();
  rows.forEach((row) => {
    const key = normalizeProspectName(row.name);
    const current = counts.get(key) || { ...row, votes: 0 };
    current.votes += 1;
    if (String(row.date) > String(current.date)) {
      current.name = row.name;
      current.pos = row.pos;
      current.school = row.school;
      current.date = row.date;
      current.source = row.source;
    }
    counts.set(key, current);
  });

  const ranked = [...counts.values()].sort((a, b) => b.votes - a.votes
    || String(b.date).localeCompare(String(a.date))
    || a.name.localeCompare(b.name));
  const top = ranked[0];
  const tied = ranked.filter((row) => row.votes === top.votes);
  if (tied.length === 1) {
    return { name: top.name, pos: top.pos, school: top.school, split: false, label: top.name };
  }

  const newest = tied.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  const splitLabel = tied
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((row) => row.name)
    .slice(0, 2)
    .join(" / ");
  return {
    name: newest.name,
    pos: newest.pos,
    school: newest.school,
    split: true,
    label: splitLabel,
  };
}

export function formatHybridFirstName({ season, round = 1, ownerName, placeLabel, mockName } = {}) {
  const year = String(season || "").trim();
  if (!year) return "";
  const roundLabel = ordinal(Number(round) || 1);
  const whose = String(ownerName || "").trim() ? ` from ${String(ownerName).trim()}` : "";
  const place = String(placeLabel || "").trim() ? ` · ${String(placeLabel).trim()}` : "";
  const mock = String(mockName || "").trim() ? ` (${String(mockName).trim()})` : "";
  return `${year} ${roundLabel}${whose}${place}${mock}`;
}

export function formatMockSourceLine(board) {
  const mocks = Array.isArray(board?.mocks) ? board.mocks : [];
  const shorts = [...new Set(mocks.map((mock) => mock.short || mock.source).filter(Boolean))];
  const season = nextMockSeason(board) || "Next";
  const sources = shorts.length ? shorts.join(" + ") : "Dynasty Nerds";
  return `${season} 1sts and 2nds show who ${sources} mock at that slot from current place. 3rds stay pick labels. College names have no trade value.`;
}

export function primaryMock(board) {
  return (Array.isArray(board?.mocks) ? board.mocks : []).find((mock) => mock?.picks?.length) || null;
}

export function formatPickSlotLabel(round, slot) {
  const rnd = Number(round);
  const n = Number(slot);
  if (!Number.isFinite(rnd) || !Number.isFinite(n) || rnd < 1 || n < 1) return "";
  return `${rnd}.${String(n).padStart(2, "0")}`;
}

export function formatMockDate(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return text;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function buildMockBoardModel(board, { mySlot = null } = {}) {
  const mock = primaryMock(board);
  const season = nextMockSeason(board);
  const slot = Number(mySlot);
  const mine = Number.isFinite(slot) && slot > 0 ? slot : null;
  const picks = Array.isArray(mock?.picks) ? mock.picks : [];
  const rounds = [1, 2].map((round) => ({
    round,
    label: `Round ${round}`,
    picks: picks
      .filter((pick) => Number(pick.round) === round)
      .map((pick) => ({
        round: pick.round,
        slot: pick.slot,
        name: pick.name,
        pos: pick.pos,
        school: pick.school,
        pickLabel: formatPickSlotLabel(pick.round, pick.slot),
        mine: mine === Number(pick.slot),
        id: mockPickDomId(pick.round, pick.slot),
      })),
  }));
  return {
    season,
    source: mock?.source || mock?.short || "Dynasty Nerds",
    author: mock?.author || "",
    date: mock?.date || board?.updated || "",
    dateLabel: formatMockDate(mock?.date || board?.updated || ""),
    url: mock?.url || "",
    format: mock?.format || "superflex",
    rounds,
    empty: !picks.length,
  };
}

export function mockPickDomId(round, slot) {
  const label = formatPickSlotLabel(round, slot);
  return label ? `mock-pick-${label.replace(".", "-")}` : "";
}

export function mockPickTarget(asset) {
  const name = String(asset?.raw?.mockProspectName || "").trim();
  const round = Number(asset?.raw?.round);
  const slot = Number(asset?.raw?.projectedDraftSlot);
  if (!name) return null;
  if (!Number.isFinite(round) || round < 1 || round > MOCK_OVERLAY_MAX_ROUND) return null;
  if (!Number.isFinite(slot) || slot < 1) return null;
  return { round, slot, name };
}

export function pickHasMockOverlay(asset) {
  return Boolean(mockPickTarget(asset) || String(asset?.raw?.mockProspectName || "").trim());
}

function normalizeMock(mock) {
  const picks = (Array.isArray(mock?.picks) ? mock.picks : [])
    .map((pick) => ({
      round: Number(pick?.round) > 0 ? Number(pick.round) : 1,
      slot: Number(pick?.slot),
      name: String(pick?.name || "").trim(),
      pos: String(pick?.pos || "").trim().toUpperCase(),
      school: String(pick?.school || "").trim(),
    }))
    .filter((pick) => (
      Number.isFinite(pick.slot)
      && pick.slot > 0
      && pick.round >= 1
      && pick.round <= MOCK_OVERLAY_MAX_ROUND
      && pick.name
      && SKILL_POSITIONS.has(pick.pos)
    ))
    .sort((a, b) => a.round - b.round || a.slot - b.slot);
  return {
    id: String(mock?.id || "").trim(),
    source: String(mock?.source || "").trim(),
    short: String(mock?.short || mock?.source || "").trim(),
    author: String(mock?.author || "").trim(),
    date: String(mock?.date || "").trim(),
    url: String(mock?.url || "").trim(),
    format: String(mock?.format || "superflex").trim(),
    picks,
  };
}
