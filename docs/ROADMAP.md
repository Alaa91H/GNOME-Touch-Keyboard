# Roadmap

Sub-project A (this release) is the foundation. The long-term target is a
complete professional touch keyboard with multilingual support, multiple
modes, prediction, emoji, and a privacy-aware clipboard history.

## Sub-projects

- **A — Foundation + Default layout** (current, v0.1.0). Modular
  architecture, one QWERTY layout, clean lifecycle, theme + prefs.
- **B — Multilingual + core input.** Arabic (RTL), German (QWERTZ),
  LanguageManager + LanguageSwitcher, Shift/Caps/sticky modifiers,
  symbols/numbers panels, long-press popups, key repeat.
- **C — Top bar + panels.** Toolbar, SuggestionBar, EmojiBar/EmojiPanel,
  ClipboardBar/ClipboardPanel, settings toggles.
- **D — Prediction + services.** IBusService, TypingBoosterService,
  PredictionService, sensitive-field suppression, AccessibilityService.
- **E — Modes.** Compact floating, Docked, Split, Traditional,
  drag/resize/snap, per-monitor geometry persistence.
- **F — Polish + release.** Accessibility, HiDPI/multi-monitor/tablet
  testing, performance pass, packaging, release zip.

## Target languages (first-class tested in B)

- Arabic (`ar`) — RTL, Arabic-Indic digit option.
- English (`en`) — QWERTY.
- German (`de`) — QWERTZ, ä ö ü ß.

Further languages: architecture-ready via the layout registry + GNOME
input source integration; not all are tested.

## Target modes (E)

Default, Compact floating, Docked, Split, Traditional.

## Privacy posture (carried from the long-term vision)

No telemetry, no network calls, no remote prediction, no cloud clipboard.
Clipboard history off by default; sensitive-field suppression where
detectable. A `docs/PRIVACY.md` is added when clipboard/prediction land
(sub-projects C/D).

## How the A architecture enables each future sub-project

- **B (multilingual):** drop additional `resources/layouts/*.json`
  files; `LayoutManager.register(id, data)` already accepts them.
  `setActive(id)` is a one-call switch.
- **C (panels):** `LayerManager` gains `push`/`pop`; `KeyboardRoot`
  composes new UI modules. The `#osk-root` actor is a vertical
  `St.BoxLayout`, so a toolbar/suggestion bar slots in above the rows
  without restructuring.
- **D (prediction):** new `src/services/` modules; `KeyboardRoot`
  exposes the press flow they hook into.
- **E (modes):** positioning logic (currently inline in
  `OskWindowController`) is extracted into a future `GeometryManager`
  that consumes the already-present `position-mode` setting.
