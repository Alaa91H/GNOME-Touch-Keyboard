# GNOME Touch Keyboard

A modern, touch-first on-screen keyboard for GNOME Shell 45+ on Wayland. Sub-project A delivers the foundation: one Default QWERTY layout, clean modular architecture, and a professional theme + preferences window.

## Status

**v0.1.0 — Sub-project A (Foundation + Default layout).**

Multilingual layouts (Arabic, German), additional modes (compact, docked, split, traditional), prediction, emoji, and clipboard are roadmap items (see `docs/ROADMAP.md`). The architecture is shaped to accept them without rewriting the foundation.

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

See `docs/TESTING.md` — the testing checklist mirrors the spec's acceptance criteria. Key checks: type letters, Shift tap/double-tap, Space/Backspace/Return, theme switches, leak count after 5 enable/disable cycles.

## Continuous Integration (GitHub Actions)

A CI workflow is defined at `.github/workflows/build.yml`. On every push or pull‑request to `main` it:
1. Installs GJS and the required tools.
2. Compiles the GSettings schema.
3. Runs the unit test (`tests/unit/LanguageManager.test.js`).
4. Executes the end‑to‑end test (`tests/e2e/language_switch_e2e.test.js`) in a virtual X server.

The workflow ensures that any new layout or code change does not break loading or language switching.

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.
