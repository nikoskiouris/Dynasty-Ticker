# Dynasty Ticker engineering audit

Date: 2026-10-06. Scope: `develop` at `6b76713` (“Rebuild the desk as a product page”). No product changes in this branch. Findings are from the tree, the test suite shape, and live responses from the two public hosts.

This is the Sleeper dynasty desk by Niko Skiouris (`nikoskiouris/Dynasty-Ticker`). The browser loads a league from `https://api.sleeper.app/v1`, prices players from a checked-in forecast (`docs/data/player_values.json`), and suggests roster and trade moves. There is no app account.

## How the two public hosts differ

| Host | What it is today | Evidence |
| --- | --- | --- |
| `https://nikoskiouris.github.io/Dynasty-Ticker/` | Current `develop`, published by GitHub Actions on every `develop` push | HTML references `boot.js` and `product.css`. `app.js` is 617,564 bytes, `Last-Modified: Tue, 06 Oct 2026 23:08:36 GMT`. `robots.txt` is `Disallow: /`. |
| `https://dynastyticker.com/` | Netlify production from a GitHub Release. Canonical URL in `docs/index.html`, `README.md`, and `docs/privacy.html` | HTML references `./app.js` and `/.netlify/scripts/rum`. `boot.js` returns **404**. `robots.txt` allows crawl and points at a sitemap. `app.js` is 619,109 bytes (not the Pages file). |

`scripts/stage_pages_preview.sh` copies `docs/` to Pages and replaces `robots.txt` with a full disallow. `.github/workflows/refresh-pages-preview.yml` runs on every `develop` push and dispatches `preview-pages.yml` (which only GitHub Pages will deploy, and only from `main`). `.github/workflows/deploy-release.yml` uploads to Netlify only when a release is published.

So the URL people were sent for this audit is the unreleased desk. The marketed domain is an older shell, plus Netlify’s real-user monitoring script, which the repo does not contain. Privacy copy says the site does not install a third-party tracker (`docs/privacy.html`).

## 1. Architecture and structure

Static site. No bundler. `docs/boot.js` fetches four HTML fragments (`docs/ui/landing.html`, `players.html`, `trades.html`, `league.html`), assigns them with `innerHTML`, then imports `docs/app.js`.

`docs/app.js` is the product. About **16,033 lines** and **683** top-level `function` declarations. It owns DOM queries, Sleeper orchestration, season simulation, trade search, and almost every screen. `docs/modules/` (about 40 files) holds the parts that are tested as plain functions: Sleeper client, values, season math, trades, loyalty, rather-votes. `docs/styles.css` is **8,375 lines** (~146 KB). `docs/product.css` is the newer layer (~20 KB).

State is one exported object, `state` in `docs/modules/state.js`, mutated from `app.js`. One shared Sleeper client (`createSleeperClient` in `docs/modules/sleeper.js`) queues every request: 3 in flight, 110 ms between starts, 25 s default timeout, `credentials: "omit"`, `cache: "no-store"`.

Player prices are not fetched from a vendor at click time. `player-values/build.py` writes `docs/data/player_values.json` (2.8 MB; 984 player rows; 1,032 prices in `sf` and `oneQb`). The browser loads that file in `fetchValuationBundles` (`docs/modules/values.js`). A weekly GitHub Action (`.github/workflows/refresh-player-values.yml`) rebuilds it and **pushes straight to `develop`**. The rookie-mock workflow does the same.

A Python CLI still lives in `src/` (`src/cli.py`, `src/integrations/sleeper_client.py`). `requirements.txt` says it has no third-party dependencies. It is a second Sleeper client, not the one the site uses.

Netlify Functions (`netlify/functions/rather-vote.js`, `searched-user.js`) exist only on the Netlify host. GitHub Pages has no equivalent. `docs/modules/rather-crowd.js` and `docs/modules/visits.js` call `/api/...` only when `location.hostname` is `dynastyticker.com` (`SITE_ORIGIN` in `docs/modules/site.js`). On the Pages URL those calls never leave the browser.

What is in good shape:

- League ids that hit the API are digits or a Sleeper league URL (`parseLeagueId` / `classifyLeagueInput` in `docs/modules/parse.js`).
- A load token drops stale league responses (`docs/modules/league-load.js`, checked in `runLeagueLoad`).
- Live polling does not rerun the 4,000-season sim on every point tick (`LIVE_SIM_REFRESH_MS` is 180000 in `docs/modules/constants.js`; `shouldRefreshSim` in `docs/modules/live.js`).
- Render requests collapse to one frame and wait while a field is focused (`docs/modules/page-render.js`).

