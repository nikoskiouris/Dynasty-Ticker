# 021 · Navigation decision tree: trustworthy verdict, Find a trade that answers, one nav, a player page

Closed (superseded): 2026-11-13. See the Superseded section.

## Status
Superseded (closed, not built)

## Priority
P0

## Area
`docs/modules/package-value.js`, `docs/modules/trade-share.js`, `docs/modules/sample-league.js`, `docs/modules/shop-player.js`, `docs/modules/trade-talk.js`, `docs/modules/ranks.js`, `docs/app.js`, `docs/index.html`, `docs/ui/*.html`, `docs/styles.css`

## Description
Designer and Consumer audits of the 3-tab site (Oct 31, 2026). Check a trade is strong. The rest does not yet answer "which move should I make?": the verdict can flip on a tiny change, shared links can show a different % than the sender saw, Find a trade dead-ends, the sample league is a real league with real usernames, desktop shows two tab rows and phone hides the tabs, My team buries its verdict, and every player link opens the calculator. Owner decisions: no example trade on home (#180), and yes to a stand-alone player page.

## Why
AGENTS.md: truthful answers first, then understandable completion of the task, then reliable phone and iPad use.

## Acceptance
- A swap worth up to 2% of the larger side never jumps Fair to Lopsided. Gibbs for Nabers + two early 1sts + Warren, then Odunze, stays Fair.
- A shared league trade with a projected "mid 1st" shows the sender's totals and %.
- Find a trade runs ideas on its own. Every idea says what it improves and its fairness band, and opens in Check a trade as Fair or a slight edge. Shop a player lists fair offers. No text points at a missing control.
- Try the sample league shows only invented managers and team names.
- One tab bar at every width; a fixed three-item bottom bar on phones; no "Sections"; no League home. Tabs never redirect: with no league they preview and offer a username box and the sample. With a league the order is My team · Find a trade · Check a trade.
- My team leads with the contend-or-rebuild call and playoff odds, then "Your next move" with a button into Find a trade for that position. Starters/Bench/Picks/Age appears once.
- Check a trade shows one verdict ("You give X% more"), the reason under "Why?", no league box without a league, and no 48-row list under the calculator.
- Player names on idea cards, Shop results and trade sides open the player page: value and trend, role and age context, "Check a trade with" and "Shop". Back returns with the trade intact.
- "Two 2nds" adds two picks in league mode. "What could I get for X" never replaces the current trade.

## Leftover
- Near the very top of the market the stud curve is steep: a 2% bump to the best player can still move two bands (Fair to Favors). It no longer skips to Lopsided. Smoothing that further changes the pricing model and needs an owner decision.
- Not built yet: tiered pick search ("2027 early 2nd"), roster-row player links on My team, an accessibility scan of every tab, a distinct /players address for the board.

## Superseded
UI redesign from the owner's sketches, Nov 13, 2026 (tickets 024–045): Home tool picker, global ☰ menu, Trade Calc, Player Rankings and a player page, League History. Its open items are covered there (fairness verdict 029, one nav 025, player page 032). Find a trade is deleted (045). Not built as written.
