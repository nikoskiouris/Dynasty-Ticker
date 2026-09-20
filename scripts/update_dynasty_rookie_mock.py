#!/usr/bin/env python3
from __future__ import annotations

import argparse
import html
import json
import re
from datetime import date
from pathlib import Path
from urllib.request import Request, urlopen

DEFAULT_URL = "https://www.dynastynerds.com/dynasty/2027-sf-rookie-mock-draft-2-rounds/"
OUTPUT_PATH = Path("docs/data/nfl_mock_drafts.json")
USER_AGENT = "dynasty-ticker-rookie-mock"
SKILL_POSITIONS = {"QB", "RB", "WR", "TE"}
MAX_ROUND = 2
MIN_PICKS = 20
H3_RE = re.compile(r"<h3\b[^>]*>(.*?)</h3>", re.I | re.S)
PICK_RE = re.compile(
    r"^\s*(\d+)\.(\d+)\s*\|\s*(.+?)\s*\|\s*([A-Za-z]{1,5})\s*\|\s*(.+?)\s*$"
)
JSON_LD_RE = re.compile(
    r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
    re.I | re.S,
)
YEAR_RE = re.compile(r"\b(20\d{2})\b")


def http_get(url: str, timeout: int = 30) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", "replace")


def strip_tags(text: str) -> str:
    return re.sub(r"<[^>]+>", " ", text)


def clean_text(text: str) -> str:
    decoded = html.unescape(strip_tags(text))
    return re.sub(r"\s+", " ", decoded).replace("\xa0", " ").strip()


def parse_picks(html_text: str) -> list[dict]:
    picks: list[dict] = []
    seen: set[tuple[int, int]] = set()
    for raw in H3_RE.findall(html_text or ""):
        match = PICK_RE.match(clean_text(raw))
        if not match:
            continue
        round_, slot, name, pos, school = match.groups()
        round_n = int(round_)
        slot_n = int(slot)
        position = pos.upper()
        player = name.strip(" |-")
        college = school.strip(" |-")
        if round_n < 1 or round_n > MAX_ROUND or slot_n < 1:
            continue
        if position not in SKILL_POSITIONS or not player:
            continue
        key = (round_n, slot_n)
        if key in seen:
            continue
        seen.add(key)
        picks.append({
            "round": round_n,
            "slot": slot_n,
            "name": player,
            "pos": position,
            "school": college,
        })
    picks.sort(key=lambda row: (row["round"], row["slot"]))
    return picks


def iter_json_objects(value):
    if isinstance(value, list):
        for item in value:
            yield from iter_json_objects(item)
    elif isinstance(value, dict):
        yield value
        for item in value.values():
            yield from iter_json_objects(item)


def parse_article_meta(html_text: str) -> dict:
    meta = {"title": "", "author": "", "date": ""}
    for raw in JSON_LD_RE.findall(html_text or ""):
        try:
            payload = json.loads(html.unescape(raw))
        except json.JSONDecodeError:
            continue
        for obj in iter_json_objects(payload):
            kind = obj.get("@type")
            types = {kind} if isinstance(kind, str) else set(kind or [])
            if not types.intersection({"Article", "BlogPosting"}):
                continue
            headline = str(obj.get("headline") or obj.get("name") or "").strip()
            if headline and not meta["title"]:
                meta["title"] = headline
            published = str(obj.get("datePublished") or "")[:10]
            if re.fullmatch(r"20\d{2}-\d{2}-\d{2}", published):
                if published > meta["date"]:
                    meta["date"] = published
            author = obj.get("author")
            if isinstance(author, dict):
                name = str(author.get("name") or "").strip()
            elif isinstance(author, list) and author:
                first = author[0]
                name = str(first.get("name") if isinstance(first, dict) else first).strip()
            else:
                name = str(author or "").strip()
            if name and not meta["author"]:
                meta["author"] = name
    if not meta["title"]:
        title_match = re.search(r"<title[^>]*>(.*?)</title>", html_text or "", re.I | re.S)
        if title_match:
            meta["title"] = clean_text(title_match.group(1))
    return meta


def season_from(url: str, title: str, fallback: int = 2027) -> int:
    url_match = re.search(r"/((?:20)\d{2})-", url or "")
    if url_match:
        return int(url_match.group(1))
    title_match = YEAR_RE.search(title or "")
    if title_match:
        return int(title_match.group(1))
    return fallback


def build_payload(html_text: str, url: str = DEFAULT_URL, scraped_on: str | None = None) -> dict:
    picks = parse_picks(html_text)
    if len(picks) < MIN_PICKS:
        raise ValueError(f"Need at least {MIN_PICKS} skill-position picks, got {len(picks)}")
    meta = parse_article_meta(html_text)
    season = season_from(url, meta["title"])
    article_date = meta["date"] or (scraped_on or date.today().isoformat())
    rounds = max(pick["round"] for pick in picks)
    return {
        "season": season,
        "rounds": rounds,
        "round": rounds,
        "completedNflDraftYear": season - 1,
        "updated": article_date,
        "note": (
            "Dynasty Nerds SF TEP 2-round rookie mock. Overlay next-year 1sts and 2nds "
            "from current place. 3rds stay pick labels. College names have no trade value."
        ),
        "mocks": [
            {
                "id": "dynasty-nerds-sf",
                "source": "Dynasty Nerds",
                "short": "Dynasty Nerds",
                "author": meta["author"] or "Keith Ensminger",
                "date": article_date,
                "url": url,
                "format": "superflex",
                "picks": picks,
            }
        ],
    }


def write_payload(payload: dict, path: Path = OUTPUT_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Refresh the stored Dynasty Nerds SF rookie mock.")
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--html", help="Local HTML fixture instead of fetching --url")
    parser.add_argument("--output", default=str(OUTPUT_PATH))
    args = parser.parse_args(argv)
    if args.html:
        html_text = Path(args.html).read_text(encoding="utf-8")
    else:
        html_text = http_get(args.url)
    payload = build_payload(html_text, url=args.url)
    write_payload(payload, Path(args.output))
    pick_count = len(payload["mocks"][0]["picks"])
    print(f"Wrote {pick_count} skill-position picks to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