## 2. Security

No API keys or Netlify tokens are committed. `npm audit` on the lockfile reports **0** vulnerabilities. The only production dependency is `@netlify/blobs`. Deploy tokens stay in GitHub Actions secrets (`NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`).

### Stored HTML injection (highest issue)

A lot of newer markup goes through `escapeHtml` (`docs/modules/html.js`). Several screens still drop Sleeper-controlled strings into `innerHTML`.

Confirmed sinks in `docs/app.js`:

- Line 3081: `<h3>${profile.managerName}</h3>` inside `el.powerDashboard.innerHTML`. That node is the Outlook panel on My League (`docs/ui/league.html` `#power-dashboard`). `managerName` is the Sleeper `display_name`.
- Line 3085: power badges, same assignment.
- Lines 4638 and 4653: player names concatenated into `<small>` on the loyalty board.
- Lines 9978–10047: trade-idea titles, subtitles, and `<h4>${participant.roster.manager.displayName}</h4>`. Subtitles are built from `displayName` in `buildResultsSubtitle` (line 9954).
- Lines 15290–15300: `renderAvatar` sets `img src` from the raw Sleeper avatar id. The league hero escapes the same field (line 1598). The manager avatar does not. A quote in the id breaks out of the attribute.

`setStatus` and the hero title use `textContent` (lines 15651 and 1583), so those paths are safe. There is **no Content-Security-Policy** on either host. Pages also sends no `Strict-Transport-Security`, `X-Content-Type-Options`, or `X-Frame-Options` (checked with response headers on 2026-10-06). Netlify HTML sends HSTS only. The rather-vote JSON response sends `X-Content-Type-Options: nosniff` and `Access-Control-Allow-Origin: *`.

Impact is script execution on the site origin for anyone who opens a league whose manager name, team nickname, or avatar id contains markup. The app does not keep a login cookie, and Sleeper fetches use `credentials: "omit"`, so this is not a Sleeper account takeover. It can still rewrite the page, read `localStorage` (trade draft, rather votes, player cache), and fire requests as the visitor.

### Write APIs

`netlify/lib/rather-crowd.js` checks vote shape (`player:<id>`), rejects same-player pairs, and limits a visitor to 40 votes an hour and 400 ms between votes. The visitor hash salt is the literal `dynasty-ticker-rather-v1` in that file (`RATHER_SALT`). The same pattern is `dynasty-ticker-traffic-v1` in `netlify/lib/traffic.js`. Anyone can recompute the hash from IP plus user agent.

`isAllowedWrite` (`netlify/lib/traffic.js` line 396) allows a POST when the `Origin` or `Referer` header is `https://dynastyticker.com`. Non-browser clients can set that header. The rather endpoint still has the per-IP limit. **`searched-user` has no rate limit.** It appends Sleeper usernames to one CSV blob (`netlify/lib/searched-users.js`). Username cells are sanitized (no commas, no spreadsheet formulas). The list is not served back over HTTP. A client that spoofs `Origin` can still grow the blob.

Rather votes are stored forever in one JSON object. `applyRatherVote` does `votes.unshift` with no cap. `GET /api/rather-vote` returns every vote. On 2026-10-06 that payload was **10,339 bytes, 77 votes**. Fine today. The design breaks when the blob gets large: every landing view on the live domain downloads the full history, and a full blob fails the write.

GitHub Pages returns **404** for `/api/rather-vote`. Votes and username logging only exist on Netlify, and the client refuses to call them from any other host. Pages visitors get a local rather board only.

`docs/privacy.html` says a vote “slightly nudge[s] player values.” `docs/modules/rather.js` line 335 shows the same sentence in the UI. `applyCrowdShift` in `docs/modules/values.js` is only referenced from `tests/values.test.js`. `getAssetValue` in `app.js` (line 496) calls `marketAssetValue` and does not apply `state.crowdShifts`. Shifts only change which pair is offered (`pickRatherPair`). `player-values/README.md` says crowd votes must not reprice players. Three stories, one code path.

Google Fonts stylesheets are render-blocking on every HTML entry (`docs/index.html` line 35, plus privacy, terms, and 404). That is a third-party request the privacy page does not mention. Netlify injects `/.netlify/scripts/rum` on the custom domain only.

League ids in the share URL are public Sleeper ids. The app does not add secrets to the query string.

## 3. Reliability and error handling

