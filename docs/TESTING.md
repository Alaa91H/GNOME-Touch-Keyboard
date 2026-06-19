# Testing

STATIC checks run on any host (including Windows) and live in `scripts/`.
MANUAL checks require a GNOME 46 Wayland box.

## STATIC (run before packaging)

```bash
node scripts/check-schema-sync.js     # schema <-> defaults
node scripts/check-layout.js           # us.json shape
node scripts/check-keyboard-state.mjs  # KeyboardState behavior (8 cases)
node scripts/check-css.js              # stylesheet coverage
bash scripts/audit.sh                  # imports, IP guard, syntax, no aliases
```

All must exit 0.

As of v0.1.0, the verified output is:

```
schema-sync OK (12 keys checked)
layout OK (5 rows)
PASS: 8 passed, 0 failed          (keyboard-state)
css OK (15 rules, all required selectors and vars present)
audit: all ok / imports OK (21 files) / all .js parse OK
```

## MANUAL (on GNOME 46 Wayland)

Run after `glib-compile-schemas schemas/` + `gnome-extensions install`
+ re-login + enable.

1. `journalctl --user -u gnome-shell -f` shows no errors/warnings on enable.
2. Keyboard renders at the bottom of the primary monitor, 5 rows.
3. Type letters in a focused text field — correct lowercase output.
4. Shift tap → one uppercase letter → reverts to lowercase.
5. Shift double-tap → Caps; third tap → off.
6. Space / Backspace / Return / `,` / `.` behave correctly.
7. Toggle `show-number-row` off in prefs — layout rebuilds, 4 rows.
8. Switch theme-mode light/dark/auto — applies live.
9. Change accent color — applies live.
10. Change key-height/spacing/radius/font-scale — applies live.
11. Disable → enable → no duplicate actors, no Shell warning.
12. Five enable/disable cycles: with `debug-logging=true`, the disable
    log line reports `live keys: 0`. If N > 0, a `KeyButton` was not
    destroyed — file a bug against `KeyboardRoot._clearKeys`.
13. `gnome-extensions disable && gnome-extensions enable` works without
    restarting the Shell.
14. Change primary monitor resolution — keyboard repositions without
    clipping.

## Leak detection

`KeyboardRoot.getLiveKeyCount()` is a static counter incremented in the
`KeyButton` constructor and decremented in `destroy()`. With
`debug-logging=true`, `ExtensionController.enable()` logs it. After a
clean `disable()`, the count must read `0`.

## Verification status

| Tier | Status |
|------|--------|
| STATIC (schema-sync, layout, keyboard-state, css, audit) | ✅ passing on Windows |
| MANUAL (acceptance criteria 1–14) | ⏳ pending — requires GNOME 46 Wayland box |

No feature is claimed "working" based on STATIC alone.
