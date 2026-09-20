# Agent instructions

## Cursor Cloud specific instructions

Follow `.cursor/skills/ship-without-demos/SKILL.md`.

- Test changes yourself. Do not record demo videos or walkthrough artifacts.
- Do not upload videos for the user to watch.
- One screenshot is enough, and only if a visual result is hard to describe.
- After tests pass, commit, push, update the PR, and keep moving.

## Git branches

- Open PRs against **`develop`**. That is the working branch.
- Do **not** merge feature work into `prod` or leftover `main`.
- Promote `develop` → `prod` only when the user asks to cut a release.

## Tickets

Board is `tickets/`. **Do not delete ticket files** when they ship.

When a ticket is done:

1. Set `Status` to `Done` in the ticket file. Keep the rest of the file.
2. Add a `Shipped` line with the PR (`#57`).
3. Move the README row from Open to Done and link the PR.
4. Run `npm test` so `tests/tickets.test.js` agrees.

## Live site releases

- Merging to `develop` (or leftover `main`) must **not** publish [dynastyticker.com](https://dynastyticker.com/). Netlify git builds are **stopped** at the site (`stop_builds`). Ignore scripts are only a safety net if someone turns builds back on.
- Pushing or merging `develop` into `prod` cuts a GitHub Release. That runs `.github/workflows/deploy-release.yml`, which calls `scripts/deploy_live_site.sh`.
- Do not trigger a production deploy unless the user explicitly asks to cut a release / promote to prod.
- Do not run a scheduled Netlify production deploy. Market files refresh when a release is cut.
- Local check: `npm run serve` (or `npm test`). Do not burn Netlify credits for preview deploys.
