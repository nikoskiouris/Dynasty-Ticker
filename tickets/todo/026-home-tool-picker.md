# 026 · Home page: "Which tool to use?" tool picker

**Status:** Open · **Priority:** P0 · **Size:** S · **Owner:** unassigned (Chief Of Staff or Claude)

## Context / sketch description

Sketch 1: the home page is simple.

- Title **"Dynasty Ticker"**
- Prompt **"Which tool to use?"**
- Three big choices: **Trade Calc**, **Player Rankings**, **League History**
- Footnote: **"All info on this page is optimized for 12 team SF PPR Dynasty."**

Today `/` opens the calculator (`ROUTES` "home" → trades/calculator), and a separate launch landing (`docs/ui/landing.html`, `#landing`) shows "Is your trade fair? What should you trade for?", a plain-words trade box, connect/sample/look-up-a-player actions, an example trade and "hot on Sleeper" trend rows (`launch-landing.js`, `loadLaunchSurface()`, `paintLaunchExample()`, `paintLaunchTrend()`).

## Scope

- Replace the landing content with the sketch: heading "Dynasty Ticker", sub-heading "Which tool to use?", three large tappable cards linking to `/trade`, `/players`, `/leagues` (or the remembered league hub).
- Each card has a one-line hint (suggested: "Is this trade fair?", "Every player, ranked", "Your Sleeper league's story").
- Footnote exactly: "All info on this page is optimized for 12 team SF PPR Dynasty." This is the official rule now (ticket 044): the site has one value system, 12-team Superflex PPR dynasty.
- Keep the ☰ menu (ticket 025) and the footer Privacy/Terms links.
- Returning managers: keep the existing resume line (`renderLandingResume()` / `#landing-resume`) above the cards if a league is remembered.
- Update `<title>`, meta description and the OG card copy for `/` if they still describe the calculator.

## Out of scope

- The landing's "Try the sample league" action is deleted (owner decision Nov 13, ticket 045).
- The landing's example trade and "hot on Sleeper" trend rows are **deleted**, per the owner decision of Nov 13 (ticket 045). The plain-words trade box moves into Trade Calc's smart search (028).

## Acceptance criteria (manual QA)

- Opening `dynastyticker.com/` shows the title, "Which tool to use?", three cards and the footnote, with nothing else competing above the fold at 390, 820 and 1280 px.
- Each card opens its tool; Back returns to Home.
- With a remembered league, a "Back to <league name>" resume link shows and works.
- The page paints without waiting for player values or Sleeper (no spinners on Home).

## Dependencies

- 024 (routes), 025 (menu), 044 (the footnote must be true), 045 (landing extras removed).

## Technical notes

- Files: `docs/ui/landing.html`, `docs/modules/launch-landing.js`, `docs/app.js` (`bootLaunchSurface`, `loadLaunchSurface`, `syncLaunchChrome`, `handleLaunchClick`, `renderLandingResume`, `landingVisible`), `docs/modules/jobs.js` (`DESK_JOBS` may become the three tools), `docs/styles.css`, `docs/index.html` meta tags, `docs/boot.js` / `boot-intent.js` (first paint).
- No unit tests (repo policy). Manual QA + demo video.

## Size estimate

**S**

## When this ticket is done

In the **same PR/commit as the work**:
1. `git mv tickets/todo/<this file> tickets/done/`.
2. Add a line at the very top, under the title: `Done: <YYYY-MM-DD>, <PR or commit link>`. Change **Status** to `Done`.
3. Move this ticket's row in `tickets/README.md` from **To do** to **Done**, and point its link at `done/`.
