#!/usr/bin/env bash
# Publish this checkout to dynastyticker.com via Netlify CLI.
# Runs the scrape on GitHub Actions, then uploads docs/ + functions.
# Git-connected Netlify builds stay stopped; this is a file upload, not a git job.
set -euo pipefail

if [[ -z "${NETLIFY_AUTH_TOKEN:-}" || -z "${NETLIFY_SITE_ID:-}" ]]; then
  echo "Missing NETLIFY_AUTH_TOKEN or NETLIFY_SITE_ID." >&2
  echo "GitHub → Settings → Secrets and variables → Actions:" >&2
  echo "  NETLIFY_AUTH_TOKEN  Netlify user access token" >&2
  echo "  NETLIFY_SITE_ID     Site API ID from Netlify → Site configuration" >&2
  exit 1
fi

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

# VISIT_SALT and RATHER_SALT must exist on the Netlify site before functions
# boot. Missing or public defaults are replaced with a random secret.
# Already-set secrets are left alone. Values are not printed.
python3 scripts/ensure_netlify_salts.py

bash scripts/netlify_stop_git_builds.sh

npm install

if [[ "${SKIP_MARKET_REFRESH:-}" != "1" ]]; then
  bash scripts/refresh_market_data.sh
fi

message="${DEPLOY_MESSAGE:-Dynasty Ticker live deploy}"

npx --yes netlify-cli@27 deploy \
  --prod \
  --dir=docs \
  --functions=netlify/functions \
  --no-build \
  --site="$NETLIFY_SITE_ID" \
  --auth="$NETLIFY_AUTH_TOKEN" \
  --message="$message"
