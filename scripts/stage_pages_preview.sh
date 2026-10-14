#!/usr/bin/env bash
# The old GitHub Pages workflow on main still checks out develop and calls this
# path. Pages is not the app. Refuse so that dispatch cannot publish a second desk.
echo "GitHub Pages is not the app. Refusing to stage a preview." >&2
echo "dynastyticker.com publishes only from a prod GitHub Release." >&2
exit 1
