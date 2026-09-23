# Dynasty Ticker

Sleeper dynasty league ticker: live scores, standings, playoff odds, awards, archive, trade match, and a trade lab. Values are built from Sleeper dynasty trades across many leagues, mixed with KeepTradeCut. The site is static. It talks to Sleeper from the browser.

## What is in this repo
- **Web app:** `docs/` — League Command Center at [dynastyticker.com](https://dynastyticker.com/).
- **Kernels:** `docs/modules/` — parse, Sleeper client, values, live poll, season engine.
- **Tests:** `tests/` — Node + Python. Run `npm test`.
- **Python CLI:** `src/` — still there if you want terminal trade suggestions.

## Web app

Open `docs/` locally (`npm run serve`) or [dynastyticker.com](https://dynastyticker.com/).

1. Type a **Sleeper username** and press **Find leagues**.
2. Pick the league.
3. League ID / URL still lives behind “Have a league ID or URL instead?”

Share URLs are ordinary query strings: `?league=&me=&tab=&view=&week=&tone=`. `tab` is the page, `view` is the room inside it. Old links (`tab=trader`, `tab=analytics`, `tab=team`, `view=passport`, `tab=recap`, ...) still resolve.

### Pages
Three pages. Each page has a row of rooms under it, so every feature is at most two taps away. Opening a league (or tapping the logo / home icon) lands on the start jobs screen, which is not a League subtab.

1. **League** — this season.
   - **Scores** — live scoreboard with pre-game win%, pulse tiles that jump to the right room.
   - **Standings** — overall / divisions, all-play, luck index.
   - **Power** — dynasty value board (starters, depth, picks, age). Tap a team to open its scout card.
   - **Awards** — weekly honors (marked live if the week is still going) and season superlatives.
   - **League History** — last season's champion, title hall, and a short record book.
2. **Teams** — every roster.
   - **Roster** — tap any team: power scout card, optimal lineup, bench, nicknames, pick vault, season log, jump into a trade.
   - **Call** — tank, all in, or stay in the middle, from playoff odds, lineup rank, age, and pick capital.
   - **Loyalty** — kept / gone / new since last season, iron share, DNA keep rate.
   - **Player passport** — who owned each player, season by season.
   - **Mock** — Dynasty Nerds Superflex 2-round rookie mock. 1sts and 2nds get names; 3rds stay pick labels.
   - A **Viewing** picker on Loyalty and Passports switches which roster you are looking at.
3. **Trades** — deals.
   - **Calculator** — blank board: search any player or pick in one box.
   - **Ranks** — player and pick values. Open a name for the pick he equals, crowd versus Sleeper trades, and who has him in this league. The same board opens from the landing page with no league.
   - **Partners** — one recommended trade per complementary roster: send this for that, and the starting lineup rank change.
   - **Two teams** — build both sides from two rosters and get a verdict.
   - **Find deals** — shop an asset, target a player, or generate a blockbuster.
   - **Log** — graded trade log with the trade wire. Tap a row to open the trade file (record since, market now, later finishes). Optional league board reads this room’s taste.

### Live Sunday scores
The app polls Sleeper matchups on the NFL window (Thu–Mon UTC) and whenever the current week already has points. Scoreboard, ticker, and awards refresh. The 4000-season Monte Carlo does **not** rerun on every point tick. It refreshes when a week finals, remaining games change, or ~3 minutes have passed.

### Value source
Sleeper trades first, KeepTradeCut as the prior:
- Superflex vs 1QB KeepTradeCut files (`docs/data/ktc_values_sf.csv`, `docs/data/ktc_values_1qb.csv`), plus optional `ktc_values.json`.
- Sleeper trade market (`docs/data/sleeper_trade_values.json`) fitted from completed dynasty trades snowballed from public leagues.
- Those two are blended so frequently traded players follow the Sleeper market; thin names stay closer to KeepTradeCut.
- Optional **league board** inferred from this league’s own trades (positions, youth, boom-bust skill players, and specific names). Apply it when you want room prices.
- TE premium bump only when Sleeper has extra TE reception points (`bonus_rec_te` / `rec_te`). Plain PPR Superflex is not TEP.
- Missing assets get a position/age estimate labeled **est**.
- Elite players still get a premium so one star is not a pile of scraps.

Refresh rankings with `python scripts/update_ktc_values.py`. Refresh the Sleeper trade market with `python scripts/update_sleeper_trade_market.py`. Refresh the 2027 Superflex rookie mock with `python scripts/update_dynasty_rookie_mock.py` (Dynasty Nerds 2-round board; 1sts and 2nds get names, 3rds do not). A Monday GitHub Action commits that JSON to `develop` if the board changed. It does not publish the live site. Live deploys try the scrapes and keep the last files if a source is down.

## Live site (dynastyticker.com)

The live app is a static site on **Netlify**. Public URL: `https://dynastyticker.com/`. Unreleased `develop` also goes to GitHub Pages as a preview: `https://nikoskiouris.github.io/Dynasty-Ticker/`.

**Work on `develop`. Live site updates only when `develop` is merged into `prod`.** That merge cuts a GitHub Release. GitHub Actions then scrapes market files and uploads with the Netlify CLI. Merges to `develop` (or leftover `main`) do not publish.

Netlify emails on a GitHub merge do **not** mean credits were spent. On credit plans, a **successful production deploy** costs 15 credits. Skipped, canceled, and failed git deploys cost 0, but they still start a job and still email you. **Stop builds** (not “stop auto publishing”) is the switch that prevents the job from existing. This repo turns that on through the Netlify API. Bandwidth, web requests, and functions still use credits when people visit the site.

1. GitHub → **Settings → General → Default branch:** `develop`.
2. Open [Netlify](https://app.netlify.com/), sign up with GitHub, **Add new site → Import an existing project**, pick this repo.
3. Netlify reads `netlify.toml` (`publish = docs`). First deploy gives a `*.netlify.app` URL.
4. **Domain management → Add custom domain:** `dynastyticker.com` and `www.dynastyticker.com`.
5. In **Namecheap** (you just bought this name there), paste the DNS records Netlify shows. Apex `A` / `www` `CNAME`. Wait for SSL.
6. Repo **Settings → Secrets and variables → Actions**, add:
   - `NETLIFY_AUTH_TOKEN` — Netlify user access token (User settings → Applications → New access token).
   - `NETLIFY_SITE_ID` — Site API ID (Site configuration → Site details).
7. GitHub Actions runs `.github/workflows/stop-netlify-git-builds.yml` so Netlify **Build status = Stopped builds**. Confirm in Netlify: **Project configuration → Build & deploy → Continuous deployment → Build settings → Stopped builds**. Do **not** use “Stop auto publishing”; that still starts a canceled production job. `netlify.toml` skip/refuse scripts are only a backup.
8. Repo **Settings → Pages**: source is **GitHub Actions**. `.github/workflows/preview-pages.yml` publishes `docs/` from `develop` to `https://nikoskiouris.github.io/Dynasty-Ticker/`. That URL is the unreleased preview. Do **not** add a custom domain there. Visit counts and rather votes stay on dynastyticker.com only.

Cut a release: open a PR from `develop` into `prod` and merge it (or push `develop` to `prod`). Workflow `.github/workflows/cut-release.yml` publishes a GitHub Release. `.github/workflows/deploy-release.yml` then uploads `docs/` plus functions with the Netlify CLI. Optional manual refresh of the last release: `.github/workflows/deploy-site.yml`. Tests: `.github/workflows/test.yml`. Unreleased preview: `.github/workflows/preview-pages.yml`.

### Traffic

Two different numbers. Do not mix them. Do not buy another tracker.

1. **Netlify Web Analytics — how many people hit the site.** Already on. In the project sidebar: **Analytics & metrics → Web analytics**. Unique visitors are distinct IP addresses. Pageviews are real page loads, not the WordPress scan 404s (those sit under resources-not-found). It updates about hourly. Ad blockers do not hide visits. The free window is about 7 days. The 30-day range costs extra. Skip it for now. Do not use **Observability** for the user count. That one includes bots. **Real user monitoring** is page speed, not users.

   A week in mid-September 2026 read **557 unique visitors** and **879 pageviews**, almost all on `/` because the desk is one page. Treat that as roughly **400 real people** that week, not 557 humans. China, Germany, and Singapore add scanner IPs. Someone on Wi-Fi and cell data can count twice.

2. **Desk tally — who actually used the app.** Netlify cannot see this, because a league load, a vote, and a bounce are all `/`. The live site POSTs to `/api/visit` (same host, no cookies, no Google Analytics). Print it with:

```
python3 scripts/desk_visits.py
```

- **views** — full page loads that ran JavaScript. Reloads count. Obvious crawlers do not.
- **people** — distinct browsers. A random id in localStorage (`dynasty_ticker_visitor`) is hashed and stored. The same browser counts once per period even if the IP changes. Two browsers are two people. Private windows and cleared storage look new. If storage is blocked, the fallback is a hash of IP plus user-agent, which can merge people on one network.
- **active** — people who loaded a league or saved a “who would you rather have” pick. A landing-page bounce is a view and a person, not active.
- **days** — the last 14 US Eastern dates. Today and the week start at midnight Eastern. The week is Monday–Sunday.
- **sources** — referring site host only. Direct means no referrer, or a hop from this site.
- **landings** — home, shared league link, or legal page. The league id is not stored.

Today, this week, this calendar year, and all-time are the four periods. A failed save retries with the same event id so a blip does not double-count.

This people number will not match Netlify’s 557. Netlify counts IPs that downloaded the page. The desk counts browsers that ran it, then marks who loaded a league or voted.

Switching people from IP + browser to a browser id makes each existing browser look new once. All-time people steps up by the returning browsers. After that it stays put.

The old third-party `page-views-api.ratneshc.com` counter is retired. It only counted a browser once, missed private windows, and could not tell traffic from people.

### Searched usernames

The live site saves a Sleeper username only after someone searches it **and one of that user's leagues actually opens**. A click and a one-league auto-open both count. A typo never opens a league, so it is never saved. The saved name is the one Sleeper returns, so a misspelling stays on the same row instead of becoming a new person. A search that only shows the league list, a league ID / URL load, and a shared link save nothing.

The list is one CSV in Netlify Blobs: store `desk-users`, key `searched-users.csv`. One row per username:

```
username,user_id,first_seen,last_seen,searches
```

- **username** — lowercase Sleeper username, as Sleeper returned it (not what was typed).
- **user_id** — Sleeper user id. It stays the same if the username changes.
- **first_seen / last_seen** — UTC.
- **searches** — how many searches ended in a loaded league. Opening a second league from the same results does not count twice.

Download it from Netlify: **Data & Storage → Blobs → desk-users → searched-users.csv**. Or from a terminal, after `npm install`:

```
NETLIFY_AUTH_TOKEN=... NETLIFY_SITE_ID=... node scripts/searched_users.mjs
```

That writes `searched-users.csv` (gitignored). **This repo is public. Never commit that file.** There is no public URL for the list; `/api/searched-user` only accepts writes from dynastyticker.com. Localhost and the GitHub Pages preview never send a username.

## CLI

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python -m src.cli \
  --league <LEAGUE_ID> \
  --me niko \
  --target-manager demetri \
  --target-player "Jahmyr Gibbs" \
  --allow-extra-target-assets \
  --fairness-pct 15 \
  --max-results 5
```

No league id? Discover it:

```bash
python -m src.cli \
  --username <YOUR_SLEEPER_USERNAME> \
  --season 2026 \
  --me niko \
  --target-manager demetri \
  --target-player "Jahmyr Gibbs"
```

## Notes
- Player assets: `player:<sleeper_player_id>`
- Pick assets: `pick:<season>:r<round>:<original_owner|any>`
- Playoff odds are a 4000-season Monte Carlo. Each simulated season draws team quality from the posterior, so a Week 1 favorite is not a 100% lock. 100% / 0% only appear when a team has mathematically clinched or been eliminated.
- Phone layout (`max-width: 700px`) sticks the four page tabs under the header and pins the room strip to the bottom edge. A share button sits in the header. iPad and desktop keep the tabs inline above the room strip.
