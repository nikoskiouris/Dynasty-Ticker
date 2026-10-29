---
name: ship-with-demo
description: Every Dynasty Ticker change ships with a demo video. Use after tests pass, before the PR is created or updated.
---

# Ship with a demo

- Test the change yourself first. The demo shows a working change; it does not replace tests.
- Record a demo video for every change, every time. Show what changed and how it works, in a real browser against `npm run serve`.
- Walk the real journey for the change: the page a user starts on, the action, and the result. Use the sample league (`/?sample=1`) when the change touches league context.
- Short captions on screen say what each step shows. Plain words, one idea per caption.
- Keep it short: cut loading waits. Aim for under 90 seconds.
- If the change is only visible at phone size, record at 390x844. Otherwise 1280x1000 is fine.
- A change with nothing to see (tests, scripts, data jobs) still gets a short video: the terminal or the page that shows the result.
- Save the video as an `.mp4` under `/opt/cursor/artifacts/`. Embed it in the PR body with `<video src="/opt/cursor/artifacts/<name>.mp4"></video>`, and in the final reply.
- Never invent results. If a step fails on camera, fix it or say so.

## How

Playwright can record a scripted walk:

```js
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, recordVideo: { dir: "/tmp/demo", size: { width: 1280, height: 1000 } } });
```

Type with `page.type(selector, text, { delay: 55 })` so viewers can follow. Close the context to finish the `.webm`, then convert and trim with ffmpeg:

```bash
ffmpeg -y -ss <seconds-to-skip> -i /tmp/demo/<file>.webm -c:v libx264 -pix_fmt yuv420p -crf 22 /opt/cursor/artifacts/<name>.mp4
```

Check a few frames before you ship it.
