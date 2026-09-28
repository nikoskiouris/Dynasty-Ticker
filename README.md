# Dynasty Ticker

Sleeper dynasty league ticker: live scores, standings, playoff odds, awards, archive, trade match, and a trade lab. Player values come from Dynasty Ticker's independent full-PPR football forecast. The site is static. It talks to Sleeper from the browser.

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
Three jobs. Players and Trade work before a league is connected.

1. **Players** — search a name, see the value, add him to a trade. Voting is optional underneath.
2. **Trade** — one calculator (you give / you get) and one trade draft. It works before you connect. Connect Sleeper and the same trade stays put: each piece shows who owns it, and when you give yours and get from one team, both rosters' lineup impact appears. Find a trade shops, targets, or finds a partner, then **Review trade** opens that same draft. The draft lasts for the browser tab.
3. **My League** — your outlook and roster first. This week, the league table, activity, and history sit beside that. Tank-or-contend, who stayed, awards, and the mock live inside those views.

Product purpose and how to choose between competing asks live in `AGENTS.md`. First-visit usability tasks live in `research/first-visit-tasks.md`.

Old links (`tab=trader`, `tab=teams`, `view=calculator`, `view=ranks`, ...) still open the matching job.

### Live Sunday scores
The app polls Sleeper matchups on the NFL window (Thu–Mon UTC) and whenever the current week already has points. Scoreboard, ticker, and awards refresh. The 4000-season Monte Carlo does **not** rerun on every point tick. It refreshes when a week finals, remaining games change, or ~3 minutes have passed.

### Value source
There is one player-value system: `player-values/`.

- Two published maps: **1QB full PPR** and **Superflex full PPR**.
- Age, NFL experience, opportunity, efficiency, availability, team environment, draft investment for thin samples, and position-specific career retention feed an eight-season football forecast.
- Value is discounted usable PPR production above a reference alternative, converted with one fixed 20× display ruler.
- RB/WR/TE use the same player value in both formats. Superflex changes QB scarcity; future pick values can also differ by format.
- No KTC values, fitted Sleeper-trade prices, TE/RB scoring premiums, crowd-vote price shifts, star multipliers, league-specific prices, or age/position fallback guesses feed the published player price.
- Players, Trade, My League, trade matching, and the Python CLI all read `docs/data/player_values.json`.
- League trade history and crowd votes remain useful context/preferences, but they do not create a second player price.
- Package consolidation credit can still affect a trade verdict without changing any player's listed price.

The complete design and caveats live in `player-values/SPEC.md`; implementation details are in `player-values/README.md`. Refresh with `python3 player-values/build.py`. The refresh validates before atomically replacing the last good snapshot. The 2027 Superflex rookie mock remains a separate display feature and refreshes with `python3 scripts/update_dynasty_rookie_mock.py`.

## Live site (dynastyticker.com)

The live app is a static site on **Netlify**. Public URL: `https://dynastyticker.com/`. Unreleased `develop` also goes to GitHub Pages as a preview: `https://nikoskiouris.github.io/Dynasty-Ticker/`.

**Work on `develop`. Live site updates only when `develop` is merged into `prod`.** That merge cuts a GitHub Release. GitHub Actions then scrapes market files and uploads with the Netlify CLI. Merges to `develop` (or leftover `main`) do not publish the live site.

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
8. Repo **Settings → Pages**: source is **GitHub Actions**. A push to `develop` runs `.github/workflows/refresh-pages-preview.yml`, which starts `.github/workflows/preview-pages.yml` on `main`. That job checks out `develop` and publishes `docs/` to `https://nikoskiouris.github.io/Dynasty-Ticker/`. Pages only allows deploys from `main`. That URL is the unreleased preview. Do **not** add a custom domain there. Visit counts and rather votes stay on dynastyticker.com only.

Cut a release: open a PR from `develop` into `prod` and merge it (or push `develop` to `prod`). Workflow `.github/workflows/cut-release.yml` publishes a GitHub Release. `.github/workflows/deploy-release.yml` then uploads `docs/` plus functions with the Netlify CLI. Optional manual refresh of the last release: `.github/workflows/deploy-site.yml`. Tests: `.github/workflows/test.yml`. Unreleased preview: `.github/workflows/refresh-pages-preview.yml` starts `.github/workflows/preview-pages.yml` on `main`.

### Traffic

**Netlify Web Analytics** counts people who hit the site. In the project sidebar: **Analytics & metrics → Web analytics**. Unique visitors are distinct IP addresses. Pageviews are real page loads, not the WordPress scan 404s (those sit under resources-not-found). It updates about hourly. Ad blockers do not hide visits. The free window is about 7 days. The 30-day range costs extra. Skip it for now. Do not use **Observability** for the user count. That one includes bots. **Real user monitoring** is page speed, not users.

A week in mid-September 2026 read **557 unique visitors** and **879 pageviews**, almost all on `/` because the desk is one page. Treat that as roughly **400 real people** that week, not 557 humans. China, Germany, and Singapore add scanner IPs. Someone on Wi-Fi and cell data can count twice.

Who actually opened a league is the searched-username list below. The old desk tally and `/secret-numbers` page are gone. The old third-party `page-views-api.ratneshc.com` counter stays retired.

### Searched usernames

The live site saves a Sleeper username only after someone searches it **and one of that user's leagues actually opens**. A click and a one-league auto-open both count. A typo never opens a league, so it is never saved. The saved name is the one Sleeper returns, so a misspelling stays on the same row instead of becoming a new person. A search that only shows the league list, a league ID / URL load, and a shared link save nothing.

Each save reads the CSV already stored, adds a row or updates that username, and writes the full list back. Old rows stay. A save never replaces the file with only the newest name.

The list is one CSV in Netlify Blobs: store `desk-users`, key `searched-users.csv`. One row per username:

```
username,user_id,first_seen,last_seen,searches
```

- **username** — lowercase Sleeper username, as Sleeper returned it (not what was typed).
- **user_id** — Sleeper user id. It stays the same if the username changes.
- **first_seen / last_seen** — UTC.
- **searches** — how many searches ended in a loaded league. Opening a second league from the same results does not count twice. A repeat leaves every other username on the list.

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
