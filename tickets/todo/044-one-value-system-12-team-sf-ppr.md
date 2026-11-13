# 044 · One value system: 12-team Superflex PPR dynasty only

**Status:** Open · **Priority:** P0 · **Size:** L · **Owner:** unassigned (Chief Of Staff or Claude)
**Order:** foundation. Do it right after 024 and before any ticket that shows a value (026–032, 037–042).

## Context / owner rule

Niko, Nov 13, 2026: *"I officially want this website optimized for 12 Team Superflex PPR league values. We have one value system and its based on that. Nothing else."*

**The rule:** Dynasty Ticker publishes one value set, for 12-team Superflex full-PPR dynasty, and nothing else:
- no 1QB values,
- no other league sizes,
- no TE premium or other scoring toggles,
- no redraft, keeper or other alternate value modes.

A connected league of any shape still loads, but every price, rank, verdict and grade uses this one set. The UI says so. This rule is now in AGENTS.md and overrides the older "Superflex vs 1QB" wording there and in `player-values/` docs.

Today the code carries a second (1QB) value system end to end, plus format-aware copy and league-type modes. The audit below was run against `develop` @ 31352b7.

## Audit: every alternate format, mode or toggle found

**Value data and pipeline**

| Where | What | Change |
| --- | --- | --- |
| `player-values/config.json` | `qbRosterCapPerTeam: { oneQb: 2, sf: 3 }`; `referenceLineup` includes `SUPER_FLEX` | Keep SF cap only (`3`); keep `referenceTeams: 12`. |
| `player-values/forecast.py` | `FORMATS = ("sf", "oneQb")`; QB model per format | `FORMATS = ("sf",)`, or remove the loop. |
| `player-values/build.py` | `allocate_reference_league(values, fmt)` for `("oneQb","sf")`; shared replacement averaged across formats (≈ line 702–708); writes `oneQb` map | Build `sf` only. RB/WR/TE replacement comes from the SF reference league alone, so skill-player values may shift slightly. Report before/after top-50 in the PR. |
| `player-values/backtest.py` | `fmt` loops over `forecast.FORMATS`, `score_origin(..., fmt="sf")` | SF only. |
| `player-values/validation.json`, `README.md`, `SPEC.md` (§ market formats, § 11 "1QB, Superflex"), `ACCEPTANCE.md` | Describe two maps | Rewrite to one 12-team SF PPR map. |
| `docs/data/player_values.json` | top-level `oneQb` map | Stop writing it. During one release, the app must tolerate it if it is present. |
| `docs/data/price-history/*.json` | snapshots `{ asOf, sf, oneQb }` | Old files stay as is (history). New snapshots are `{ asOf, sf }`. |
| `scripts/archive_price_snapshot.py`, `scripts/check_market_files.py`, `scripts/prices_unchanged.py` | Require/compare `oneQb` | Require `sf` only. |
| Repo `README.md` (≈ lines 32–36) | "Two published maps: 1QB… Superflex…" | One map. |

**Browser app**

| Where | What | Change |
| --- | --- | --- |
| `docs/modules/values.js` | `selectValueFormat(league)` picks `oneQb` for non-SF leagues; `leagueHasSuperflex`; `pickValueBundle`; `coerceValueMap` / `playersFromValueSnapshot` build `oneQb`; TE-bonus detection `TE_REC_BONUS_KEYS`, `tepLevelFromScoring`, `tepLevel` | Always `sf`. Delete `selectValueFormat`, `tepLevel*` and the `oneQb` bundle. |
| `docs/modules/state.js` | `valueBundles: { sf, oneQb, names }`, `ranks.format`, `valueFormat` | `sf` only. Drop `ranks.format` / `valueFormat`. |
| `docs/app.js` | `activeRankFormat()`; `rankValuesReady()` fallback to `oneQb`; `pickValueBundle(..., activeRankFormat())` in `ensureRankExtras` / `ensureCalcPrices`; `applyTradeRoute()` format handling (≈ l.2031); shared-trade snapshot `sf && oneQb` check (≈ l.2078); `buildShareUrl()` format (≈ l.2435); `draftBasis()` format (≈ l.5139–5150); `renderDraftBasis()` **SF/1QB buttons** `draft-format-btn` + format tip (≈ l.5785–5800); `rank-format` / `draft-format` click handlers (≈ l.7127, 7294); `dropUnknownDraftPlayers` `oneQb` lookup (≈ l.5221); `describeLeagueFormat()` "TE bonus" / superflex text (≈ l.7974–7997); TE-bonus tips in `renderLeagueHero()` (≈ l.2703) and `buildSleeperInsightCards()` (≈ l.7914); value-bundle selection ≈ l.10051–10093, 10498 | Remove the toggles and branches. Format copy becomes the fixed line "Values: 12-team Superflex PPR dynasty". |
| `docs/modules/ranks.js` | `RANK_FORMATS = ["sf","oneQb"]`, `rankFormatLabel`, format chips in `renderRanksToolbar()` | Remove the format chips. |
| `docs/modules/info-tip.js` | `GLOSSARY["1QB"]` | Remove the 1QB glossary entry. Keep Superflex and PPR. |
| `docs/modules/history-route.js` | `tradeHref(..., { format })` writes `fmt=1qb`; the route parser reads `fmt` | Stop writing it. Ignore `fmt` on read; the link still opens. |
| `docs/modules/trade-share.js` + `netlify/lib/trade-share.js` + `netlify/functions/*` | Share code v2 format char `s`/`q` (`FORMAT_CODE`, `CODE_FORMAT`); `formatLabel` "1QB"; snapshot must have `sf && oneQb` | New codes always `s`. Old `q` codes still decode and open on SF values, with a one-line note: "Shared with 1QB values, which we no longer publish. Shown on 12-team SF PPR values." Never 404. |
| `docs/modules/trade-poll.js`, `netlify/lib/trade-poll.js` | Poll key includes the format (`q`/`s`) | New polls are `s` only. If crowd call is deleted by 045, skip this. |
| `docs/modules/value-scale.js` | Price-history schema/notes for `oneQb`, `playerSeries` format key, `TEN_THOUSAND_NOTE` wording | `sf` only. Old snapshots' `oneQb` is ignored. |
| `docs/modules/league-format.js` | League types `redraft` / keeper / dynasty (`LEAGUE_TYPES`, `marketCaveat`, `hiddenRoomsForLeague`, `roomLabelFor`, `windowCallHorizon`) changing rooms and copy | Remove the per-type modes. Any league shows the same pages. A non-dynasty, non-SF or non-12-team league gets one caveat line (below). |
| `docs/modules/verdict-copy.js` | `PRICE_FACTORS_LINE` etc. | Add "12-team Superflex PPR dynasty" to the value explainer. |
| Copy across `docs/index.html`, `docs/ui/*.html`, `privacy.html`, meta/OG text | Any "1QB", "your league's format", "TE premium" mention | Reword to the one system. |

