#!/usr/bin/env python3
"""Write docs/sitemap.xml: the fixed pages plus one /player/<id>/<slug> page
per priced player in docs/data/player_values.json.

No <lastmod>: the file only changes when a player is added or dropped, so the
daily refresh doesn't commit a new sitemap every day. The slug matches
playerSlug() in docs/modules/history-route.js, which the app canonicalizes to.
"""
import json
import re
import unicodedata
from pathlib import Path
from xml.sax.saxutils import escape

REPO = Path(__file__).resolve().parent.parent
VALUES = REPO / "docs" / "data" / "player_values.json"
OUTPUT = REPO / "docs" / "sitemap.xml"
ORIGIN = "https://dynastyticker.com"
FIXED = [
    ("/", "weekly", "1.0"),
    ("/trade", "daily", None),
    ("/players", "daily", None),
    ("/leagues", "weekly", None),
]


def player_slug(name):
    text = unicodedata.normalize("NFKD", str(name or ""))
    text = re.sub(r"[̀-ͯ]", "", text).lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text[:80]


def player_urls(bundle):
    names, sf = bundle.get("names", {}), bundle.get("sf", {})
    rows = []
    for asset_id in bundle.get("players", {}):
        if not asset_id.startswith("player:"):
            continue
        sleeper_id = asset_id.split(":", 1)[1]
        slug = player_slug(names.get(asset_id))
        if not sleeper_id.isdigit() or not slug or not (sf.get(asset_id) or 0) > 0:
            continue
        rows.append((-(sf.get(asset_id) or 0), f"/player/{sleeper_id}/{slug}"))
    # Highest value first, so the list reads like the rankings.
    return [path for _, path in sorted(rows)]


def render(paths):
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for path, freq, priority in FIXED:
        extra = f"<priority>{priority}</priority>" if priority else ""
        lines.append(f"  <url><loc>{ORIGIN}{path}</loc><changefreq>{freq}</changefreq>{extra}</url>")
    for path in paths:
        lines.append(f"  <url><loc>{escape(ORIGIN + path)}</loc><changefreq>weekly</changefreq></url>")
    lines.append("</urlset>")
    return "\n".join(lines) + "\n"


def main():
    bundle = json.loads(VALUES.read_text(encoding="utf-8"))
    paths = player_urls(bundle)
    if not paths:
        print("No priced players found; leaving sitemap.xml alone.")
        return
    OUTPUT.write_text(render(paths), encoding="utf-8")
    print(f"sitemap.xml: {len(FIXED)} pages + {len(paths)} player pages")


if __name__ == "__main__":
    main()
