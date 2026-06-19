#!/usr/bin/env bash
# scripts/audit.sh — STATIC consistency audit. Run from project root.
set -uo pipefail
fail=0

echo "== forbidden patterns =="
grep -rn "imports\.gi\." src extension.js prefs.js && { echo "FAIL: legacy imports.gi"; fail=1; } || echo "ok: no legacy imports.gi"
grep -rn "imports\.misc\.extensionUtils\|getCurrentExtension" src extension.js prefs.js && { echo "FAIL: global Me"; fail=1; } || echo "ok: no global Me"
grep -rin --exclude-dir=superpowers "microsoft\|segoe\|windows 11\|surface keyboard" src extension.js prefs.js resources docs stylesheet.css && { echo "FAIL: IP risk"; fail=1; } || echo "ok: no MS references"
grep -rn "TODO\|FIXME\|XXX\|TBD" src extension.js prefs.js resources && { echo "FAIL: TODOs left"; fail=1; } || echo "ok: no TODOs"
grep -rn "Clutter_\|Adw_\|Gdk_\|GLib_" src extension.js prefs.js && { echo "FAIL: gi alias pattern left"; fail=1; } || echo "ok: no gi aliases"
echo

echo "== import target check =="
node scripts/check-imports.js || fail=1
echo

echo "== syntax check all .js =="
for f in $(find src -name '*.js' 2>/dev/null) extension.js prefs.js; do
  [ -f "$f" ] || continue
  node --check "$f" || { echo "FAIL syntax: $f"; fail=1; }
done
echo "all .js parse OK"

exit $fail
