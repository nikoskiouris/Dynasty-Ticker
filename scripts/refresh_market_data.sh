#!/usr/bin/env bash
# Refresh generated football data. Keep the last valid files if an upstream source is down.
set -u

python3 player-values/build.py || echo "Player-value refresh failed; keeping the last valid snapshot."
python3 scripts/update_dynasty_rookie_mock.py || echo "Dynasty Nerds mock refresh failed; keeping last file."
python3 scripts/update_nfl_draft_picks.py || echo "NFL draft-pick refresh failed; keeping last file."
