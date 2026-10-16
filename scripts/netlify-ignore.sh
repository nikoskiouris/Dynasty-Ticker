#!/usr/bin/env bash
# Netlify runs this before a git-connected build.
# Exit 0 = skip. Skip every git build (PR previews, branch deploys, merges).
# The daily player-value commit also says [skip netlify]. This script skips
# that commit even if the message is missing.
# Live publishes come from GitHub Actions when develop is promoted to prod.
# Build hooks ignore this script; scripts/netlify-git-build.sh fails those closed.
set -u
echo "Skipping Netlify git build (CONTEXT=${CONTEXT:-unset} BRANCH=${BRANCH:-unset})."
echo "Promote develop to prod to publish dynastyticker.com."
exit 0
