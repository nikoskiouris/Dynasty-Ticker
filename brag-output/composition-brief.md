# Hyperframes Composition Brief: Dynasty Ticker

## Objective
Create a short launch-style brag video for Dynasty Ticker.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 20 seconds

## Source Material
- Project root: `/workspace`
- Primary files read: `docs/index.html`, `docs/styles.css`, `README.md`, `docs/app.js` (calculator verdict copy)
- Product name: Dynasty Ticker
- Tagline / strongest claim: Your league. Pick a job.
- Key UI or visual moment to recreate: landing job list, live scoreboard, desk verdict
- Copy that must appear verbatim:
  - Your league. Pick a job.
  - Sleeper dynasty league
  - See this week
  - Scout a team
  - Make a trade
  - League history
  - Find leagues
  - Find the other window
  - Desk verdict
  - Fair, leans your way
  - You send
  - You receive
  - Deals have to help the lineup, not swap leftover thirds.
  - 4,000-season playoff odds

## Creative Direction
- Tone preset: default
- Creative direction: sports desk launch, ticker energy
- Interpretation: short lines, soft motion, the product's own voice
- Angle: the league is a live desk. Pick a job. The ticker answers.
- Hook: "Your league. Pick a job."
- Outro / punchline: wordmark, "Pick a job.", dynastyticker.com
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign
  - Real league names, real manager names, emails, or private stats

## Visual Identity
- Background: #071018
- Text: #e7f4f1
- Accent: #2ee6c5
- Panel: #0e1a24
- On-accent: #06211c
- Display font: Inter (local woff2)
- Body font: Inter
- Visual references from the project: dark desk, mint accent, wordmark on dark, job buttons, ticker, verdict card

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. Hook — 3.30s — "Your league. Pick a job."
2. Pick a job — 5.80s — username types, four jobs arrive
3. Live scores — 4.10s — two matchups and 4,000-season odds
4. Desk verdict — 3.90s — You send / You receive, stamp "Fair, leans your way"
5. Wordmark — 2.90s — logo on the 18.01s cue

## Audio
- Audio role: warm bed
- Audio arc: fade in, hold, fade under the logo
- Music: `happy-beats-business-moves-vol-10-by-ende-dot-app.mp3`
- Music treatment: volume envelope 0 → 0.34 by 0.45s, hold, down to 0 by 19.85s
- Music cue guidance: bundled preset for vol-10. Strong locks at 15.82 (verdict) and 18.01 (wordmark). Job rows and score rows on the beat grid, every other beat.
- Audio-reactive treatment: subtle. Bass band drives the live dot and a mint glow. Extracted with hyperframes-creative `extract-audio-data.py`.
- Audio-coupled moments:
  - hook second line — soft impact
  - job rows — short clicks
  - scoreboard — soft impact
  - verdict stamp — soft impact
  - wordmark — bong
- SFX selection guidance: low HF-risk files from `sfx-analysis.md`
- SFX analysis guidance: `/tmp/brag/skills/brag/assets/sfx/sfx-analysis.md`
- Exact SFX choice: impactSoft_medium_001, click_003, impactSoft_medium_004, impactSoft_medium_002, bong_001
- Audio files: copied into `brag-output/composition/assets/`

## Hyperframes Instructions
Composition is a standalone `index.html`. Local GSAP. Dark theme colors from the site. Fictional stand-in league data only. `npx hyperframes check` is the gate before render. Keep the render local.
