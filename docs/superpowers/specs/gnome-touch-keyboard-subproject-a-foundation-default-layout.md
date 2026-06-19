# GJS OSK Pro — Sub-project A: Foundation + Default Layout

**Status:** Draft for review
**Date:** 2026-06-19
**GNOME Shell target:** 45, 46, 47, 50+ (ES module imports)
**Primary session:** Wayland (X11 best-effort, unsupported)
**Cycle scope:** Foundation architecture + a single Default touch layout, end-to-end and shippable.

---

## 1. Purpose and scope

This spec defines Sub-project A of the GJS OSK Pro roadmap: a minimal, stable, installable GNOME Shell extension that renders one modern touch keyboard layout (Default QWERTY-style) and establishes the architecture that later sub-projects build on.

### In scope (this cycle)

- GNOME Shell 45+ extension scaffold (`metadata.json`, `extension.js`, `prefs.js`, `stylesheet.css`, GSettings schema).
- Modular GJS source tree under `src/` split into `app/`, `core/`, `ui/`, `settings/`.
- One rendered layout: **Default** (number row + 4 letter/function rows).
- Input for: letters (a–z, with Shift for uppercase), digits (0–9), Space, Backspace, Enter, Shift (tap + double-tap-for-caps), and the punctuation keys present on the Default layout.
- Modern touch-first CSS theme: rounded keys, clear press/hover/focus states, light/dark via GNOME color scheme + explicit override, accent color, key radius and spacing as settings.
- A professional preferences window in `prefs.js` for the settings exposed in this cycle.
- Defensive lifecycle: clean `enable()`/`disable()`, zero leaked actors/signals/timers/settings bindings, no surviving global state, reloadable without restarting GNOME Shell.
- Basic documentation: `README.md`, `ARCHITECTURE.md`, `COMPATIBILITY.md`, `CHANGELOG.md`.

### Out of scope (future sub-projects; listed only as staged hooks)

The following are **not** delivered in A. Each has an architecture seam (module or interface) so a later sub-project can add it without touching core code paths:

- Compact Floating, Docked, Traditional, and Split layout **modes** — `LayoutManager` exposes a registry, only `Default` is registered now.
- Window drag, resize, snap-to-edge, per-monitor position/size persistence, dock/undock — handled by a future `GeometryManager` module (a reserved name; the file is **not created in A**). In A, bottom-anchored positioning is implemented inline in `OskWindowController` and is the single seam that a future `GeometryManager` will extract.
- Symbols, Numbers, and Emoji panels — `LayerManager` exposes a layer-stack contract, only the `base` layer is implemented now.
- Key repeat, long-press accent popup, sticky modifiers, Caps Lock as a first-class lock — `InputDispatcher` and `KeyboardState` expose hooks; only single-press + Shift behavior is wired now.
- SuggestionBar, IBus/TypingBooster, ClipboardService, HandwritingPanel — module boundaries reserved in the architecture; no instances created in A.
- GestureController for swipes — module boundary reserved; not instantiated.
- Multilingual layout files (Arabic, German, etc.) — `LayoutManager` registry accepts them in future; only a US QWERTY data file ships now.

### Non-goals (explicit)

- Do not reproduce any Microsoft asset, name, icon, trademark, or copied visual resource. The look is touch-keyboard-inspired and original.
- Do not copy code from GNOME Shell's built-in `keyboard.js`. APIs may be referenced for compatibility knowledge; no text is reused.
- Do not ship experimental features behind runtime flags in this cycle. Future sub-project features are documented as absent (§9), not pre-stubbed in code — A's runtime surface is exactly what A uses.

---

## 2. Directory and file layout

Final paths for Sub-project A:

```
gnome-touch-keyboard-pro/
├── metadata.json
├── extension.js                      # entry: enable/disable only
├── prefs.js                          # GTK4 preferences window
├── stylesheet.css                    # theme: variables + key states
├── README.md
├── ARCHITECTURE.md
├── COMPATIBILITY.md
├── CHANGELOG.md
├── schemas/
│   └── org.gnome.shell.extensions.gnome-touch-keyboard.gschema.xml
├── resources/
│   └── layouts/
│       └── us.json                   # US QWERTY Default layout data (the only layout file)
└── src/
    ├── app/
    │   ├── ExtensionController.js     # top-level lifecycle orchestrator
    │   ├── OskWindowController.js     # owns the St window/actor holding the keyboard
    │   ├── FocusController.js         # tracks focused Meta.Window (minimal: presence detection)
    │   └── SettingsController.js      # GSettings wrapper + signal fan-out + cleanup registry
    ├── core/
    │   ├── KeyboardState.js           # shift/caps/modifier state machine (minimal)
    │   ├── LayoutManager.js           # layout registry; only 'Default' registered
    │   ├── LayerManager.js            # layer-stack contract; only 'base' layer
    │   ├── InputDispatcher.js         # press → Clutter keysym emission (letters/digits/space/etc.)
    │   └── ThemeManager.js            # applies theme class + accent + geometry to the actor
    ├── ui/
    │   ├── KeyboardRoot.js            # top-level St container, builds rows from layout data
    │   └── KeyButton.js               # single key actor with press/hover/focus states
    └── settings/
        ├── defaults.js                # default values (single source of truth)
        └── migrations.js              # schema-version migration (validates v1; structured no-op today)
```

### Module responsibilities (final)

**`extension.js`** — imports `ExtensionController`, calls `controller.enable()` in `enable()` and `controller.disable()` in `disable()`. Holds no other logic. Owns no state.

**`src/app/ExtensionController.js`** — the only object `extension.js` talks to. Constructs `SettingsController`, `LayoutManager`, `ThemeManager`, `OskWindowController`, `FocusController`, wires them, and tears them all down in reverse order on disable. Catches construction errors and logs them without crashing the Shell.

**`src/app/OskWindowController.js`** — owns the keyboard surface actor. In A the surface is a `St.BoxLayout` with id `osk-root` (this single actor serves as both the window-level surface and the CSS root that §6 references — there is exactly one actor between `Main.uiGroup` and the key rows, not two). It is added as a child of `Main.uiGroup` — chosen because it is the simplest stable, always-on-top container in GNOME 45+ and does not collide with GNOME's own `Main.layoutManager.keyboardBox` (which we leave untouched so we never fight the built-in OSK). The surface is bottom-docked, sized to the primary monitor's work area width minus margins. Repositions on `Main.layoutManager`'s `monitors-changed` signal (tracked, disconnected on destroy). Visibility is toggled by `show()`/`hide()`; in A the keyboard is shown on enable and hidden on disable. Destroys the actor and disconnects all signals on `destroy()`.

**`src/app/FocusController.js`** — minimal in A: detects whether a `Meta.Window` is focused (used to keep the keyboard visible/hidden decision sane). Does not perform per-text-field focus tracking (future). Exposes `getFocusedWindow()` (returns `global.display.focus_window`) and `onFocusChanged(cb)` which subscribes to `global.display.connect('notify::focus-window', ...)`. The connection id is tracked and disconnected in `dispose()`.

**`src/app/SettingsController.js`** — wraps a `Gio.Settings` for the schema id, exposes typed getters, a change-subscription API returning a disconnectable handle, and a central `dispose()` that disconnects every subscription and drops the settings reference. All other modules obtain settings through this object, never directly through `Gio.Settings`.

**`src/core/KeyboardState.js`** — pure state object (no actors, no signals to external systems). Holds: `shift` (bool), `caps` (bool), `activeModifiers` (set of sticky keys, empty in A). Methods: `applyShiftTap()`, `applyShiftDoubleTap()` (engages caps), `consumeShift()` (returns effective case and resets a single-tap shift), `reset()`. Emits no GNOME signals; mutation returns a new state snapshot consumed by `KeyboardRoot` for re-render decisions.