The Sleeper client is careful about timeouts, abort, HTTP status, and one retry (`apiGetWithRetry`). Call sites are uneven.

- `fetchUserLeagues` (`docs/modules/sleeper.js` lines 190–200) catches a failed season and returns `[]`. A 429 or a CORS failure on last year looks like “this user has no leagues.”
- `loadPlayersWithCache` (`docs/app.js` line 2553) uses `apiGet`, not the retry helper, for `/players/nfl`.
- `loadLeagueCoreData` (line 2214) fails the load if league, users, or rosters fail, and ignores traded picks, drafts, and brackets. That split is right. The status line is overwritten by whichever request finishes last (`setStatus` inside the parallel map), so the user sees a random “Loading …” label.
- `loadLeagueHistoryContext` (line 2499) walks `previous_league_id` up to `MAX_HISTORY_SEASONS` (6). The first thrown season **stops the walk**. Older seasons vanish with `console.warn` only.
- Transaction and matchup weeks use `Promise.allSettled` and keep a failed flag (`transactionsFailed`, `historyMatchupsFailed`). Good. A week that 429s is dropped, and the log is quietly short.
- Player-name failure is non-fatal (lines 2090–2099). The desk still opens.
- `boot.js` throws if any of the four HTML fragments 404. The Pages host has them. A partial upload produces a blank `#ui-pages` and no further UI.
- `savePlayersCache` swallows `localStorage` quota errors (line 2948). See performance: the cache often cannot be written, so the next visit downloads `/players/nfl` again. Cache key is still `fda_players_nfl_cache_v1` (`docs/modules/state.js`), a name from an older product.
- The Python client (`src/integrations/sleeper_client.py` `_get`) has no retry, no 429 handling, and interpolates the username into the path without `quote`.

`runLeagueLoad` shows `Could not load league data. ${err.message}` and, if a previous league is still in memory, puts that league back on screen and restarts polling (lines 2101–2110). A failed switch can look like the old league loaded cleanly except for the red status line.

## 4. Performance

First visit, before a league:

1. Blocking font CSS from `fonts.googleapis.com` / `fonts.gstatic.com`.
2. `boot.js`, then four `fetch` calls, then the 604 KB `app.js` module graph.
3. `bootLandingRather` and `ensureRankExtras` load `player_values.json` (2.8 MB JSON parsed on the main thread).
4. `loadRatherPromptContext` may then call `/players/nfl` (Sleeper’s full player dictionary, routinely larger than `localStorage`) and `/stats/nfl/regular/{year}` (full season stat blob, 20 s timeout, no retry).

League open, after that:

- Seven core endpoints in parallel, then up to five older seasons sequentially, each running the same seven-call plan.
- Up to 18 transaction weeks for the current season and up to 4 prior seasons (`HISTORY_TRANSACTION_SEASON_LIMIT`), in chunks of 3 (`MATCHUP_FETCH_CHUNK`).
- The same shape for historical matchups (up to 6 seasons).

One shared queue (3 wide, 110 ms gap) is about 9 requests/second, under Sleeper’s published 1,000/minute budget for a single user. A long dynasty league is still on the order of 150–250 calls. Wall time is dominated by `/players/nfl` plus the history walk, not by the 110 ms gap. Two league loads share one queue; the token ignores stale results but does not cancel queued HTTP.

`simulateSeason` (`docs/modules/season.js` line 376) runs **4,000** iterations on the main thread unless the season is already decided (`runs = 1`). It is cached and refreshed on a 3 minute cadence during live games. A 12-team league with a full remaining slate can still hitch the tab the first time odds render.

CSS and JS are unminified. There is no code splitting beyond native modules, and `app.js` imports the season engine, trade matcher, and loyalty model even for a visitor who only looks at ranks.

`prefers-reduced-motion: reduce` disables transitions and animations (`docs/styles.css` line 7762), including the ticker motion. That part is already handled.

## 5. Testing and CI

`npm test` syntax-checks the entry files, runs `node --test tests/*.test.js`, runs Python unittests, then `npm run debug`. About **392** `test(` / `def test_` assertions across **46** files. Coverage is real for parsers, values, trades, the Sleeper queue, league-load cancellation, deploy scripts, and the rather/username stores.

Gaps:

