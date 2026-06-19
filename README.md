# GNOME Touch Keyboard

A modern, touch-first on-screen keyboard for GNOME Shell 45+ on Wayland.
Sub-project A delivers the foundation: one Default QWERTY layout, clean
modular architecture, and a professional theme + preferences window.

## Status

**v0.1.0 — Sub-project A (Foundation + Default layout).**

Multilingual layouts (Arabic, German), additional modes (compact, docked,
split, traditional), prediction, emoji, and clipboard are roadmap items
(see `docs/ROADMAP.md`). The architecture is shaped to accept them
without rewriting the foundation.

## Requirements

- GNOME Shell 45, 46, 47, 48, 49, or 50
- Wayland session (primary). X11 is unsupported.
- `gnome-extensions` tool (ships with GNOME Shell)

## Install from source

```bash
# 1. Compile the GSettings schema into the extension dir
#    (run on a GNOME host — not available on Windows)
glib-compile-schemas schemas/

# 2. Package
bash scripts/package.sh
#   -> produces gnome-touch-keyboard@alaa91h.github.io.zip

# 3. Install
gnome-extensions install gnome-touch-keyboard@alaa91h.github.io.zip

# 4. Restart the Shell (Wayland: log out and back in), then enable:
gnome-extensions enable gnome-touch-keyboard@alaa91h.github.io
```

Open Preferences from `gnome-extensions` or the Extensions app.

## Verification (manual, on the GNOME box)

See `docs/TESTING.md` — the testing checklist mirrors the spec's
acceptance criteria. Key checks: type letters, Shift tap/double-tap,
Space/Backspace/Return, theme switches, leak count after 5 enable/disable
cycles.

## License

TBD — choose before public release. Not for redistribution yet.
