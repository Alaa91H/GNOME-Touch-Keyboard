# Changelog

## v0.1.0 — Sub-project A (Foundation + Default layout)

- GNOME Shell 45+ extension scaffold (ES modules).
- Single Default QWERTY layout (`resources/layouts/us.json`).
- Input via `Meta.VirtualInputDevice` (`notify_keyval`): letters, digits,
  Space, Backspace, Return, comma, period.
- Shift one-shot latch + double-tap Caps.
- Modern theme: rounded keys, press/hover/focus/checked states, light/dark
  via GNOME color scheme + explicit override, accent color, key radius /
  spacing / height / font-scale as live settings.
- GTK4 + libadwaita preferences window (`prefs.js`).
- Modular `src/` tree (`app/`, `core/`, `ui/`, `settings/`) with clean
  `enable()`/`disable()` and per-module cleanup. No leaked actors,
  signals, timers, or settings bindings across cycles.
- Leak-detection counter (`KeyboardRoot.getLiveKeyCount()`) for verification.
- STATIC verification scripts runnable on any host (Node):
  schema-sync, layout, keyboard-state, css, audit (imports + IP guard).

### Known limitations

- One layout (US English). Multilingual is Sub-project B.
- One mode (Default bottom-docked). Other modes are Sub-project E.
- No key repeat, long-press, prediction, emoji, or clipboard.
- User session only (no lock screen).
- Final `glib-compile-schemas` + `gnome-extensions install` must run on a
  GNOME host; not executable from Windows.
