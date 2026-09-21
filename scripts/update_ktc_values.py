#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import re
import sys
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

KTC_BASE_URL = "https://keeptradecut.com/dynasty-rankings"
KTC_PROXY_BASE_URL = "https://r.jina.ai/http://keeptradecut.com/dynasty-rankings"
SLEEPER_PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl"
KTC_FILTERS = "QB|WR|RB|TE|RDP"
SF_OUTPUT_PATHS = (
    Path("data/ktc_values_sample.csv"),
    Path("docs/data/ktc_values_sample.csv"),
    Path("docs/data/ktc_values_sf.csv"),
)
ONE_QB_OUTPUT_PATHS = (
    Path("docs/data/ktc_values_1qb.csv"),
)
JSON_OUTPUT_PATH = Path("docs/data/ktc_values.json")
TIMEOUT_SECONDS = 25
MAX_PAGES = 24
MIN_MAPPED_PLAYERS = 180
PICK_POSITIONS = {"PICK", "RDP"}
SENTINEL_NAME_KEYS = frozenset({
    "jahmyr gibbs",
    "bijan robinson",
    "josh allen",
    "ja marr chase",
    "jayden daniels",
    "ceedee lamb",
})
PICK_LABEL_RE = re.compile(
    r"20\d{2}\s*(?:Pick\s*\d+\.\d+|(?:(?:Early|Mid|Late)\s+)?[1-4](?:st|nd|rd|th))",
    re.IGNORECASE,
)
NAME_SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}
TEAM_ALIASES = {
    "ARI": "ARI",
    "ATL": "ATL",
    "BAL": "BAL",
    "BUF": "BUF",
    "CAR": "CAR",
    "CHI": "CHI",
    "CIN": "CIN",
    "CLE": "CLE",
    "DAL": "DAL",
    "DEN": "DEN",
    "DET": "DET",
    "FA": "FA",
    "GB": "GB",
    "GBP": "GB",
    "HOU": "HOU",
    "IND": "IND",
    "JAC": "JAX",
    "JAX": "JAX",
    "KC": "KC",
    "KCC": "KC",
    "LAC": "LAC",
    "LAR": "LAR",
    "LV": "LV",
    "LVR": "LV",
    "MIA": "MIA",
    "MIN": "MIN",
    "NE": "NE",
    "NEP": "NE",
    "NO": "NO",
    "NOS": "NO",
    "NYG": "NYG",
    "NYJ": "NYJ",
    "PHI": "PHI",
    "PIT": "PIT",
    "RFA": "FA",
    "SEA": "SEA",
    "SF": "SF",
    "SFO": "SF",
    "TB": "TB",
    "TBB": "TB",
    "TEN": "TEN",
    "WAS": "WAS",
    "WSH": "WAS",
}


@dataclass(frozen=True)
class KtcRow:
    rank: int
    label: str
    position: str
    value: int
    team: str


@dataclass(frozen=True)
class SleeperCandidate:
    asset_id: str
    name_key: str
    team: str
    position: str
    is_active: bool


class HtmlTextExtractor(HTMLParser):
    BLOCK_TAGS = {
        "article",
        "aside",
        "br",
        "div",
        "footer",
        "h1",
        "h2",
        "h3",
        "h4",
        "header",
        "li",
        "main",
        "p",
        "section",
        "table",
        "tbody",
        "td",
        "th",
        "thead",
        "tr",
        "ul",
    }

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.ignored_depth = 0

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag in {"script", "style"}:
            self.ignored_depth += 1
            return
        if self.ignored_depth == 0 and tag in self.BLOCK_TAGS:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style"} and self.ignored_depth > 0:
            self.ignored_depth -= 1
            return
        if self.ignored_depth == 0 and tag in self.BLOCK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self.ignored_depth == 0:
            self.parts.append(data)

    def lines(self) -> list[str]:
        return normalize_lines("".join(self.parts))


