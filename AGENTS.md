# Agent instructions

## Cursor Cloud specific instructions

- Test changes yourself.
- Record a short screen video of the working change and show it to the user.
- After tests pass, commit, push, update the PR, and keep moving.

## Git branches

- Open PRs against **`develop`**. That is the working branch.
- Do **not** merge feature work into `prod` or leftover `main`.
- Promote `develop` → `prod` only when the user asks to cut a release.

## Live site releases

- Merging to `develop` (or leftover `main`) must **not** publish [dynastyticker.com](https://dynastyticker.com/). Netlify git builds are **stopped** at the site (`stop_builds`). Ignore scripts are only a safety net if someone turns builds back on.
- Pushing or merging `develop` into `prod` cuts a GitHub Release. That runs `.github/workflows/deploy-release.yml`, which calls `scripts/deploy_live_site.sh`.
- Do not trigger a production deploy unless the user explicitly asks to cut a release / promote to prod.
- Do not run a scheduled Netlify production deploy. Market files refresh when a release is cut.
- Local check: `npm run serve` (or `npm test`). Do not burn Netlify credits for preview deploys.
