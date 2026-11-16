---
name: ship-with-demo
description: Every Dynasty Ticker change ships with a demo video. Use after manual verification, before the PR is created or updated.
---

# Ship with a demo

- Manually verify the change first. The demo shows what was checked; it does not count as automated testing.
- Record a demo video for every change, every time. Show what changed and how it works, in a real browser against `npm run serve`.
- Walk the real journey for the change: the page a user starts on, the action, and the result. When the change touches league context, load a real public Sleeper league by ID (`/l/<id>`); the sample league was removed (ticket 045).
- Short captions on screen say what each step shows. Plain words, one idea per caption.
- Keep it short: cut loading waits. Aim for under 90 seconds.
- If the change is only visible at phone size, record at 390x844. Otherwise 1280x1000 is fine.
- A change with nothing to see (tests, scripts, data jobs) still gets a short video: the terminal or the page that shows the result.
- Save the video as an `.mp4`: Cursor under `/opt/cursor/artifacts/` (embed it in the PR body with `<video src="/opt/cursor/artifacts/<name>.mp4"></video>`), Claude Code under `pr-artifacts/`. Mention it in the final reply.
- Never invent results. If a step fails on camera, fix it or say so.

## How

Use the screen recording or browser capture capability available in your agent environment, not a new test framework. For documentation or configuration-only changes, show the relevant diff and a terminal walkthrough. Do not reinstall Playwright or any other test runner merely to record the demo.

Save the video as an `.mp4` under `/opt/cursor/artifacts/`, and embed it in the PR when uploading is supported. Never invent results. If a manual check fails, fix it or explain the failure.
