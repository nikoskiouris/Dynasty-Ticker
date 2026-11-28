#!/usr/bin/env bash
# Refresh in dependency order. Each builder validates before replacing its output.
set -euo pipefail

python3 scripts/update_nfl_draft_picks.py
python3 player-values/build_trade_values.py
python3 scripts/build_sitemap.py
