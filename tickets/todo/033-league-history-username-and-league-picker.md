# 033 · League History entry: "Enter your Sleeper username" → "Select your league"

**Status:** Open · **Priority:** P0 · **Size:** M · **Owner:** unassigned (Chief Of Staff or Claude)

## Context / sketch description

Sketch 6: League History page with ☰, the prompt **"Enter your Sleeper username:"** and an input, then **"Select your league:"** listing **league 1, league 2, …**. Picking a league opens the league hub (ticket 035).

Today this flow lives in the left control rail: `#username-search-form` / `#sleeper-username` → `requestFindLeagues()` → `runUserLeagueSearch()` → `fetchUserLeagues()` (`sleeper.js`) → `renderLeaguePicker()` (`#league-picker`) → `handleLeaguePickClick()` → `loadLeagueById()` → `runLeagueLoad()`. There is also a league-id fallback (`#league-id-fallback`, `requestLoadLeague()`), a sample league (`?sample=1`, `SAMPLE_LEAGUE_ID`), the remembered league (`last-league.js`, `rememberPickedLeague()`, `renderLandingResume()`), and team selection (`#me-select`, `hydrateManagerSelector()`).

## Scope

- `/leagues` page, centered single column:
  - "Enter your Sleeper username:" input + "Find my leagues" button (reuse validation, `league-search.js`, error copy).
  - "Select your league:" list of that user's leagues (current season first, then older), each showing league avatar, name, season, team count and format chip (e.g. "10-team · 1QB · Half PPR"). The chip only describes the league; values never change (044). Leagues that aren't 12-team SF PPR get the 044 caveat line on the hub.
  - Selecting a league navigates to `/l/:leagueId` (hub). The username's own roster becomes "my team" automatically (no extra dropdown) – fall back to a team picker only if the user isn't in that league.
- Keep: "Paste a league ID instead" (collapsed), "Try the sample league", and "Recent: <last league>" shortcut.
- Remember username and last league (`safe-storage.js`, `last-league.js`) so returning visitors skip straight to the list or hub.
- Error states: unknown username, no leagues, Sleeper down (`#sleeper-down`, `league-load-error.js`) – each with a clear retry.
- Move the connect controls out of the left rail (rail nav is retired by ticket 025). `/connect` and `/connect?next=…` redirect here.

## Out of scope

- Hub content (035). Non-Sleeper platforms (ESPN, MFL, Fleaflicker).

## Acceptance criteria (manual QA)

- Open League History from the menu, type a real Sleeper username, press Enter: the user's leagues list within a few seconds.
- Choosing a league opens its hub; reloading `/l/<id>` keeps it; Back returns to the list.
- A misspelt username shows "We can't find …" and keeps the text for editing.
- A returning visitor sees their last league as a one-tap shortcut.
- Pasting a league ID opens that league; the sample league link works.
- A half-built trade in Trade Calc is still there after connecting a league (AGENTS.md: never erase work).
- 390/820/1280 px, keyboard-only and screen reader announce errors.

## Dependencies

- 024, 025.

## Technical notes

- Sleeper API (public, no key): `GET /v1/user/<username>`, `GET /v1/user/<user_id>/leagues/nfl/<season>`, `GET /v1/league/<league_id>`; wrapped by `createSleeperClient()`, `fetchUserLeagues()`, `dedupeLeagues()`, `preferLatestLeagues()`, `apiGetWithRetry()` in `docs/modules/sleeper.js`.
- Files: `docs/index.html` (rail forms), `docs/app.js` (functions above, plus `searchUserLeagues`, `startFindLeaguesUi`, `stopFindLeaguesUi`, `collapseLeaguePicker`, `noteSearchedUser`, `unloadLeague`, `currentMeRosterId`), `docs/modules/league-search.js`, `league-load.js`, `league-load-error.js`, `last-league.js`, `sample-league.js`, `docs/_redirects`.
- No unit tests (repo policy). Manual QA + demo video.

## Size estimate

**M**

## When this ticket is done

In the **same PR/commit as the work**:
1. `git mv tickets/todo/<this file> tickets/done/`.
2. Add a line at the very top, under the title: `Done: <YYYY-MM-DD>, <PR or commit link>`. Change **Status** to `Done`.
3. Move this ticket's row in `tickets/README.md` from **To do** to **Done**, and point its link at `done/`.
