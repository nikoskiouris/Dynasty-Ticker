#!/usr/bin/env bash
# Cut a GitHub Release for the current commit.
# Called when prod is pushed. The published release then deploys the live site.
set -euo pipefail

token="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
if [[ -z "$token" ]]; then
  echo "Missing GH_TOKEN or GITHUB_TOKEN." >&2
  exit 1
fi
export GH_TOKEN="$token"

repo="${GITHUB_REPOSITORY:-}"
if [[ -z "$repo" ]]; then
  echo "Missing GITHUB_REPOSITORY." >&2
  exit 1
fi

sha="${GITHUB_SHA:-}"
if [[ -z "$sha" ]]; then
  echo "Missing GITHUB_SHA." >&2
  exit 1
fi

if [[ ! "$sha" =~ ^[0-9a-fA-F]{7,40}$ ]]; then
  echo "GITHUB_SHA looks invalid: $sha" >&2
  exit 1
fi

short="${sha:0:7}"
stamp="$(date -u +%Y%m%d-%H%M%S)"
tag="prod-${stamp}-${short}"
title="prod ${stamp} (${short})"
notes="Promote ${short} to production. Live site deploys from this GitHub Release."

if [[ "${CUT_RELEASE_DRY_RUN:-}" == "1" ]]; then
  echo "Would create release $tag for $sha on $repo"
  exit 0
fi

if gh release view "$tag" --repo "$repo" >/dev/null 2>&1; then
  echo "Release $tag already exists."
  exit 0
fi

# A re-run of this job must not cut a second release for the same commit.
# Two releases for one SHA publish the live site twice.
existing="$(gh api "repos/${repo}/releases?per_page=100" \
  --jq ".[] | select(.target_commitish==\"$sha\" and .draft==false) | .tag_name")"
if [[ -n "$existing" ]]; then
  echo "Release already points at $sha:"
  printf '%s\n' "$existing"
  exit 0
fi

gh release create "$tag" \
  --repo "$repo" \
  --target "$sha" \
  --title "$title" \
  --notes "$notes"

echo "Created release $tag"
