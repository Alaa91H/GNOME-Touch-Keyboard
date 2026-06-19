# Architecture

Mirrors `docs/superpowers/specs/gnome-touch-keyboard-subproject-a-foundation-default-layout.md`
§2 and §4. Read that spec for the authoritative module responsibilities.

## Module map

- `extension.js` — thin entry; instantiates `ExtensionController`.
- `src/app/ExtensionController.js` — constructs/tears down all modules in order.
- `src/app/SettingsController.js` — wraps `Gio.Settings`; central subscription registry.
- `src/app/OskWindowController.js` — owns `#osk-root`; bottom-dock positioning.
- `src/app/FocusController.js` — window-level focus tracking.
- `src/core/KeyboardState.js` — pure shift/caps state.
- `src/core/LayoutManager.js` — JSON-driven layout registry (only `Default`).
- `src/core/LayerManager.js` — single `base` layer (future push/pop).
- `src/core/InputDispatcher.js` — logical key → `Meta.VirtualInputDevice`.
- `src/core/ThemeManager.js` — applies CSS variables + light/dark classes.
- `src/ui/KeyboardRoot.js` — builds rows; owns `KeyButton` pool; leak counter.
- `src/ui/KeyButton.js` — one `St.Button`; `pressed` signal; state classes.
- `src/settings/defaults.js` — single source of truth for GSettings keys.
- `src/settings/migrations.js` — idempotent schema-version migration.
- `resources/layouts/us.json` — the Default QWERTY layout data.

## Data flow

```
KeyButton ('pressed')
  -> KeyboardRoot.onPressed
       -> KeyboardState transitions (shift latch / caps)
       -> InputDispatcher.dispatch
            -> Meta.VirtualInputDevice -> Clutter seat -> focused field
       -> KeyboardRoot refreshes labels
```

UI never imports `InputDispatcher`; `InputDispatcher` never imports UI.

## Lifecycle

Construction and teardown are reverse-ordered and isolated per step
(see spec §4). A failure in any construction step logs, disables the
partially-built extension, and leaves the Shell intact. Each module
exposes `destroy()`/`dispose()`; `ExtensionController.disable()` calls
them in reverse construction order.

## Notable implementation decisions

- **`notify_keyval` over `notify_key`**: GNOME's stable synthetic-key API
  on `Meta.VirtualInputDevice` is `notify_keyval(time, keyval, state)` —
  it takes a Clutter keyval, not a hardware keycode. This must be
  confirmed on the GNOME box (see TESTING.md).
- **Auto-theme poll fallback**: `St.Settings.notify::color-scheme` is
  unreliable on some 4x versions, so `ThemeManager` also polls every
  1s *only when* `theme-mode === 'auto'`. Poll scheduling is decoupled
  from `apply()` so geometry changes don't churn the GLib source.
- **No `LifecycleRegistry`**: cleanup lives in each module's
  `destroy()`/`dispose()` plus the central `_subs` registry inside
  `ExtensionController`, per the reviewed spec.
