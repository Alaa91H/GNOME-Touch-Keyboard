#!/usr/bin/env bash
# Build a gnome-extensions-install zip from the project root.
# Usage: bash scripts/package.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${ROOT}/gnome-touch-keyboard@alaa91h.github.io.zip"
cd "$ROOT"
rm -f "$OUT"
# gnome-extensions install requires a flat zip of the extension files
# (no top-level dir). zip the tracked files only.
zip -r "$OUT" \
  metadata.json extension.js prefs.js stylesheet.css \
  src schemas resources \
  -x '*.superpowers*' -x 'node_modules/*' >/dev/null
echo "Built $OUT"