- No ESLint, Prettier, or typecheck. Nothing fails a 16,000-line file for an unescaped template.
- No browser or end-to-end test. `npm run serve` is a static file server (`python3 -m http.server`).
- `.github/workflows/test.yml` runs on pull requests and on pushes to `develop`, `prod`, `main`, `master`, and `work`. It uses `npm install`, not `npm ci`. The player-value workflow uses `npm ci`.
- No `npm audit` or dependency review in CI.
- Several tests assert against source text of `app.js` (for example `tests/league-load.test.js` matches `if (!leagueLoader.isCurrent(token)) return`). Those pass after a rename that keeps the string and fail after a harmless wrap.
- Scheduled jobs push to `develop` with the Actions bot, which skips review and then triggers the Pages relay.
- `main` (`741380f`) is not `develop`. The Pages workflow checks out `develop` while living on `main` because GitHub Pages only deploys `main`. Easy to “fix” the wrong branch.

`node --test` plus the value-contract tests are the reason the pricing kernel is safer than the UI shell. The shell is where the XSS and the load waterfall live, and it is barely executed.

## 6. Frontend quality and accessibility

The shell has a real accessibility pass, not a blank one.

- Page tabs are `role="tab"` with `aria-selected`, `aria-controls`, and arrow/Home/End handling (`handlePageTabKeydown` in `docs/app.js`). Room tabs get the same keys.
- Username and league fields have `<label>`, `aria-invalid`, and `role="alert"` errors (`docs/index.html`).
- Status uses `aria-live="polite"`.
- Rail open/close buttons have names. Focus moves into the rail (`requestAnimationFrame` focus on the close control).
- `.sr-only` exists. Player faces mark the photo `alt=""` and put the name in adjacent text (`docs/modules/player-face.js`).
- Reduced motion is implemented.

Problems:

- No skip link. The rail, tabs, and ticker come before the room.
- The ticker is a `<div>` with `aria-pressed` and a `title` (`docs/index.html` lines 217–221). `bindTicker` (`docs/modules/ticker-scrub.js`) is pointer-only. Keyboard users cannot pause or scrub it. `aria-pressed` on a non-button is invalid.
- Rebuilding a room with `innerHTML` drops focus if the render happens while the user is not in a text field. The render queue protects text inputs, not buttons.
- `boot.js` paints nothing until four HTML files return. A failed fragment is an uncaught rejection and a blank page.
- Two stylesheets overlap (`styles.css` and `product.css`). Dead rooms from the old four-page desk still have CSS and `PLACE_ALIASES` entries (`docs/modules/constants.js`).
- Landing rather copy claims a public price nudge that the price function does not do (section 2).

Color contrast was not measured in a browser for this pass. The dark theme uses muted gray body copy (`class="muted"`) on `#0c0c0e`. That is the first place a contrast check should look.

## 7. Tech debt and maintainability

- **One file owns the product.** A change to odds, trades, or the landing page is a change to `docs/app.js`. Modules exist, but the renderers and the fetch orchestration did not move with them.
- **Two UIs are public.** Pages tracks `develop` immediately. Netlify tracks releases and is behind (no `boot.js`). README, privacy, and the Pages robots file disagree about which URL is the product.
- **Value story is split.** `player-values/SPEC.md` and `player-values/README.md` say one full-PPR ruler and no crowd bump. Privacy, rather copy, and `crowdShiftsFromVotes` still describe a nudge. `applyCrowdShift` is dead in the app. `LEAGUE_BOARD_APPLY_KEY` remains in `docs/modules/league-board.js`.
- **Cache key `fda_players_nfl_cache_v1`** will keep serving or failing under a name new readers cannot place.
- **Python CLI** duplicates league loading without the browser client’s timeout, retry, or encoding. `README.md` still points at it.
- **Alias tables** in `constants.js` (`PAGE_ALIASES`, `PLACE_ALIASES`, `SCOPED_ROOM_ALIASES`) keep every old tab name alive. Useful for share links. Expensive when someone has to learn three names for one room.
- **Bot commits to `develop`** for values and the rookie mock bypass the pull-request test gate’s review step. Tests do run inside the value workflow before the push. The mock workflow commits without `npm test`.
- **String-matched tests** freeze today’s formatting of `app.js`.

## 8. Top 10 improvements

Ranked by user harm and how directly the current code causes it. Effort is not the sort key.

### 1. P0 — Stop rendering Sleeper strings as HTML

Escape every manager name, team name, nickname, player name, league name, and avatar id at the `innerHTML` boundary, including the sinks at `docs/app.js` 3081, 3085, 4638, 4653, 9978, and 10047, and `renderAvatar` (15290). Add a Content-Security-Policy that disallows inline scripts (`script-src 'self'`). There is no CSP on Pages or Netlify today, so one unsanitized `display_name` runs in the origin. League ids are already constrained to digits; names are not.

