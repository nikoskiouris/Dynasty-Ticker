#!/usr/bin/env bash
# Copy docs/ into a throwaway tree for the GitHub Pages preview.
# The live site keeps its own robots.txt, sitemap, and Netlify redirects.
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
dest=${1:-"$root/_preview"}
if [[ "$dest" != /* ]]; then
  dest="$root/$dest"
fi

case "$dest" in
  "$root"|"$root/"|"$root/docs"|"$root/docs/"*)
    echo "Refusing to stage the Pages preview on top of the repo or docs/." >&2
    exit 1
    ;;
esac

rm -rf "$dest"
mkdir -p "$dest"
cp -a "$root/docs/." "$dest/"
printf 'User-agent: *\nDisallow: /\n' > "$dest/robots.txt"
rm -f "$dest/sitemap.xml" "$dest/_redirects"
: > "$dest/.nojekyll"
echo "Staged GitHub Pages preview at $dest"
