// Exact starter assignment shared by the dynasty lineup and sit/start.
//
// Players who fit exactly the same slots are interchangeable, so a best lineup only
// ever starts the top few of each such group. The search state is "how many of each
// group are in", not "which players are in", so it stays a few thousand states for a
// real roster instead of doubling with every extra candidate.
//
// Pass candidates best-first. Then picks match a plain search over every player:
// the earlier candidate wins ties, and a slot stays empty only when that scores higher.
// Returns null when the search would pass `stateLimit`; callers fall back to greedy.

export const LINEUP_STATE_LIMIT = 200000;

const STATE_LIMIT_HIT = Symbol("lineup-state-limit");

function candidateValue(candidate) {
  return candidate.value;
}

export function chooseBestLineup(slotEntries, candidates, canFill, {
  valueFor = candidateValue,
  stateLimit = LINEUP_STATE_LIMIT,
} = {}) {
  const slots = slotEntries.length;
  if (slots === 0) return { score: 0, picks: [] };

  const groupsByFit = new Map();
  candidates.forEach((candidate, index) => {
    const value = Number(valueFor(candidate));
    // The plain search never starts NaN or -Infinity, so they cannot block a group.
    if (!(value > Number.NEGATIVE_INFINITY)) return;
    const fits = [];
    for (let slotIndex = 0; slotIndex < slots; slotIndex += 1) {
      if (canFill(candidate, slotEntries[slotIndex].slot)) fits.push(slotIndex);
    }
    if (fits.length === 0) return;
    const key = fits.join(",");
    let group = groupsByFit.get(key);
    if (!group) {
      group = { fits, members: [], cap: 0, radix: 1, stride: 1 };
      groupsByFit.set(key, group);
    }
    group.members.push({ index, value });
  });

  const groups = [...groupsByFit.values()];
  const slotGroups = Array.from({ length: slots }, () => []);
  let stateSpace = 1;
  groups.forEach((group, groupIndex) => {
    group.members.sort((left, right) => right.value - left.value || left.index - right.index);
    group.cap = Math.min(group.members.length, group.fits.length);
    group.radix = group.cap + 1;
    group.stride = stateSpace;
    stateSpace *= group.radix;
    group.fits.forEach((slotIndex) => slotGroups[slotIndex].push(groupIndex));
  });
  if (!Number.isSafeInteger(stateSpace)) return null;

  const scores = Array.from({ length: slots }, () => new Map());
  const choices = Array.from({ length: slots }, () => new Map());
  let visited = 0;

  const solve = (slotIndex, code) => {
    if (slotIndex >= slots) return 0;
    const cached = scores[slotIndex].get(code);
    if (cached !== undefined) return cached;
    visited += 1;
    if (visited > stateLimit) throw STATE_LIMIT_HIT;

    let best = Number.NEGATIVE_INFINITY;
    let bestGroup = -1;
    let bestIndex = Number.POSITIVE_INFINITY;
    const options = slotGroups[slotIndex];
    for (let option = 0; option < options.length; option += 1) {
      const group = groups[options[option]];
      const used = Math.floor(code / group.stride) % group.radix;
      if (used >= group.cap) continue;
      const member = group.members[used];
      const total = member.value + solve(slotIndex + 1, code + group.stride);
      if (total > best || (total === best && member.index < bestIndex)) {
        best = total;
        bestGroup = options[option];
        bestIndex = member.index;
      }
    }

    const skip = solve(slotIndex + 1, code);
    if (skip > best) {
      best = skip;
      bestGroup = -1;
    }

    scores[slotIndex].set(code, best);
    choices[slotIndex].set(code, bestGroup);
    return best;
  };

  let score;
  try {
    score = solve(0, 0);
  } catch (err) {
    if (err === STATE_LIMIT_HIT) return null;
    throw err;
  }

  const picks = [];
  let code = 0;
  for (let slotIndex = 0; slotIndex < slots; slotIndex += 1) {
    const groupIndex = choices[slotIndex].get(code);
    if (groupIndex == null || groupIndex < 0) {
      picks.push(null);
      continue;
    }
    const group = groups[groupIndex];
    const used = Math.floor(code / group.stride) % group.radix;
    picks.push(group.members[used].index);
    code += group.stride;
  }
  return { score, picks };
}
