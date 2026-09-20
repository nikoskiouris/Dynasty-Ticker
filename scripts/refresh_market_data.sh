#!/usr/bin/env bash
# Refresh bundled market files. Keep the last copies if a source is down.
set -u
python3 scripts/update_ktc_values.py || echo "KTC refresh failed; keeping last files."
python3 scripts/update_sleeper_trade_market.py --max-leagues 48 || echo "Sleeper market refresh failed; keeping last files."
python3 scripts/update_dynasty_rookie_mock.py || echo "Dynasty Nerds mock refresh failed; keeping last file."