class SleeperPlayerIndex:
    def __init__(self, players: dict) -> None:
        self.by_name: dict[str, list[SleeperCandidate]] = {}
        for player_id, meta in players.items():
            if not isinstance(meta, dict):
                continue

            position = extract_position(meta)
            if position not in {"QB", "RB", "WR", "TE"}:
                continue

            name = meta.get("full_name") or build_full_name(meta)
            if not name:
                continue

            candidate = SleeperCandidate(
                asset_id=f"player:{player_id}",
                name_key=normalize_name(name),
                team=canonical_team(meta.get("team")),
                position=position,
                is_active=bool(meta.get("active")) or str(meta.get("status", "")).lower() == "active",
            )

            seen_keys: set[str] = set()
            for raw_name in candidate_names(meta):
                for key in name_keys(raw_name):
                    if not key or key in seen_keys:
                        continue
                    seen_keys.add(key)
                    self.by_name.setdefault(key, []).append(candidate)

    def match(self, row: KtcRow) -> str | None:
        candidates: list[SleeperCandidate] = []
        seen_asset_ids: set[str] = set()
        for key in name_keys(row.label):
            for candidate in self.by_name.get(key, []):
                if candidate.asset_id in seen_asset_ids:
                    continue
                seen_asset_ids.add(candidate.asset_id)
                candidates.append(candidate)

        if not candidates:
            return None

        exact_name_key = normalize_name(row.label)
        exact_name_matches = [candidate for candidate in candidates if candidate.name_key == exact_name_key]
        if exact_name_matches:
            candidates = exact_name_matches

        position_matches = [candidate for candidate in candidates if candidate.position == row.position]
        if position_matches:
            candidates = position_matches

        row_team = canonical_team(row.team)
        if row_team and row_team != "FA":
            team_matches = [candidate for candidate in candidates if candidate.team == row_team]
            if team_matches:
                candidates = team_matches

        active_matches = [candidate for candidate in candidates if candidate.is_active]
        if active_matches:
            candidates = active_matches

        return candidates[0].asset_id if candidates else None


def main() -> int:
    try:
        players = load_players()
    except Exception as exc:
        print(f"Could not load Sleeper players: {exc}", file=sys.stderr)
        return 0 if fallback_values_exist() else 1

    sf_values = scrape_format(players, extra_params={"filters": KTC_FILTERS})
    scraped_one_qb = scrape_format(players, extra_params={"filters": KTC_FILTERS, "format": 1})

    if not accept_scrape(sf_values, players):
        print(
            f"KTC Superflex scrape looked broken ({mapped_player_count(sf_values)} players); "
            "leaving existing files in place.",
            file=sys.stderr,
        )
        return 0 if fallback_values_exist() else 1

    one_qb_values = resolve_one_qb_values(
        scraped_one_qb,
        players,
        load_existing_json_format("oneQb"),
    )
    if not accept_scrape(scraped_one_qb, players):
        kept = "keeping the last 1QB file" if one_qb_values else "no prior 1QB file to keep"
        print(
            f"KTC 1QB scrape looked broken ({mapped_player_count(scraped_one_qb)} players); "
            f"{kept}. Not copying Superflex into the 1QB slot.",
            file=sys.stderr,
        )

    for output_path in SF_OUTPUT_PATHS:
        write_values_csv(output_path, sf_values, players)
    if one_qb_values:
        for output_path in ONE_QB_OUTPUT_PATHS:
            write_values_csv(output_path, one_qb_values, players)
    write_values_json(JSON_OUTPUT_PATH, sf_values, one_qb_values, players)

    print(
        f"Wrote {len(sf_values)} SF values and {len(one_qb_values or {})} 1QB values "
        f"to CSV + {JSON_OUTPUT_PATH}"
    )
    return 0


def fallback_values_exist() -> bool:
    return Path("docs/data/ktc_values_sample.csv").exists()


def mapped_player_count(values: dict) -> int:
    return sum(1 for asset_id in (values or {}) if str(asset_id).startswith("player:"))


