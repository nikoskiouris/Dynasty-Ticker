# 045 · Delete features the sketches don't show (Find a trade, buy-low/sell-high, win-now, hot on Sleeper, sample league, and the rest)

Done: 2026-11-13, [836aabe](https://github.com/nikoskiouris/Dynasty-Ticker/commit/836aabef15100e37fe4daab726bfa9cf6ab7cb2c), [d02415e](https://github.com/nikoskiouris/Dynasty-Ticker/commit/d02415e70225897fe63648cd3c5754405a153571), [300d220](https://github.com/nikoskiouris/Dynasty-Ticker/commit/300d2209e37490ce5c8c52776285402889e7ed40), [c48cfd8](https://github.com/nikoskiouris/Dynasty-Ticker/commit/c48cfd84fc43c4a4d4d7afda7f693fe1e7302ca3), [96401dc](https://github.com/nikoskiouris/Dynasty-Ticker/commit/96401dcf2786a4f2fb24c83956f993ac5529f3ab)

**Status:** Done · **Priority:** P1 · **Size:** L · **Owner:** unassigned (Chief Of Staff or Claude)

## Context / owner decision

Niko, Nov 13, 2026, on features with no place in the sketches: *"Delete these features for now and we can bring them back."* This ticket deletes them and their code paths cleanly. It does not hide them behind flags. **Git history is the restore path:** the PR description must list, per feature, the last commit SHA where it existed and the files/functions removed, so a future ticket can restore it with `git show <sha>:<path>` or `git revert` of the relevant hunk.

This overrides AGENTS.md "Keep capabilities, give each a clear home" for these features only. It is an explicit owner decision, so say so in the PR.

## Delete

| Feature | Code paths to remove |
| --- | --- |
| **Find a trade** (1-for-1 / 2-for-1 ideas, `/l/:id/ideas`) | `docs/modules/trade-match.js`; app.js `renderTradeMatchRoom`, `renderTradeMatchNeeds`, `renderTradeMatchDashboard`, `renderMatchPartners`, `generateTradeMatches`, `enrichTradeIdea`, `tradeMatchIdeaHelps`, `renderMatchTradeCard`, `renderReviewTradeButton`, `buildTradeMatchProfiles`, `clearTradeMatchCache`, `tradeMatchCacheKey`, `findSituationLine`, `ideaGainLine`, `checkerModelFor`, `syncFindGuestChrome`, `setMatchGenerateError`; `NAV_TABS` "find", `PAGE_ROOMS.trades` "find", `ROOM_LABELS/HINTS`; `verdict-copy.js` `ideaLimitMore` / `ideaGapMore` / `DEFAULT_IDEA_LIMIT_MORE` if unused |
| **Shop a player** (what each team could pay) | `docs/modules/shop-player.js`; app.js `shopChoices`, `shopResult`, `renderShopPanel`, `renderShopResults`, `renderPositionBuys`, `openShop` |
| **Buy-low / sell-high** (ticket 004) | `docs/modules/buy-sell.js`; app.js `renderBuySell` |
| **Win-now targets** (tickets 005/008) | `docs/modules/win-now.js`; app.js `renderWinNowTargets` |
| **Assets to move on from** (ticket 007) | `docs/modules/move-on.js`; app.js `renderMoveOn` |
| **Your next move** | `docs/modules/next-move.js`; app.js `renderNextMove` |
| **Contend / rebuild window call** (the "Call") | `docs/modules/window-call.js`; app.js `renderWindowCallDashboard`, `buildWindowCallForProfile`, `getLensWindowCall`; `league-format.js` `windowCallHorizon` |
| **Sleeper insight cards / trending** | app.js `buildSleeperInsightCards`, `buildTrendingInsight`, `formatTrendingPlayerName`, `loadTrendingPlayers` (unless 032 uses trending for a player page; then keep only that call) |
| **Hot on Sleeper / example trade / plain-words box on the landing** | `docs/modules/launch-landing.js` (`hotSleeperRows`, `launchExampleMarkup`, `exampleTradeFromValues`, `paintLaunchTrend`, `paintLaunchExample`, `openExampleTrade`); `#landing-talk-form` in `docs/ui/landing.html` (the plain-words parser itself stays; ticket 028 moves it into the smart search) |
| **Crowd call poll** (ticket 023) | `docs/modules/trade-poll.js`, `netlify/lib/trade-poll.js`, `netlify/functions/trade-poll.js`, app.js `pollVoterId` … `pollCodeFrom`, `renderTradePoll*`, `netlify.toml` function route. Leave the Netlify Blobs store "trade-polls" alone (data, not code; deleting it is irreversible and needs Niko). |
| **Rookie mock / draft "mock" room remnants** | app.js `state.mockFocus` / `#mock-fold` handlers (≈ l.7043), and `scripts/update_dynasty_rookie_mock.py` + its workflow/data if they exist only for that display |
| **Sample league** (`?sample=1`, a real public league shown with invented managers). Owner decision, Nov 13, 2026: remove. | `docs/modules/sample-league.js` (`SAMPLE_LEAGUE_NAME`, `SAMPLE_MANAGERS`, `inventSample*`); `docs/modules/sample-voice.js` (`sampleRosterLabels`, `sampleDescription`, `ownerPossessive`, `SAMPLE_BANNED_VOICE`); `constants.js` `SAMPLE_LEAGUE_ID`; `state.js` `viewingSample`; `parse.js` `sampleRequested()` and the `sample` param in the league URL builder/parser; `history-route.js` `keepSample()` and the `sample` option (≈ l.357–390); `site.js` `SAMPLE_BANNER_KEY`, `sampleBannerDismissed`, `clearSampleBannerDismissal`, `sampleConnectEntryVisible`, `focusAfterSampleBannerDismiss`, and the `viewingSample` branch of the page description; app.js `sampleViewingLine`, `sampleVoice`, `openSampleConnect`, the `inventSampleCore` call in `loadLeagueCoreData`, `loadLeagueById(…, { sample })`, and every `state.viewingSample` branch (~75 matches; grep `sample`); HTML `#sample-banner`, `#sample-find-btn`, `#sample-chrome*`, `#sample-league-chip`, `[data-sample-chip]`, `[data-sample-find]` in `docs/index.html`, "Try the sample league" links in `docs/index.html` (landing ≈ l.249), `docs/ui/landing.html`, `docs/ui/league.html` (`#sample-league-link`) and `docs/404.html`; `.sample-*` rules in `docs/styles.css` (~28); `scripts/debug_invariants.mjs` imports `SAMPLE_LEAGUE_ID` as a sample id, so inline a literal league id there; `research/first-visit-tasks.md` mention of `/?sample=1`. Old `?sample=1` links must still land somewhere useful: strip the param and open League History (`/leagues`), not the sample league. |
| **Power dashboard / roster grade "power" badges** not used by My Team (037) | `renderPowerDashboard`, `buildPowerBadges`, `formatPowerGrade`, `classifyPowerLane`, `calculateTradeXp`, `buildTradePowerBadges`; delete only what 037/030 do not reuse |

## Keep (the sketches imply them, or they keep old links working)

- Trade parsing (`trade-talk.js`), now the smart search (028).
- Team impact of a trade (`buildDraftImpact`, `buildTradeImpactAnalysis`), used by trade advice (030).
- Standings, playoff odds and luck (036).
- Roster value and lineup helpers used by My Team (037) and awards (041/042).
- **Share a trade (owner decision, Nov 13, 2026: keep).** Keep all of it: the Share button on Trade Calc (`shareDraftTrade`, `shareDraftTradeOnce`, `draftShareCode`, `buildShareUrl`, `showShareToast`), `/t/:code` links (`loadSharedTrade`, `applyTradeRoute`, `docs/modules/trade-share.js`), the share-image/OG card (`netlify/lib/trade-share.js`, `netlify/functions/*`) and the shared-trade verdict head (`renderSharedVerdictHead`). Deleting crowd call must not break any of it. The crowd poll keys off share codes (`pollCodeFrom`), so remove only the poll pieces.

## Scope

- Delete the code above, its CSS (`docs/styles.css`), HTML hooks, constants, state fields (`state.js`), analytics events, and unused imports. Grep for each removed export before deleting so nothing still calls it.
- Redirect removed URLs (`/l/:id/ideas` → `/l/:id`; `?sample=1` → `/leagues`) in `history-route.js` / `_redirects`.
- Mark tickets 004, 005, 007, 008 and 023 (in `tickets/done/`) with a `Superseded` line (owner removed the feature on Nov 13, 2026; restore from git) and 006 / 014 as superseded by the one-value-system rule (044), following AGENTS.md ticket rules.
- PR description: a restore table (feature → last SHA → files).

## Out of scope

- Data deletion in Netlify Blobs or any external store. Ask Niko.
- Rebuilding any deleted feature.

## Acceptance criteria (manual QA)

- None of the deleted features appear anywhere on the site at 390, 820 or 1280 px. Walk every page with a real public 12-team dynasty league connected.
- `/?sample=1` and `/l/<id>?sample=1` open League History (or that league, without invented names). No "sample" text, banner or chip remains anywhere.
- Share a trade still works end to end: build a trade, press Share, open the link in a private window, and see the same trade, verdict and share card.
- `/l/<id>/ideas` and any old deep link to a deleted room land on a working page.
- No console errors. The DevTools Network tab shows no request to `/.netlify/functions/trade-poll`.
- `docs/app.js` and `docs/styles.css` line counts drop. The PR states before and after.
- The core journey still works: find a player, build a trade, read the verdict, connect Sleeper, see team impact. The draft is kept throughout.
- The restore table in the PR lists a SHA for every deleted feature.

## Dependencies

- 024. Best done before 025, 030 and 037, so new pages are not built around code that is about to go. 043 (old nav) can follow.

## Technical notes

- Files: listed in the tables, plus `docs/modules/constants.js`, `docs/modules/state.js`, `docs/modules/jobs.js`, `docs/modules/analytics.js`, `docs/index.html`, `docs/ui/*.html`, `netlify.toml`, `docs/_redirects`.
- Run `node --check` on changed JS (a syntax check is allowed).
- No unit tests (repo policy). Manual QA + demo video.

## Size estimate

**L**

## When this ticket is done

In the **same PR/commit as the work**:
1. `git mv tickets/todo/<this file> tickets/done/`.
2. Add a line at the very top, under the title: `Done: <YYYY-MM-DD>, <PR or commit link>`. Change **Status** to `Done`.
3. Move this ticket's row in `tickets/README.md` from **To do** to **Done**, and point its link at `done/`.

## Done notes (2026-11-13)

Owner decision (Nov 13, 2026) overrides AGENTS.md "Keep capabilities" for these features. Share a trade is kept and was checked end to end: Share → link copied → `/t/<code>` opens the same trade and verdict. The Netlify Blobs store "trade-polls" was **not** touched; deleting that data needs Niko.

### Restore table

Every feature below last existed at **df93556** (`git show df93556:<path>`).

| Feature | Removed in | Files / functions |
| --- | --- | --- |
| Find a trade (`/l/:id/ideas`) | 836aabe | `docs/modules/trade-match.js`; find room in `docs/ui/trades.html`; app.js match/partner/idea renderers; `PAGE_ROOMS.trades` "find"; jobs.js find job; verdict-copy `ideaLimitMore`/`ideaGapMore` |
| Shop a player | 836aabe | `docs/modules/shop-player.js`; app.js shop panel/results |
| Buy-low / sell-high (004) | 836aabe | `docs/modules/buy-sell.js`; app.js `renderBuySell` |
| Win-now targets (005/008) | 836aabe | `docs/modules/win-now.js` |
| Move on from (007) | 836aabe | `docs/modules/move-on.js`; `docs/ui/league.html` move-on card |
| Your next move | 836aabe | `docs/modules/next-move.js` |
| Contend/rebuild window call | 836aabe | `docs/modules/window-call.js`; league-format `windowCallHorizon` |
| Sleeper insight cards / power hero | 836aabe | roster-markup `renderSleeperInsight`, `renderPowerHero`, `badgeMeaning`; team-score section |
| Crowd call poll (023) | d02415e | `docs/modules/trade-poll.js`, `netlify/functions/trade-poll.js`, `netlify/lib/trade-poll.js`, `/api/trade-poll` in `netlify.toml`, `poll_voted` analytics |
| Landing example trade, Hot on Sleeper, plain-words box, mock fold | 300d220 | `docs/launch-early.js`, `docs/modules/launch-landing.js`, landing talk form and trend column in `index.html`/`ui/landing.html` |
| Sample league | c48cfd8 | `docs/modules/sample-league.js`, `docs/modules/sample-voice.js`, `SAMPLE_LEAGUE_ID`, `state.viewingSample`, parse `sampleRequested`, history-route `keepSample`, site.js sample helpers, sample banner/chips/links in html |
| CSS for all of the above | 96401dc | `docs/styles.css` |

Kept and still used: `buildDraftImpact` and `enrichTradeIdea` (team impact), `formatPowerGrade`, `buildPowerBadges`, `calculateTradeXp` and `buildTradePowerBadges` (power profiles). `countStartableAtPosition` moved to `lineup.js` and `ownerPossessive` to `html.js`. No rookie-mock script or workflow existed.

Manual QA (headless Chromium, 390/820/1280 px, 13 paths, with real league 1315165104303513600 loaded): none of the deleted features or any "sample" text shows; `?sample=1` lands on `/leagues`; `/l/ID/ideas` lands on the hub; no request to `trade-poll`; no console errors; no sideways scroll. Trade Calc with the league connected still shows team impact. Line counts are in 043's notes. Demo: `/workspace/qa-045/video/045-deleted-features-1280.webm`, with screenshots in `/workspace/qa-045/`.