### 2. P1 — Make one host the product

`dynastyticker.com` is what README and privacy call the site, and it is serving an older document (`./app.js`, `boot.js` 404, Netlify RUM injected). `github.io` is current `develop`, with `robots.txt` disallowing all crawlers, and with no vote or username API. Pick one. Until prod is cut from this tree, bug reports against the marketed domain will not match the code under review. Drop or disclose `/.netlify/scripts/rum` so it matches `docs/privacy.html`.

### 3. P1 — Do not download the whole NFL into the tab

`/players/nfl` plus `/stats/nfl/regular/{year}` run from the landing rather/ranks path (`loadRatherPromptContext`, `docs/app.js` 15746) and again on league load. `savePlayersCache` writes the entire object to `localStorage` and ignores quota failure, so the cache does not stick. Fetch the ids the screen needs, or cache a trimmed map in IndexedDB / Cache Storage. Keep the retry helper on that call.

### 4. P1 — Bound league history and say when Sleeper fails

A long league fans out across seasons and weeks on one queue (`loadLeagueHistoryContext`, `loadLeagueTransactions`, `loadLeagueHistoryMatchups`). `fetchUserLeagues` turns a failed season into an empty list. History aborts at the first bad `previous_league_id`. Cap concurrent history, retry 429s with `Retry-After`, and show “archive missing N seasons” instead of a shorter hall that looks complete.

### 5. P1 — Cap the public write blobs

Rather votes have no max length and `GET` returns all of them (`publicRatherVotes`). Seventy-seven votes is small; the shape is not. `searched-user` has origin checks a non-browser can spoof and no per-IP limit. Move the hash salt to an environment variable. Return aggregates, not the raw vote list, once the list is no longer tiny. Pages cannot call these routes at all; do not describe them as part of that URL.

### 6. P2 — Split `docs/app.js` along the three jobs

Players, Trade, and My League already have HTML fragments and modules. The 16k-line file still renders all three and imports all of them up front. Move each room’s render and its Sleeper loader next to the module that already computes it (`season.js`, `trade-match.js`, `ranks.js`). The page-render queue and the load token should stay shared. This is what makes the P0 escapes stick: new markup will land in a file small enough to review.

### 7. P2 — Cut the first-load waterfall

`boot.js` waits on four HTML files before `app.js` starts. Fonts are blocking. `player_values.json` is 2.8 MB of JSON for a visitor who may only type a username. Inline the four shells (or ship one HTML document), subset the font or self-host it, and load values when a rank or trade surface opens. The 4,000-iteration sim should stay off the first paint; it already waits for a league. If odds still hitch, run `simulateSeason` in a worker. Do not rerun it on a timer while the tab is hidden (polling already pauses; the sim refresh should too).

### 8. P2 — Make the price story one story

`player-values/README.md` forbids crowd and league repricing. Privacy and the rather note say a vote nudges the board. `applyCrowdShift` is unused by `getAssetValue`. Either wire it and document the cap, or delete the shift math from the client path and fix the sentence in `docs/modules/rather.js` and `docs/privacy.html`. Same pass: remove or rename `fda_players_nfl_cache_v1`.

### 9. P2 — Lint and one browser smoke in CI

Add a lint that flags `innerHTML` templates whose interpolations are not escaped. Switch `.github/workflows/test.yml` to `npm ci`. Run `npm audit --audit-level=high`. Add one headless test that boots `docs/`, searches a fixture username against a mocked Sleeper, and opens Players, Trade, and My League. The ~392 unit tests should stay; they do not open the shell. Stop matching raw slices of `app.js` where a function export can be called instead. Run tests in the rookie-mock workflow before it pushes to `develop`.

### 10. P3 — Accessibility nits and the Python twin

Make the ticker a `<button>` (or give it `tabindex="0"` and a key handler) and fix `aria-pressed`. Add a skip link to `#ui-pages`. Check `.muted` contrast on `#0c0c0e`. Point `src/integrations/sleeper_client.py` at the same timeout and encoding rules as `docs/modules/sleeper.js`, or drop the CLI from the README so the next change does not fix only one of them.

## What this audit did not do

No fixes, no dependency bumps, no Netlify deploy, no Pages deploy. Contrast was not measured with a screen reader or a contrast tool. Sleeper’s own API was not fuzzed to prove a live `display_name` payload; the sinks above execute whatever string Sleeper returns. Vote and header checks were read-only GETs on 2026-10-06.
