# Compatibility

| GNOME Shell | Status |
|-------------|--------|
| 45 | Targeted. ES module API. |
| 46 | Primary test target (Wayland). |
| 47 | Targeted. |
| 48 | Targeted. |
| 49 | Targeted. |
| 50 | Targeted. |

## Sessions

- **Wayland:** primary, fully supported.
- **X11:** unsupported. `Meta.VirtualInputDevice` behavior and focus
  tracking differ; we do not test or support X11.

## Known API risks

- `Meta.VirtualInputDevice.new(...)` signature has been stable across
  45–50 but is feature-detected at construction; on failure the extension
  disables itself cleanly (the `input` construction step is wrapped in
  `ExtensionController._try`).
- The actual key-injection method used is `notify_keyval(time, keyval,
  state)`, the stable API for synthetic keysym events. The original plan
  draft referenced `notify_key(...)` (which takes a hardware keycode);
  that was corrected before implementation.
- `St.Settings.get_color_scheme()` notify signal is unreliable on some
  versions; `ThemeManager` also polls at 1s when `theme-mode` is `auto`.

## What's not supported in A

Lock screen / unlock dialog (`session-modes` is `["user"]` only), key
repeat, long-press popups, prediction, emoji, clipboard, multilingual
layouts, modes beyond Default. See `docs/ROADMAP.md`.

## Build host note

`glib-compile-schemas schemas/` must be run on a GNOME/Linux host before
`gnome-extensions install`. It is not available on Windows, so the
Windows dev workflow produces the source tree + STATIC checks; the
final compile/install step runs on the GNOME box.
