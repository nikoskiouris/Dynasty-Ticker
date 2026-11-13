# Shared league archive (034)

Acceptance behavior: historical resource reads are shared and persistent; a completed season is reused, current resources expire after six hours, refresh explicitly refetches, switching leagues cancels the previous load, failures name the missing season/resource, and offline reads retain saved data.

## Integration contract

Import `leagueArchive` from `docs/modules/league-archive.js`.

- `load(id, {scope, currentCore, nflState, refresh, onProgress, signal})` returns the requested archive. `scope` is `core`, `standings`, `recent`, or `all`. `core` loads league metadata, managers, rosters, picks, drafts and brackets along the chain. `standings` adds completed current weeks, `recent` adds current/prior-season completed transactions (including round zero), `all` adds every completed week and draft picks.
- The result has `leagueId`, `seasons`, `matchups[season][week]`, `transactions[season]`, `drafts[season]` (draft records with `picks`), `franchiseIndex`, `issues`, `savedData`, `stale`, `loadedAt`.
- `loadCore(id, options)` is available to replace existing initial app core reads, using the same resource cache.
- `cancel()` aborts the active archive load and clears its published snapshot. `snapshot` is a read-only getter for the last successful load. A new `load` cancels the previous one. Catch `AbortError` without displaying an error.
- `onProgress({season, loaded, total, done, message})` supplies a visible loading line. Render `issues[].message`; never treat unavailable weeks as zero scores or missing transaction batches as no activity.
- `savedData` means some resources came from cache; `stale` means a request failed and an older saved resource was returned. Show a saved-data note. Storage denial produces a separate warning.
- Injected client is the existing Sleeper client (3 requests at once); batches cap at six. The default history limit stays six seasons; no unsupported performance claim is made.

## Manual CLI verification

Live Sleeper public league `1360686137898700800`, 2026-11-13: all-scope read returned one 2026 season, 12 teams, 9 completed matchup weeks, 4 trades, 131 completed moves and one draft in 7.105 seconds. Repeating it in the same session reused cached resources in 0.001 seconds. The league has no previous-season chain. Node has no browser storage and correctly reported that persistence was available only for this visit.

`node --check docs/modules/league-archive.js` passed. No automated suite was created or run. Browser persistence, offline reload, multi-season spot checks, responsive UI and a demo video still require the integrated app/browser; they have not been claimed as verified.
