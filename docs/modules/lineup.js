// Exact starter assignment. Same picks as the old recursive search:
// earlier candidate index wins ties, and an empty slot is used only when it scores higher.

const EXACT_LINEUP_CANDIDATE_CAP = 20;

export function chooseBestLineup(slotEntries, candidates, canFill) {
  const slots = slotEntries.length;
  const count = candidates.length;
  if (slots === 0) return { score: 0, picks: [] };
  if (count > EXACT_LINEUP_CANDIDATE_CAP) {
    throw new Error(`Exact lineup solver supports at most ${EXACT_LINEUP_CANDIDATE_CAP} candidates.`);
  }

  const stateCount = 1 << count;
  const eligible = slotEntries.map((entry) => {
    const list = [];
    for (let index = 0; index < count; index += 1) {
      if (canFill(candidates[index], entry.slot)) list.push(index);
    }
    return list;
  });
  const scores = new Float64Array(slots * stateCount);
  const picksByState = new Int16Array(slots * stateCount);
  scores.fill(Number.NaN);

  const solve = (slotIndex, mask) => {
    if (slotIndex >= slots) return 0;
    const key = slotIndex * stateCount + mask;
    const cached = scores[key];
    if (!Number.isNaN(cached)) return cached;

    let bestScore = Number.NEGATIVE_INFINITY;
    let bestPick = -1;
    const options = eligible[slotIndex];
    for (let option = 0; option < options.length; option += 1) {
      const candidateIndex = options[option];
      const bit = 1 << candidateIndex;
      if (mask & bit) continue;
      const total = candidates[candidateIndex].value + solve(slotIndex + 1, mask | bit);
      if (total > bestScore) {
        bestScore = total;
        bestPick = candidateIndex;
      }
    }

    const skipScore = solve(slotIndex + 1, mask);
    if (skipScore > bestScore) {
      bestScore = skipScore;
      bestPick = -1;
    }

    scores[key] = bestScore;
    picksByState[key] = bestPick;
    return bestScore;
  };

  const score = solve(0, 0);
  const picks = [];
  let mask = 0;
  for (let slotIndex = 0; slotIndex < slots; slotIndex += 1) {
    const pick = picksByState[slotIndex * stateCount + mask];
    if (pick < 0) {
      picks.push(null);
      continue;
    }
    picks.push(pick);
    mask |= 1 << pick;
  }
  return { score, picks };
}