**Already single-mode (no change, listed so nobody re-adds a toggle):** PPR scoring is full PPR only (`meta.scoring`). The reference league is already 12 teams (`referenceTeams: 12`). TE/RB premiums are already not inputs (`meta.notInputs`, `ACCEPTANCE.md`). Star multiplier/crowd votes never reprice. **Keep:** the trade-verdict "fewer, better pieces" extra (`package-value.js`, `STAR_PREMIUM_KEY`). It changes a verdict, not a price, so it is not a second value system.

## Scope

- Do everything in the audit table: pipeline, data checks, app, Netlify functions, docs.
- One caveat line wherever a connected league differs from 12-team SF PPR dynasty (e.g. a 10-team 1QB league): "Values are built for 12-team Superflex PPR dynasty. Your league is 10-team 1QB, so treat QB values with care." Detect this from `league.total_rosters`, `roster_positions` and `scoring_settings.rec`. It is display only.
- Old links keep working: `?fmt=1qb`, `/t/` codes with `q`, saved drafts in local storage that stored a 1QB basis.
- Regenerate `docs/data/player_values.json` with the SF-only build, via the refresh workflow or locally (`python3 player-values/build.py`), and run `python3 scripts/check_market_files.py` (data-integrity check; allowed under the no-tests policy).

## Out of scope

- Changing the forecast model itself, beyond dropping the 1QB branch.
- Removing whole features (ticket 045).
- New pages (other tickets).

## Acceptance criteria (manual QA)

- No SF/1QB, format or TE-premium control appears anywhere on the site at 390, 820 or 1280 px (walk Home, Trade Calc, Rankings, a player page, a connected league).
- Searching the served JS for `oneQb` (DevTools → Sources search) finds nothing, apart from back-compat decoding of old share codes and old snapshots, marked with a comment.
- With a 1QB league connected, values, ranks and trade verdicts equal the ones shown with no league connected, and the caveat line appears.
- An old `/trade?give=…&get=…&fmt=1qb` link and an old `/t/` link with a `q` code both open, with the note, on SF values.
- `player_values.json` has `sf` and no `oneQb`, and `scripts/check_market_files.py` passes. The PR lists the top-50 before/after and any RB/WR/TE moves from the replacement change.
- AGENTS.md carries the one-value-system rule (added in the ticket-set commit). `README.md` and `player-values/*.md` no longer mention two maps.

## Dependencies

- 024 (so the new pages are built on one system). Blocks 026–032 and 037–042 value displays. Coordinate with 045 (crowd call / trade-poll).

## Technical notes

- Files are listed in the audit tables. Expect conflicts in `docs/app.js` with open PRs. Land this early.
- Data sources: Sleeper league `total_rosters`, `roster_positions` (`SUPER_FLEX`), `scoring_settings` (only for the caveat line); nflverse via `player-values/build.py`.
- No unit tests (repo policy). Data-integrity script + manual QA + demo video.

## Size estimate

**L**

## When this ticket is done

In the **same PR/commit as the work**:
1. `git mv tickets/todo/<this file> tickets/done/`.
2. Add a line at the very top, under the title: `Done: <YYYY-MM-DD>, <PR or commit link>`. Change **Status** to `Done`.
3. Move this ticket's row in `tickets/README.md` from **To do** to **Done**, and point its link at `done/`.
