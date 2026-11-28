"""Rebuild the archived 2QB expert rankings used in the 2026 trade replay.

Each UTC key is the publication commit time, in Unix milliseconds. Both the ranks
and the FantasyPros-to-Sleeper ID crosswalk are downloaded at that exact SHA.
Only positive player quotes enter the expert ranking. Rookie picks use the
separate FantasyCalc market input.
"""
import argparse
import json
from datetime import datetime
from pathlib import Path

from ranking_holdout import RAW_GITHUB, csv_rows
from expert_market import parse_expert_values


# dynastyprocess/data commits that published files/values.csv in the study window.
PUBLICATIONS = """
2026-08-07T04:36:14Z 20faacae3e0c498bdf7957e82d8e1b1f66e1c9aa
2026-08-14T04:21:49Z 3aec32d2dd7beff2a8a336c86dbfeb9143e1c49d
2026-08-21T03:27:14Z 361819be3bbc74099c711e159d35ae8bed00f27a
2026-08-28T14:27:51Z a9346c686f286a2d1a30710e5ce68034d8a10a11
2026-09-04T07:19:26Z 759d8e6b5f251b86a231ee3e893d586f082a88fd
2026-09-11T07:22:31Z 937b6a7efc695703ee1fb65a1bf013cc48069e33
2026-09-18T07:31:18Z 444b5cfd4f66c7bfdd6fe98abb7c852527745d95
2026-09-25T08:00:48Z f059325ce42de4ef582f9ba469aaea609ca5b825
2026-10-02T08:42:07Z 980d6d88faac8d080db6e4b7e462f3bf19728396
2026-10-09T09:19:31Z 41747c4776f4c846b2414433bd469f42558c5afe
2026-10-16T07:21:52Z 47f4a61c0fae1fc9a5a011533339d66674365eaa
2026-10-23T07:44:24Z e82f076a5843e1e8cf5080c2141c7debb8e3be54
2026-10-30T08:49:11Z 5a728e118b40660eee7615e4017e7818464ff020
2026-11-06T09:33:15Z 7ee4b39570d85ef9fca7753a089bd8d75d8530a1
2026-11-13T09:47:01Z 195aea75ee36a5df0b1a423b2d173a9ebd9736bc
2026-11-20T10:13:17Z db579dee16059c992bc37a64e48a2d3a0bc435c7
2026-11-27T11:02:36Z a8326e4597fcdd8802c6d80a926832fab27f4fdd
""".strip().splitlines()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--cache-dir", required=True, type=Path)
    args = parser.parse_args()
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    observations = {}
    for publication in PUBLICATIONS:
        stamp, revision = publication.split()
        as_of = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
        base = f"{RAW_GITHUB}dynastyprocess/data/{revision}/files/"
        ranks = csv_rows(base + "values.csv", args.cache_dir)
        identities = csv_rows(base + "db_playerids.csv", args.cache_dir)
        # The historical crosswalk also supplies name and position for unmatched IDs.
        board = parse_expert_values(ranks, identities, {}, as_of)
        if not board:
            raise ValueError(f"No eligible player rankings in {revision}")
        observations[int(as_of.timestamp() * 1000)] = board
    args.output.write_text(json.dumps(observations, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