**`src/core/LayoutManager.js`** — registry mapping a layout id → layout data. Constructed with the extension directory path (passed in explicitly, no global `Me`). Loads `resources/layouts/us.json` via `Gio.File` + `JSON.parse` at construction (see decision #10). Exposes `register(id, data)`, `get(id)`, and `setActive(id)` (a no-op-safe seam for future LayoutSwitcher; in A only `Default` is registered and active).

**`src/core/LayerManager.js`** — contract for a layer stack (`base`, future `symbols`/`numbers`/`emoji`). In A: holds a single `base` layer only and exposes `getActive()` returning it. The `push(layer)`/`pop()` API is **documented as the future contract** but not implemented in A's code — when C adds panels it adds these methods. This keeps A's runtime surface to exactly what it uses, consistent with the `InputDispatcher` decision.

**`src/core/InputDispatcher.js`** — translates a logical key event (`{type, keysym, codepoint}`) into a Clutter key event via `Meta.VirtualInputDevice` (`KEYBOARD` device class). In A handles exactly the logical keys present in `us.json`: printable codepoints (`a`–`z`, `0`–`9`, `,`, `.`), `backspace`, `space`, `return`, and Shift-aware uppercase. (`Tab` is not in the A layout and is therefore not handled; the dispatcher is driven by layout data, not a hardcoded key list.) Does **not** implement key repeat, long press, or sticky-modifier combinations. Future behaviors are documented as absent (see §9), not pre-stubbed in code — `InputDispatcher` exposes only the `dispatch()` method actually used in A.

**`src/core/ThemeManager.js`** — reads theme settings (color-scheme mode, accent, key radius, spacing, key height, compact flag) and applies them to the keyboard actor by setting style classes and CSS custom properties (e.g. `--osk-key-radius`). Listens to settings changes and re-applies reactively. Destroys no actors but disconnects its settings subscriptions on dispose.

**`src/ui/KeyboardRoot.js`** — owns the `#osk-root` `St.BoxLayout` (the same actor `OskWindowController` adds to `Main.uiGroup`) and builds the row/column structure inside it from layout data + active layer + current `KeyboardState`. (Relationship: `OskWindowController` creates the actor and manages positioning/visibility/lifecycle; `KeyboardRoot` receives that actor and is responsible for its contents — the rows and keys. Neither creates a second wrapper actor.) Owns a pool of `KeyButton` instances; rebuilds only when layout or layer changes, not on every shift (shift updates labels via a cheap per-key refresh). Provides `destroy()` that walks the pool, destroys every key actor, and removes the row actors — but does **not** destroy the `#osk-root` actor itself (that is `OskWindowController`'s responsibility, to avoid double-destroy). Exposes `getLiveKeyCount()` returning the number of currently-alive `KeyButton` instances (incremented on create, decremented on destroy) — this is the leak-detection counter used by acceptance criterion 12.

**`src/ui/KeyButton.js`** — one `St.Button`-based actor. CSS classes: `osk-key` (base), with state classes `:hover`, `:active`, `:focus`, `:checked` (for latched shift/modifier). Emits a single `'pressed'` signal consumed by `KeyboardRoot`, which routes to `InputDispatcher`. Disconnects its own signal handlers on `destroy()`.

**`src/settings/defaults.js`** — single source of truth for every setting key, its type, and its default value. Imported by both `prefs.js` and `SettingsController` to prevent drift. Schema generation is manual but must match these defaults exactly.

**`src/settings/migrations.js`** — `migrate(settings, fromVersion, toVersion)`. In A there is only `v1`; the function is a structured no-op that validates the current schema version and returns. Future sub-projects add real steps. No silent behavior.

---

## 3. The Default layout (only layout in A)

Single layout data file: `resources/layouts/us.json`. Format (final, documented here so it is unambiguous):

```json
{
  "id": "Default",
  "locale": "en-US",
  "rows": [
    [
      { "k": "1" }, { "k": "2" }, { "k": "3" }, { "k": "4" },
      { "k": "5" }, { "k": "6" }, { "k": "7" }, { "k": "8" },
      { "k": "9" }, { "k": "0" }
    ],
    [
      { "k": "q" }, { "k": "w" }, { "k": "e" }, { "k": "r" },
      { "k": "t" }, { "k": "y" }, { "k": "u" }, { "k": "i" },
      { "k": "o" }, { "k": "p" }
    ],
    [
      { "k": "a" }, { "k": "s" }, { "k": "d" }, { "k": "f" },
      { "k": "g" }, { "k": "h" }, { "k": "j" }, { "k": "k" },
      { "k": "l" }
    ],
    [
      { "k": "shift", "label": "⇧", "width": 1.5 },
      { "k": "z" }, { "k": "x" }, { "k": "c" }, { "k": "v" },
      { "k": "b" }, { "k": "n" }, { "k": "m" },
      { "k": "backspace", "label": "⌫", "width": 1.5 }
    ],
    [
      { "k": "123", "label": "?123", "width": 1.5 },
      { "k": "comma", "label": "," },
      { "k": "space", "label": "space", "width": 5.0 },
      { "k": "period", "label": "." },
      { "k": "return", "label": "↵", "width": 1.5 }
    ]
  ]
}
```

### Layout semantics (final for A)

- **Key object shape:** `{ "k": <logicalKey>, "label"?: <string>, "width"?: <number, default 1.0> }`. `label` is display text; `k` is the logical key consumed by `InputDispatcher`.
- **Logical keys implemented in A:** printable codepoints (`a`–`z`, `0`–`9`, `,`, `.`), `shift`, `backspace`, `space`, `return`. The `123` key is rendered but **inert in A** — it is the seam for the future symbols layer and does nothing when pressed (no crash, no log spam beyond a single debug line when debug-logging is on).
- **Number row:** rendered by default. A setting `show-number-row` (default `true`) toggles it; when off, row 0 is omitted from the build.
- **Key sizing (logical, 1× scale):** base key width derives from `(monitor_width − margins − spacing×(keysInRow−1)) / sumOfWidths`. Key height = `key-height` setting (default **52px**). Horizontal/vertical spacing = `key-spacing` setting (default **6px**). Corner radius = `key-radius` setting (default **10px**).
- **Min touch target:** every key renders at ≥ 44×44 logical px; `ThemeManager` clamps `key-height` to a minimum of 44.
- **Shift behavior:** single tap latches shift for the next key; the shift key shows `:checked` until consumed. A second tap within 400ms engages Caps (shift key shows `:checked` and stays until tapped again). Because A's Default layout has no `Esc` and no layout switcher, Caps clears only on a third shift tap or on `disable()`. (Adding `Esc`-clears-caps is a one-line future change once a Traditional/layout-switcher sub-project lands.)
- **Backspace/Return/Space:** single-press only in A. Key repeat is a documented future hook; not implemented.

---

## 4. Architecture and data flow

### Construction order (in `ExtensionController.enable()`)

1. `SettingsController` (loads `Gio.Settings`, runs `migrations.migrate(...)`).
2. `LayoutManager` (loads `us.json`, registers `Default`).
3. `KeyboardState` (fresh instance).
4. `ThemeManager` (binds to settings, exposes apply function).
5. `InputDispatcher` (acquires `Meta.VirtualInputDevice`).
6. `OskWindowController` (creates the surface actor, applies theme).
7. `KeyboardRoot` (builds keys from `LayoutManager.getActive()`).
8. `FocusController` (begins listening; keyboard visible by default in A).

Each step is wrapped in try/catch. If a step fails, the controller logs the error via `global.log`/`console.error`, disables the already-constructed components in reverse order, and leaves the Shell intact. The extension is **disabled** on its own failure, not the Shell.

### Press data flow

```
KeyButton ('pressed' signal)
   → KeyboardRoot.onKeyPressed(logicalKey)
      → KeyboardState transitions (shift latch / caps)
      → InputDispatcher.dispatch({type, keysym, codepoint})
         → Meta.VirtualInputDevice tells Clutter/Clutter seat
      → KeyboardRoot refreshes key labels if case changed
```

`KeyButton` never touches `InputDispatcher` directly. `KeyboardRoot` never touches `Meta.VirtualInputDevice` directly. UI and input are strictly separated.

### Teardown order (in `ExtensionController.disable()`)

Reverse of construction. Each module exposes `destroy()`/`dispose()`:

1. `FocusController.dispose()` — disconnect window focus signals.
2. `KeyboardRoot.destroy()` — destroys all `KeyButton` actors and removes row actors from `#osk-root`, but leaves `#osk-root` itself alive (owned by `OskWindowController`); nulls its signal handles and key pool.
3. `OskWindowController.destroy()` — removes actor from parent, destroys it, disconnects monitor signals.
4. `InputDispatcher.dispose()` — releases the virtual device reference (no explicit free needed; drops reference).
5. `ThemeManager.dispose()` — disconnects settings subscriptions.
6. `LayoutManager.dispose()` — clears registry.
7. `KeyboardState.reset()` — clears state.
8. `SettingsController.dispose()` — disconnects all subscriptions, drops `Gio.Settings` reference.

After teardown, `ExtensionController` nulls every reference. The module-scope of `extension.js` holds only a single nullable `controller` reference.

---

## 5. GSettings schema

Schema id: `org.gnome.shell.extensions.gnome-touch-keyboard`
Path: `/org/gnome/shell/extensions/gnome-touch-keyboard-pro/`

Keys for Sub-project A (final; must match `src/settings/defaults.js` and `schemas/*.gschema.xml` exactly):

| Key | Type | Default | Summary |
|-----|------|---------|---------|
| `schema-version` | `i` | `1` | Schema version for forward migrations. |
| `layout-id` | `s` | `"Default"` | Active layout id. Only `Default` valid in A. |
| `show-number-row` | `b` | `true` | Render the number row on the Default layout. |
| `theme-mode` | `s` | `"auto"` | One of `"light"`, `"dark"`, `"auto"`. `"auto"` follows GNOME color scheme via `St.Settings`. |
| `accent-color` | `s` | `"#3584e4"` | Accent used for `:active`/`:focus` highlights. Stored as a CSS hex string. |
| `compact-density` | `b` | `false` | Reserved (renders slightly smaller). Implemented visually in A; no layout switch. |
| `key-height` | `i` | `52` | Logical key height in px. Clamped to `[44, 80]` by ThemeManager. |
| `key-spacing` | `i` | `6` | Logical spacing in px. Clamped to `[2, 12]`. |
| `key-radius` | `i` | `10` | Logical corner radius in px. Clamped to `[0, 20]`. |
| `font-scale` | `d` | `1.0` | Multiplier on key label font size. Clamped to `[0.8, 1.5]`. |
| `debug-logging` | `b` | `false` | Verbose logging to `journalctl`. Off by default. |
| `position-mode` | `s` | `"bottom"` | Reserved seam. Only `"bottom"` implemented in A; other values coerce to `"bottom"`. |

### Migration logic

`migrations.migrate(settings)` reads `schema-version`:

- If absent (first install), writes `1`.
- If `< 1`, applies no-op steps and sets `1`.
- If `=== 1`, returns immediately.
- If `> 1` (user downgraded), logs a warning and coerces to `1` without data loss; no destructive resets.

Migration is idempotent and never throws on unknown future versions (defensive).

---

## 6. Theme and stylesheet direction

`stylesheet.css` uses CSS custom properties for all themeable values, applied to the root actor by `ThemeManager`. Light/dark is selected by toggling a class (`osk-light` / `osk-dark`) on the root; `"auto"` reads `St.Settings.get().color_scheme` and re-evaluates on its `notify` signal.

CSS structure (final section names; styling itself is implemented to the visual brief):

- `#osk-root` — root container; owns the custom properties `--osk-key-height`, `--osk-key-spacing`, `--osk-key-radius`, `--osk-accent`, `--osk-font-scale`, plus light/dark color tokens (`--osk-bg`, `--osk-key-bg`, `--osk-key-fg`, `--osk-key-pressed-bg`, `--osk-key-hover-bg`).
- `.osk-row` — horizontal flex row with gap = `--osk-key-spacing`.
- `.osk-key` — base key; rounded corners via `--osk-key-radius`; min height `--osk-key-height`.
- `.osk-key:hover`, `.osk-key:active`, `.osk-key:focus`, `.osk-key:checked` — state styling. `:active` and `:focus` use `--osk-accent`.
- `.osk-key--wide`, `.osk-key--space` — width modifiers driven by layout `width`.

No external fonts, no icon fonts, no SVG assets. Glyphs shown as labels are Unicode characters already present in the system default font (e.g. `⇧`, `⌫`, `↵`). No Microsoft Segoe UI or other proprietary font is referenced.

Originality: spacing, radius, and color choices are GNOME-adjective ("Adwaita-friendly"): neutral surfaces, blue accent default matching `#3584e4` (GNOME accent default). No copied color palettes or design files.

---

## 7. Acceptance criteria

The cycle is complete when **all** of the following are true and verified by manual test on GNOME 46 Wayland (primary) with a smoke check on 45 and 47:

1. `gnome-extensions install` succeeds from a zip of the project root.
2. Enabling the extension does not produce any `gnome-shell` error or warning in `journalctl --user -u gnome-shell` (other than our own debug logs when `debug-logging=true`).
3. The keyboard renders at the bottom of the primary monitor, full usable width minus margins, with the Default layout's 5 rows (or 4 when `show-number-row=false`).
4. Typing letters produces the correct lowercase output into a focused `TextEdit`/`gtk4-widget-factory` text field.
5. Shift tap produces one uppercase letter, then reverts to lowercase.
6. Shift double-tap engages Caps; a third tap disengages it.
7. Space, Backspace, Return, `,`, `.` all behave correctly in the same focused field.
8. Number row toggles off via prefs; the layout rebuilds without errors.
9. Theme mode light/dark/auto switches correctly; accent color change applies live without restart.
10. `key-height`, `key-spacing`, `key-radius`, `font-scale` changes apply live.
11. Disabling the extension removes the keyboard and leaves zero references: verified by re-enabling immediately and confirming no duplicate actors and no Shell warning.
12. Five consecutive enable/disable cycles produce no leaked Clutter/St actors. Verification: `KeyboardRoot` exposes `getLiveKeyCount()` (a real counter incremented in its constructor, decremented in `destroy()`). When `debug-logging=true`, `ExtensionController` logs this count on enable and on disable; the disable count must read `0`. This is cross-checked by manual inspection in Looking Glass → Extensions → "Inspect" (the parent group must show no surviving `osk-*` actors after disable).
13. The extension reloads after `gnome-extensions disable && gnome-extensions enable` without restarting the Shell.
14. Multimonitor: moving the primary monitor or changing resolution repositions the keyboard without overlap or clipping.

### Non-acceptance (explicitly excluded from A's bar)

- Key repeat, long-press popups, sticky-modifier combos (Ctrl+C etc.), symbols/numbers/emoji panels, prediction, handwriting, split/compact/docked/traditional modes, multilingual layouts, window drag/resize/snap. These are accepted in their own sub-projects.

---

## 8. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| `Meta.VirtualInputDevice` API differences across GNOME 45–50 | Feature-detect at construction; if unavailable, log and disable the extension gracefully (no crash). |
| `St.Settings.color_scheme` notify signal not firing | ThemeManager re-reads on settings change AND on a 1s poll fallback (cheap). Documented decision: poll interval 1000ms, only in `auto` mode. |
| Extension crashes mid-construction | Per-step try/catch; reverse teardown of already-built components; extension self-disables. |
| Leaked signals on prefs change while enabled | All settings subscriptions go through `SettingsController` registry; single `dispose()` disconnects all. |
| Leaked actors across disable/enable | Every actor owner implements `destroy()`; `ExtensionController` asserts empty pools in debug mode. |
| Lock screen / unlock dialog | Out of scope for A. `metadata.json` `session-modes` is left unset (default user session only). Documented as a future item. |
| Reload-on-edit loops during development | Document `gnome-extensions disable` before rebuild; no auto-reload logic shipped. |

---

## 9. Staged hooks for Sub-projects B and C (interfaces only, not implemented)

A's code is shaped so B/C can extend it, but A ships **no stub methods and no empty hooks** — the seams are design decisions, not code. Each item below names what a future sub-project will add and where, without that code existing today:

- **B — window behavior + core layouts:** A future `GeometryManager` module will be created and will take over the positioning logic currently inline in `OskWindowController`, consuming the `position-mode` setting. `LayoutManager.setActive(id)` is already designed to accept multiple ids (in A only one is registered, so the method is trivially correct but unused for switching). Additional layout JSON files (`compact.json`, `docked.json`, `traditional.json`) will be added under `resources/layouts/`. Key repeat and sticky modifiers will be added as new methods on `InputDispatcher` — none are reserved in A.
- **C — advanced input + panels:** `LayerManager` will gain `push(layer)`/`pop()` methods; long-press popup will be added to `KeyButton`; `GestureController` will be a new module. None of these methods or files exist in A.
- **D — prediction + handwriting:** `SuggestionBar` and `HandwritingPanel` will be new UI modules composed into `KeyboardRoot`. No slots or hooks for them exist in A's code.
- **E — polish/release:** performance instrumentation, if needed, will be added then; A ships no no-op markers.

No code for B/C/D/E is written in A. Hooks are **interface contracts documented here**, not pre-written stubs that add runtime surface.

---

## 10. Decisions log (ambiguities resolved, simplest stable choice)

1. **Number row default on.** Could be opt-in; chose on for tablet usability.
2. **Layout data format is JSON, not embedded JS.** Allows future locale layout files to be added without code changes; parsed once at register time and cached.
3. **Shift is latch + double-tap caps.** Simplest stable behavior covering the bulk of typing needs.
4. **No key repeat in A.** Avoids timer-leak risk and GNOME repeat-API variance; explicitly listed in acceptance exclusions.
5. **`position-mode` is a setting but only `bottom` works.** Reading it is a documented seam; other values coerce silently to `bottom`.
6. **`compact-density` is a setting but only adjusts styling slightly in A.** No layout switch.
7. **Auto theme uses `St.Settings.color_scheme` + 1s poll fallback.** Cheapest stable approach across GNOME 45–50.
8. **Schema version starts at 1.** Leaves room for `0` (pre-release) detection in future.
9. **`session-modes` unset in metadata.** A targets the user session only; lock-screen support is a future sub-project.
10. **Layout JSON ships in `resources/layouts/`.** Loaded at register time using the GNOME 45+ ES-module pattern. `extension.js` receives the `Extension` instance (its `this`) and exposes `this.path` (the on-disk extension directory provided by GNOME Shell). This path is passed explicitly into `LayoutManager`'s constructor — `LayoutManager` does **not** reach for a global `Me` reference. File loading: `Gio.File.new_for_path(\`${dir}/resources/layouts/us.json\`)`, read via `file.load_contents(null)` → decode the `GBytes` to a JS string → `JSON.parse`. No absolute paths, no legacy `imports.*` API.
</content>
</invoke>