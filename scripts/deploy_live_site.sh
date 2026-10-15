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

# Fail before touching Netlify if an expected function, edge function, or
# included_files entry is missing from the checkout.
node scripts/deploy_bundle_expect.mjs "$root"

# Keep in step with the bundler versions netlify-cli@NETLIFY_CLI_VERSION resolves.
NETLIFY_CLI_VERSION="27.12.1"

# VISIT_SALT and RATHER_SALT must exist on the Netlify site before functions
# boot. Missing or public defaults are replaced with a random secret.
# Already-set secrets are left alone. Values are not printed.
python3 scripts/ensure_netlify_salts.py

bash scripts/netlify_stop_git_builds.sh

npm ci

if [[ "${SKIP_MARKET_REFRESH:-}" != "1" ]]; then
  bash scripts/refresh_market_data.sh
fi

# npm test only warns when the snapshot is old. A live publish must not ship it.
python3 scripts/check_market_files.py --fail-on-age

message="${DEPLOY_MESSAGE:-Dynasty Ticker live deploy}"

# Pre-upload: run the CLI's own bundlers locally and check the output.
# `deploy --no-build` bundles edge functions itself (runCoreSteps
# edge_functions_bundling) and zips functions with included_files, so this
# checks exactly what the upload will carry. Nothing is uploaded here.
bundle_tools="$(mktemp -d)"
npm install --prefix "$bundle_tools" --no-save --no-audit --no-fund --silent \
  @netlify/config@25.2.6 @netlify/zip-it-and-ship-it@16.3.0 @netlify/edge-bundler@16.1.3
cp scripts/verify_deploy_bundle.mjs "$bundle_tools/"
node "$bundle_tools/verify_deploy_bundle.mjs" "$root"

# NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID stay in the environment.
# The CLI reads both. Do not put the token on the command line.
# --skip-functions-cache: never reuse zips from an old .netlify/functions manifest.
npx --yes "netlify-cli@${NETLIFY_CLI_VERSION}" deploy \
  --prod \
  --dir=docs \
  --functions=netlify/functions \
  --no-build \
  --skip-functions-cache \
  --message="$message"
