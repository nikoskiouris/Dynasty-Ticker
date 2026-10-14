#!/usr/bin/env bash
# Refuse to publish dynastyticker.com from anything but a prod GitHub Release.
# The tag must already exist, and its commit must be on the prod branch.
set -euo pipefail

tag="${1:-}"
pattern='^prod-[0-9]{8}-([0-9]{6}-|live-)[0-9a-fA-F]{7,40}$'
if [[ ! "$tag" =~ $pattern ]]; then
  echo "Refusing to publish '${tag}'." >&2
  echo "Live deploys only run from a prod-* GitHub Release. develop and main stay unpublished." >&2
  exit 1
fi

if [[ "${RELEASE_CHECK_DRY_RUN:-}" == "1" ]]; then
  echo "Release tag ok: $tag"
  exit 0
fi

repo="${GITHUB_REPOSITORY:?Missing GITHUB_REPOSITORY}"
token="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
if [[ -z "$token" ]]; then
  echo "Missing GH_TOKEN or GITHUB_TOKEN." >&2
  exit 1
fi
export GH_TOKEN="$token"

sha="$(gh release view "$tag" --repo "$repo" --json targetCommitish --jq .targetCommitish)"
if [[ ! "$sha" =~ ^[0-9a-fA-F]{7,40}$ ]]; then
  echo "Release $tag does not resolve to a commit (${sha:-missing})." >&2
  exit 1
fi

git fetch --no-tags origin prod
if ! git merge-base --is-ancestor "$sha" FETCH_HEAD; then
  echo "Release $tag ($sha) is not on prod. Refusing to publish." >&2
  exit 1
fi

echo "Release $tag is on prod ($sha)."