def scrape_covers_sentinels(values: dict, players: dict) -> bool:
    names = {
        normalize_name(resolve_asset_name(asset_id, players))
        for asset_id in (values or {})
        if str(asset_id).startswith("player:")
    }
    return SENTINEL_NAME_KEYS.issubset(names)


def accept_scrape(values: dict, players: dict) -> bool:
    return mapped_player_count(values) >= MIN_MAPPED_PLAYERS and scrape_covers_sentinels(values, players)


def resolve_one_qb_values(scraped: dict, players: dict, existing: dict | None) -> dict | None:
    """Keep a real 1QB board. Never store Superflex numbers in the 1QB slot."""
    if accept_scrape(scraped, players):
        return scraped
    if isinstance(existing, dict) and existing:
        return existing
    return None


def load_existing_json_format(key: str) -> dict:
    if not JSON_OUTPUT_PATH.exists():
        return {}
    try:
        payload = json.loads(JSON_OUTPUT_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    values = payload.get(key) or {}
    return values if isinstance(values, dict) else {}


def scrape_format(players: dict, extra_params: dict | None = None) -> dict[str, int]:
    try:
        rankings = load_all_rankings(extra_params or {})
        value_map = build_value_map(players, rankings)
        if len(value_map) < 100:
            raise RuntimeError(f"Only mapped {len(value_map)} assets.")
        return value_map
    except Exception as exc:
        print(f"KTC format scrape failed ({extra_params}): {exc}", file=sys.stderr)
        return {}


def load_players() -> dict:
    payload = fetch_text(SLEEPER_PLAYERS_URL)
    players = json.loads(payload)
    if not isinstance(players, dict):
        raise RuntimeError("Sleeper players payload was not a JSON object.")
    return players


def load_all_rankings(extra_params: dict | None = None) -> list[KtcRow]:
    rankings: list[KtcRow] = []
    seen_page_starts: set[tuple] = set()
    params = extra_params or {}

    for page in range(MAX_PAGES):
        page_rows = fetch_rankings_page(page, params)
        if not page_rows:
            break

        start_sig = tuple((row.rank, row.label) for row in page_rows[:3])
        if start_sig in seen_page_starts:
            break

        seen_page_starts.add(start_sig)
        rankings.extend(page_rows)

    if not rankings:
        raise RuntimeError("Could not read any KTC rankings pages.")

    return rankings


def fetch_rankings_page(page: int, extra_params: dict | None = None) -> list[KtcRow]:
    last_error: Exception | None = None
    for url in (build_ktc_url(page, extra_params), build_proxy_url(page, extra_params)):
        try:
            raw_text = fetch_text(url)
            lines = lines_from_response(raw_text, url)
            rows = parse_rankings(lines)
            if rows:
                return rows
        except Exception as exc:  # pragma: no cover
            last_error = exc

    if last_error is not None:
        raise RuntimeError(f"Failed to parse KTC page {page}: {last_error}") from last_error
    return []


def build_query(page: int, extra_params: dict | None = None) -> dict[str, str | int]:
    params: dict[str, str | int] = {}
    if extra_params:
        params.update(extra_params)
    if page:
        params["page"] = page
    return params


def build_ktc_url(page: int, extra_params: dict | None = None) -> str:
    params = build_query(page, extra_params)
    if not params:
        return KTC_BASE_URL
    return f"{KTC_BASE_URL}?{urlencode(params)}"


def build_proxy_url(page: int, extra_params: dict | None = None) -> str:
    params = build_query(page, extra_params)
    if not params:
        return KTC_PROXY_BASE_URL
    return f"{KTC_PROXY_BASE_URL}?{urlencode(params)}"


def fetch_text(url: str) -> str:
    request = Request(
        url,
        headers={
            "User-Agent": "DynastyTicker/1.0 (+https://dynastyticker.com)",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    try:
        with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            return response.read().decode("utf-8", errors="replace")
    except (HTTPError, URLError) as exc:
        raise RuntimeError(f"Request failed for {url}: {exc}") from exc


def lines_from_response(raw_text: str, url: str) -> list[str]:
    if url.startswith(KTC_PROXY_BASE_URL):
        return normalize_lines(raw_text)

    parser = HtmlTextExtractor()
    parser.feed(raw_text)
    return parser.lines()


def normalize_lines(text: str) -> list[str]:
    lines: list[str] = []
    for raw_line in text.splitlines():
        line = re.sub(r"\s+", " ", raw_line).strip()
        if line:
            lines.append(line)
    return lines


def parse_rankings(lines: list[str]) -> list[KtcRow]:
    start_idx = find_table_start(lines)
    if start_idx < 0:
        return []

    rows: list[KtcRow] = []
    idx = start_idx
    while idx < len(lines):
        line = strip_inline_markup(lines[idx])
        if is_table_terminator(line):
            break

        if looks_like_pick_label(line):
            row, next_idx = parse_unnumbered_pick_row(lines, idx)
            if row:
                rows.append(row)
                idx = next_idx
                continue
            idx += 1
            continue

        if not re.fullmatch(r"\d+", line):
            idx += 1
            continue

        rank = int(line)
        if rank > 700:
            idx += 1
            continue

        row_start = idx
        idx += 1

        label_parts: list[str] = []
        position = None
        while idx < len(lines) and len(label_parts) < 4:
            token = strip_inline_markup(lines[idx])
            if is_table_terminator(token):
                break

            possible_position = extract_position_token(token)
            if possible_position:
                position = possible_position
                idx += 1
                break

            if token not in {"•", "-"}:
                label_parts.append(token)
            idx += 1

        if not position or not label_parts:
            idx = row_start + 1
            continue

        value, next_idx = extract_value(lines, idx)
        if value is None:
            idx = row_start + 1
            continue

        label, team = split_label_and_team(" ".join(label_parts), position)
        rows.append(KtcRow(rank=rank, label=label, position=position, value=value, team=team))
        idx = next_idx

    return rows


def find_table_start(lines: list[str]) -> int:
    for idx, line in enumerate(lines):
        if line != "RANK":
            continue
        window = lines[idx: idx + 12]
        if "PLAYER NAME" not in window or "VALUE" not in window:
            continue
        for probe, probe_line in enumerate(window, start=idx):
            if probe_line == "VALUE":
                return probe + 1
    return -1


def is_table_terminator(line: str) -> bool:
    return line.startswith("Not seeing a player")


def strip_inline_markup(line: str) -> str:
    stripped = re.sub(r"【\d+†", "", line)
    return stripped.replace("】", "").strip()


def extract_position_token(token: str) -> str | None:
    match = re.match(r"^(QB|RB|WR|TE|PICK|RDP|DST|PK|DEF)", token)
    return match.group(1) if match else None


def extract_value(lines: list[str], start_idx: int) -> tuple[int | None, int]:
    integers: list[tuple[int, int]] = []
    idx = start_idx
    while idx < len(lines):
        token = strip_inline_markup(lines[idx])
        if is_table_terminator(token):
            break
        if integers and looks_like_pick_label(token):
            break

        if re.fullmatch(r"\d+", token) and idx + 1 < len(lines):
            next_token = strip_inline_markup(lines[idx + 1])
            if not is_table_terminator(next_token) and looks_like_row_label(next_token):
                break

        if re.fullmatch(r"-?\d+", token):
            integers.append((int(token), idx + 1))
        idx += 1

    candidates = [(value, end_idx) for value, end_idx in integers if value >= 100]
    if candidates:
        value, end_idx = candidates[-1]
        return value, end_idx
    return None, idx


def looks_like_row_label(line: str) -> bool:
    token = strip_inline_markup(line)
    if not token:
        return False
    if token.startswith("Tier "):
        return False
    if extract_position_token(token):
        return False
    if looks_like_pick_label(token):
        return False
    return any(char.isalpha() for char in token)


def looks_like_pick_label(line: str) -> bool:
    return bool(PICK_LABEL_RE.search(strip_inline_markup(line)))


def parse_unnumbered_pick_row(lines: list[str], start_idx: int) -> tuple[KtcRow | None, int]:
    label, _team = split_label_and_team(strip_inline_markup(lines[start_idx]), "PICK")
    idx = start_idx + 1
    if idx < len(lines) and extract_position_token(strip_inline_markup(lines[idx])) in PICK_POSITIONS:
        idx += 1
    value, next_idx = extract_value(lines, idx)
    if value is None or not label:
        return None, start_idx + 1
    return KtcRow(rank=0, label=label, position="PICK", value=value, team="FA"), next_idx


def split_label_and_team(label: str, position: str) -> tuple[str, str]:
    cleaned = re.sub(r"\s+", " ", label).strip()
    if position in PICK_POSITIONS:
        cleaned = re.sub(r"\s*FA$", "", cleaned, flags=re.IGNORECASE).strip()
        cleaned = re.sub(r"FA$", "", cleaned, flags=re.IGNORECASE).strip()
        return cleaned, "FA"

    cleaned = re.sub(r"^(?:\d{1,3}\s+)+", "", cleaned)
    name, team = split_concatenated_team(cleaned)
    if team:
        return name, team

    match = re.match(r"^(?P<name>.*?)(?:\s+)(?P<team>R FA|FA|[A-Z]{2,4})$", cleaned)
    if not match:
        return cleaned, ""
    return match.group("name").strip(), match.group("team").strip()


def split_concatenated_team(label: str) -> tuple[str, str]:
    if not label:
        return "", ""
    team_keys = sorted((key for key in TEAM_ALIASES if 2 <= len(key) <= 4), key=len, reverse=True)
    for team in team_keys:
        if not label.upper().endswith(team):
            continue
        prefix = label[: len(label) - len(team)]
        name = prefix.rstrip()
        if name.endswith("R") and len(name) >= 2 and name[-2].islower():
            name = name[:-1].rstrip()
        if name and re.search(r"[a-z]", name):
            return name, team
    return "", ""


def canonical_team(team: str | None) -> str:
    if not team:
        return ""
    key = re.sub(r"[^A-Za-z]", "", team).upper()
    return TEAM_ALIASES.get(key, key)


def normalize_name(name: str | None) -> str:
    if not name:
        return ""
    lowered = name.lower()
    lowered = re.sub(r"[^a-z0-9\s]", " ", lowered)
    lowered = re.sub(r"\s+", " ", lowered).strip()
    return lowered


def strip_suffix_key(name_key: str) -> str:
    if not name_key:
        return ""
    tokens = name_key.split()
    while tokens and tokens[-1] in NAME_SUFFIXES:
        tokens.pop()
    return " ".join(tokens)


def name_keys(name: str | None) -> tuple[str, ...]:
    base = normalize_name(name)
    without_suffix = strip_suffix_key(base)
    compact = re.sub(r"\s+", "", base)
    keys = [key for key in (base, without_suffix, compact) if key]
    deduped: list[str] = []
    seen = set()
    for key in keys:
        if key in seen:
            continue
        seen.add(key)
        deduped.append(key)
    return tuple(deduped)


def candidate_names(meta: dict) -> list[str]:
    names = [
        meta.get("search_full_name"),
        meta.get("full_name"),
        build_full_name(meta),
    ]
    return [name for name in names if name]


def build_full_name(meta: dict) -> str:
    return f"{str(meta.get('first_name', '')).strip()} {str(meta.get('last_name', '')).strip()}".strip()


def extract_position(meta: dict) -> str:
    position = str(meta.get("position") or "").upper()
    if position:
        return position
    fantasy_positions = meta.get("fantasy_positions") or []
    if fantasy_positions:
        return str(fantasy_positions[0]).upper()
    return ""


def build_value_map(players: dict, rankings: list[KtcRow]) -> dict[str, int]:
    index = SleeperPlayerIndex(players)
    values: dict[str, int] = {}
    pick_buckets: dict[str, dict[str, int]] = {}

    for row in rankings:
        if row.position in PICK_POSITIONS:
            asset_id, bucket = parse_pick_asset(row.label)
            if asset_id and bucket:
                pick_buckets.setdefault(asset_id, {})[bucket] = row.value
            continue

        asset_id = index.match(row)
        if asset_id:
            values[asset_id] = row.value

    for asset_id, bucket_values in pick_buckets.items():
        values[asset_id] = collapse_pick_bucket_values(bucket_values)
        for bucket, bucket_value in bucket_values.items():
            if bucket == "any":
                continue
            values[build_bucket_pick_asset_id(asset_id, bucket)] = bucket_value

    return values


def parse_pick_asset(label: str) -> tuple[str | None, str | None]:
    overall = re.search(
        r"(?P<season>20\d{2})\s*Pick\s*(?P<round>\d+)\.(?P<slot>\d+)",
        label,
        flags=re.IGNORECASE,
    )
    if overall:
        season = overall.group("season")
        round_ = overall.group("round")
        slot = int(overall.group("slot"))
        bucket = "any"
        if int(round_) == 1:
            bucket = "early" if slot <= 4 else "mid" if slot <= 8 else "late"
        return f"pick:{season}:r{round_}:any", bucket

    match = re.search(
        r"(?P<season>20\d{2})\s+(?:(?P<bucket>Early|Mid|Late)\s+)?(?P<round>[1-4])(?:st|nd|rd|th)",
        label,
        flags=re.IGNORECASE,
    )
    if not match:
        return None, None

    season = match.group("season")
    round_ = match.group("round")
    bucket = (match.group("bucket") or "any").lower()
    return f"pick:{season}:r{round_}:any", bucket


def collapse_pick_bucket_values(bucket_values: dict[str, int]) -> int:
    if "mid" in bucket_values:
        return bucket_values["mid"]
    if "any" in bucket_values:
        return bucket_values["any"]
    if bucket_values:
        return round(sum(bucket_values.values()) / len(bucket_values))
    return 0


def build_bucket_pick_asset_id(asset_id: str, bucket: str) -> str:
    match = re.match(r"pick:(\d{4}):r(\d):any", asset_id)
    if not match:
        return asset_id
    season, round_ = match.groups()
    return f"pick:{season}:r{round_}:{bucket}"


def format_pick_round(round_: str) -> str:
    suffix = {"1": "st", "2": "nd", "3": "rd"}.get(round_, "th")
    return f"{round_}{suffix}"


def write_values_csv(path: Path, values: dict[str, int], players: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as file_obj:
        writer = csv.writer(file_obj)
        writer.writerow(["asset_id", "value", "name"])
        for asset_id, value in sorted(values.items(), key=lambda item: (-item[1], item[0])):
            writer.writerow([asset_id, value, resolve_asset_name(asset_id, players)])


def resolve_asset_name(asset_id: str, players: dict) -> str:
    if asset_id.startswith("player:"):
        player_id = asset_id.split(":", 1)[1]
        meta = players.get(player_id, {})
        return meta.get("full_name") or build_full_name(meta) or player_id

    match = re.match(r"pick:(\d{4}):r(\d):(any|early|mid|late)", asset_id)
    if match:
        season, round_, bucket = match.groups()
        bucket_label = "" if bucket == "any" else f" {bucket.title()}"
        return f"{season}{bucket_label} {format_pick_round(round_)} Pick"

    return asset_id


def write_values_json(path: Path, sf_values: dict[str, int], one_qb_values: dict[str, int] | None, players: dict) -> None:
    names: dict[str, str] = {}
    one_qb = one_qb_values or {}
    for asset_id in set(sf_values) | set(one_qb):
        names[asset_id] = resolve_asset_name(asset_id, players)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps({"sf": sf_values, "oneQb": one_qb_values if one_qb_values else None, "names": names}, separators=(",", ":")),
        encoding="utf-8",
    )


if __name__ == "__main__":
    raise SystemExit(main())
