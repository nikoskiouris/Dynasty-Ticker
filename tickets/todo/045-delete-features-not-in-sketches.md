# 045 · Delete features the sketches don't show (Find a trade, buy-low/sell-high, win-now, hot on Sleeper, and the rest)

**Status:** Open · **Priority:** P1 · **Size:** L · **Owner:** unassigned (Chief Of Staff or Claude)

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
| **Power dashboard / roster grade "power" badges** not used by My Team (037) | `renderPowerDashboard`, `buildPowerBadges`, `formatPowerGrade`, `classifyPowerLane`, `calculateTradeXp`, `buildTradePowerBadges`; delete only what 037/030 do not reuse |

## Keep (the sketches imply them, or they keep old links working)

- Trade parsing (`trade-talk.js`), now the smart search (028).
- Team impact of a trade (`buildDraftImpact`, `buildTradeImpactAnalysis`), used by trade advice (030).
- Standings, playoff odds and luck (036).
- Roster value and lineup helpers used by My Team (037) and awards (041/042).
- Shared trade links `/t/:code`: they keep opening in Trade Calc (old links work). Flag for Niko: the Share button is not in the sketches. Default is to keep the button; delete it only if Niko says so.
- Sample league (`?sample=1`): kept as a link on League History for people without a Sleeper account. Flag for Niko.

## Scope

- Delete the code above, its CSS (`docs/styles.css`), HTML hooks, constants, state fields (`state.js`), analytics events, and unused imports. Grep for each removed export before deleting so nothing still calls it.
- Redirect removed URLs (`/l/:id/ideas` → `/l/:id`) in `history-route.js` / `_redirects`.
- Mark tickets 004, 005, 007, 008 and 023 with a `Superseded` line (owner removed the feature on Nov 13, 2026; restore from git) and 006 / 014 as superseded by the one-value-system rule (044), following AGENTS.md ticket rules.
- PR description: a restore table (feature → last SHA → files).

## Out of scope

- Data deletion in Netlify Blobs or any external store. Ask Niko.
- Rebuilding any deleted feature.

## Acceptance criteria (manual QA)

- None of the deleted features appear anywhere on the site at 390, 820 or 1280 px. Walk every page with the sample league connected.
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
