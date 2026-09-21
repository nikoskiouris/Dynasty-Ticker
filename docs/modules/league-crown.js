export function pickLatestCrown(snapshots = []) {
  return [...(snapshots || [])]
    .filter((row) => row?.champion && (row.isComplete === true || !row.isCurrent))
    .sort((a, b) => Number(b.season) - Number(a.season) || Number(Boolean(a.isCurrent)) - Number(Boolean(b.isCurrent)))[0] || null;
}

export function leagueHistoryRecords(recordBook, ids = []) {
  const wanted = new Set((ids || []).map(String));
  const records = Array.isArray(recordBook?.records) ? recordBook.records : [];
  if (!wanted.size) return records.slice(0, 4);
  return records.filter((record) => wanted.has(String(record.id)));
}
