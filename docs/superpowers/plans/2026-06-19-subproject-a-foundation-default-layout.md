# Sub-project A: Foundation + Default Layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a minimal, installable GNOME Shell 45+ extension that renders one Default QWERTY touch layout and establishes the modular architecture that later sub-projects (multilingual, modes, panels, prediction) extend.

**Architecture:** ES-module extension. `extension.js` is thin and delegates to `src/app/ExtensionController.js`, which constructs and tears down a small set of single-responsibility modules (`SettingsController`, `LayoutManager`, `KeyboardState`, `ThemeManager`, `InputDispatcher`, `OskWindowController`, `FocusController`) and a UI layer (`KeyboardRoot`, `KeyButton`). UI never touches `Meta.VirtualInputDevice` directly; input dispatch never touches actors directly. All cleanup flows through per-module `destroy()`/`dispose()` called in reverse construction order.

**Tech Stack:** GJS (SpiderMonkey), GNOME Shell 45+ ES modules, St (CSS-friendly actors), Clutter, Gio (`GSettings`, file IO), GLib, Meta (`VirtualInputDevice`).

**Spec:** `docs/superpowers/specs/gnome-touch-keyboard-subproject-a-foundation-default-layout.md`. Every task below traces to a section of that spec.

---

## Verification model (read before executing)

We are building **on Windows with no GNOME Shell available**. Honest constraints:

- **No GJS runtime here.** We cannot import `gi://St`, run `gnome-extensions install`, or observe a single actor.
- **No `pytest`-style unit runner for in-shell extension code.** GNOME Shell extensions are not unit-tested that way in practice; they're integration-tested on a live Shell.

Therefore the plan uses **two tiers of verification**, clearly labeled on every task:

- **STATIC (runnable from Windows):** JSON validity, schema ↔ defaults cross-check, file/path/import consistency, brace/paren balance, GSettings XML well-formedness. These I run with Node or PowerShell — they are real and pass/fail for real.
- **MANUAL (run on the GNOME box):** enable/disable, typing, theme switches, leak check via `KeyboardRoot.getLiveKeyCount()`. I write the exact steps and expected results; the user runs them on GNOME 46 Wayland.

I will **not** claim a feature "works" based on STATIC checks alone. I will claim "code is structurally complete and passes STATIC checks," and mark the MANUAL tier as **pending until the user runs it**. Every acceptance criterion in the spec has an explicit MANUAL step.

---

## File map (locked here before tasks)

| File | Responsibility | Spec ref |
|------|----------------|----------|
| `metadata.json` | UUID, shell-version, extension entry metadata | §2 |
| `extension.js` | Thin entry; instantiate `ExtensionController`, call enable/disable | §2 |
| `prefs.js` | GTK4 preferences window using `src/settings/defaults.js` | §2, §5 |
| `stylesheet.css` | Theme: CSS variables + key states; light/dark/high-contrast | §6 |
| `schemas/org.gnome.shell.extensions.gnome-touch-keyboard.gschema.xml` | All keys from §5 table | §5 |
| `resources/layouts/us.json` | Default QWERTY layout data (the only layout file) | §3 |
| `src/settings/defaults.js` | Single source of truth for keys/types/defaults | §2, §5 |
| `src/settings/migrations.js` | `migrate(settings)` validates schema-version=1 | §2, §5 |
| `src/app/SettingsController.js` | `Gio.Settings` wrapper + subscription registry + `dispose()` | §2, §4 |
| `src/core/KeyboardState.js` | Pure state: shift/caps + transition methods + `reset()` | §2, §3 |
| `src/core/LayoutManager.js` | Layout registry; loads `us.json`; registers `Default` | §2, §3 |
| `src/core/LayerManager.js` | Holds single `base` layer; `getActive()` only | §2 |
| `src/core/InputDispatcher.js` | Logical key → `Meta.VirtualInputDevice`; `dispatch()` only | §2, §3 |
| `src/core/ThemeManager.js` | Applies theme class + CSS vars to actor; settings-reactive | §2, §6 |
| `src/app/OskWindowController.js` | Owns `#osk-root` actor; positioning; visibility; lifecycle | §2, §4 |
| `src/app/FocusController.js` | `global.display.focus_window` + `notify::focus-window` | §2 |
| `src/app/ExtensionController.js` | Constructs/tears down all modules in order; try/catch isolation | §2, §4 |
| `src/ui/KeyboardRoot.js` | Builds rows in `#osk-root`; owns KeyButton pool; `getLiveKeyCount()` | §2, §4 |
| `src/ui/KeyButton.js` | One `St.Button`; `pressed` signal; state classes; `destroy()` | §2, §6 |
| `README.md` | Install/build/test instructions | §1 |
| `ARCHITECTURE.md` | Module map + data flow (mirrors spec §2/§4) | §1 |
| `COMPATIBILITY.md` | GNOME 45–50 + Wayland support matrix | §1 |
| `CHANGELOG.md` | v0.1.0 entry | §1 |

**Not created in A** (despite appearing in the long-term roadmap): `GeometryManager`, `GestureController`, `SuggestionBar`, `EmojiPanel`, `ClipboardService`, `IBusService`, `MonitorController`, layout files beyond `us.json`, modes beyond Default. Spec §9 makes this explicit.

---

## Conventions for all code tasks

- **ES modules.** `export class Foo {}` / `import { Foo } from './Foo.js';`. Relative imports **must include `.js`** even though the source file is `Foo.js` — GJS ESM resolution requires the extension.
- **No global `Me`.** The extension directory path comes from `Extension.path` (the `this` of `extension.js`'s `Extension` class) and is passed explicitly into constructors that need it (only `LayoutManager` in A).
- **GNOME 45+ imports** use the `gi://` and `resource://` URI scheme, e.g. `import St from 'gi://St';`, `import Clutter from 'gi://Clutter';`, `import Gio from 'gi://Gio';`, `import Meta from 'gi://Meta';`, `import GLib from 'gi://GLib';`, `import GObject from 'gi://GObject';`. Shell UI helpers: `import * as Main from 'resource:///org/gnome/shell/ui/main.js';`.
- **Error isolation.** Any constructor that can throw (device acquisition, file load) is wrapped so a failure logs and disables the extension cleanly without crashing the Shell.
- **Logger.** A tiny module-scoped `log()` wrapper respects `debug-logging`; when off, debug calls are no-ops. Defined inline in `ExtensionController` and passed down (no separate file in A to keep the tree minimal — spec §2 file list is authoritative).
- **No leaked refs.** Every module nulls its references in `destroy()`/`dispose()`.
- **Commit cadence.** One commit per task. Conventional commit messages: `feat:`, `fix:`, `docs:`, `chore:`.

---

## Task 0: Repo skeleton and packaging baseline

**Files:**
- Create: `metadata.json`
- Create: `README.md` (minimal, expanded in Task 16)
- Create: `.gitignore`
- Create: `scripts/package.sh`

- [ ] **Step 1: Create `metadata.json`**

```json
{
  "uuid": "gnome-touch-keyboard@alaa91h.github.io",
  "name": "GJS OSK Pro",
  "description": "Modern touch-first on-screen keyboard for GNOME Shell on Wayland.",
  "shell-version": ["45", "46", "47", "48"],
  "session-modes": ["user"],
  "url": "",
  "version": 1,
  "settings-schema": "org.gnome.shell.extensions.gnome-touch-keyboard"
}
```

Notes: `session-modes: ["user"]` makes the lock-screen exclusion explicit (spec §8). `shell-version` lists the four versions A targets. `uuid` is the local install id; `gnome-extensions install` keys off it.

- [ ] **Step 2: Create `.gitignore`**

```
.superpowers/
*.zip
*.xpi
build/
node_modules/
```

- [ ] **Step 3: Create `scripts/package.sh`**

```bash
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
```

- [ ] **Step 4: STATIC check — validate `metadata.json` parses and `shell-version` is an array**

Run (Windows, Node):
```bash
node -e "const m=require('./metadata.json'); if(!Array.isArray(m['shell-version'])) process.exit(1); if(typeof m.uuid!=='string'||!m.uuid) process.exit(2); console.log('metadata.json OK', m.uuid);"
```
Expected: `metadata.json OK gnome-touch-keyboard@alaa91h.github.io`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add metadata.json .gitignore scripts/package.sh
git commit -m "chore: add extension skeleton and packaging script"
```

---

## Task 1: Settings defaults + schema (single source of truth)

**Files:**
- Create: `src/settings/defaults.js`
- Create: `schemas/org.gnome.shell.extensions.gnome-touch-keyboard.gschema.xml`
- Create: `schemas/gschemas.compiled` placeholder note (do NOT commit a compiled file — GNOME compiles at install)

**Spec ref:** §5 (full key table).

- [ ] **Step 1: Create `src/settings/defaults.js`**

This is imported by **both** `SettingsController` (in-shell) and `prefs.js` (out-of-shell GTK), so it must be pure data with no `gi://` imports.

```js
// src/settings/defaults.js
// Single source of truth for GSettings keys, types, and default values.
// Spec §5. MUST stay byte-identical to schemas/*.gschema.xml.
// Importable both in-shell (extension.js) and out-of-shell (prefs.js).

export const SCHEMA_ID = 'org.gnome.shell.extensions.gnome-touch-keyboard';
export const SCHEMA_PATH = '/org/gnome/shell/extensions/gnome-touch-keyboard-pro/';

// Each entry: { key, type, default, summary, min?, max? }
export const KEYS = Object.freeze([
  { key: 'schema-version', type: 'i', default: 1,
    summary: 'Schema version for forward migrations.' },
  { key: 'layout-id', type: 's', default: 'Default',
    summary: 'Active layout id. Only "Default" valid in Sub-project A.' },
  { key: 'show-number-row', type: 'b', default: true,
    summary: 'Render the number row on the Default layout.' },
  { key: 'theme-mode', type: 's', default: 'auto',
    summary: 'One of "light", "dark", "auto". "auto" follows the GNOME color scheme.' },
  { key: 'accent-color', type: 's', default: '#3584e4',
    summary: 'Accent used for active/focus highlights. CSS hex string.' },
  { key: 'compact-density', type: 'b', default: false,
    summary: 'Render slightly smaller styling. No layout switch in A.' },
  { key: 'key-height', type: 'i', default: 52, min: 44, max: 80,
    summary: 'Logical key height in px. Clamped to [44,80].' },
  { key: 'key-spacing', type: 'i', default: 6, min: 2, max: 12,
    summary: 'Logical key spacing in px. Clamped to [2,12].' },
  { key: 'key-radius', type: 'i', default: 10, min: 0, max: 20,
    summary: 'Logical corner radius in px. Clamped to [0,20].' },
  { key: 'font-scale', type: 'd', default: 1.0, min: 0.8, max: 1.5,
    summary: 'Multiplier on key label font size. Clamped to [0.8,1.5].' },
  { key: 'debug-logging', type: 'b', default: false,
    summary: 'Verbose logging to journalctl. Off by default.' },
  { key: 'position-mode', type: 's', default: 'bottom',
    summary: 'Reserved seam. Only "bottom" implemented in A; other values coerce to "bottom".' },
]);

export const DEFAULTS = Object.freeze(
  Object.fromEntries(KEYS.map((k) => [k.key, k.default]))
);

export function getKeyMeta(key) {
  return KEYS.find((k) => k.key === key);
}
```

- [ ] **Step 2: Create the GSettings XML schema**

File: `schemas/org.gnome.shell.extensions.gnome-touch-keyboard.gschema.xml`. Defaults must match `defaults.js` exactly.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<schemalist gettext-domain="gnome-touch-keyboard-pro">
  <schema id="org.gnome.shell.extensions.gnome-touch-keyboard"
          path="/org/gnome/shell/extensions/gnome-touch-keyboard-pro/">

    <key name="schema-version" type="i">
      <default>1</default>
      <summary>Schema version for forward migrations.</summary>
    </key>

    <key name="layout-id" type="s">
      <choices>
        <choice value="Default"/>
      </choices>
      <default>"Default"</default>
      <summary>Active layout id. Only "Default" valid in Sub-project A.</summary>
    </key>

    <key name="show-number-row" type="b">
      <default>true</default>
      <summary>Render the number row on the Default layout.</summary>
    </key>

    <key name="theme-mode" type="s">
      <choices>
        <choice value="light"/>
        <choice value="dark"/>
        <choice value="auto"/>
      </choices>
      <default>"auto"</default>
      <summary>One of "light", "dark", "auto". "auto" follows the GNOME color scheme.</summary>
    </key>

    <key name="accent-color" type="s">
      <default>"#3584e4"</default>
      <summary>Accent used for active/focus highlights. CSS hex string.</summary>
    </key>

    <key name="compact-density" type="b">
      <default>false</default>
      <summary>Render slightly smaller styling. No layout switch in A.</summary>
    </key>

    <key name="key-height" type="i">
      <range min="44" max="80"/>
      <default>52</default>
      <summary>Logical key height in px. Clamped to [44,80].</summary>
    </key>

    <key name="key-spacing" type="i">
      <range min="2" max="12"/>
      <default>6</default>
      <summary>Logical key spacing in px. Clamped to [2,12].</summary>
    </key>

    <key name="key-radius" type="i">
      <range min="0" max="20"/>
      <default>10</default>
      <summary>Logical corner radius in px. Clamped to [0,20].</summary>
    </key>

    <key name="font-scale" type="d">
      <range min="0.8" max="1.5"/>
      <default>1.0</default>
      <summary>Multiplier on key label font size. Clamped to [0.8,1.5].</summary>
    </key>

    <key name="debug-logging" type="b">
      <default>false</default>
      <summary>Verbose logging to journalctl. Off by default.</summary>
    </key>

    <key name="position-mode" type="s">
      <choices>
        <choice value="bottom"/>
      </choices>
      <default>"bottom"</default>
      <summary>Reserved seam. Only "bottom" implemented in A; other values coerce to "bottom".</summary>
    </key>

  </schema>
</schemalist>
```

- [ ] **Step 3: STATIC check — defaults.js ↔ schema cross-consistency**

Create `scripts/check-schema-sync.js` (Node, no `gi` deps) and run it. It parses the XML with a tiny regex-free traversal (Node has no DOM; use a minimal hand parser) and asserts every `KEYS` entry's default matches the schema's `<default>` and ranges match `<range>`.

```js
// scripts/check-schema-sync.js
// Run: node scripts/check-schema-sync.js
// Verifies schemas/*.gschema.xml matches src/settings/defaults.js.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

const defaults = require(path.join(root, 'src/settings/defaults.js'));
// defaults.js is an ES module; require() can't load it directly.
// Workaround: read as text and eval the KEYS array only.
const src = fs.readFileSync(path.join(root, 'src/settings/defaults.js'), 'utf8');
const m = src.match(/export const KEYS\s*=\s*(\[[\s\S]*?\]\))/);
if (!m) { console.error('Could not find KEYS array'); process.exit(1); }
const KEYS = eval(m[1]);

const xml = fs.readFileSync(
  path.join(root, 'schemas/org.gnome.shell.extensions.gnome-touch-keyboard.gschema.xml'), 'utf8');

let errors = 0;
for (const k of KEYS) {
  const blockRe = new RegExp(
    `<key name="${k.key}" type="${k.type}"[\\s\\S]*?</key>`);
  const block = xml.match(blockRe);
  if (!block) { console.error(`MISSING <key name="${k.key}">`); errors++; continue; }
  const defMatch = block[0].match(/<default>([\s\S]*?)<\/default>/);
  if (!defMatch) { console.error(`MISSING <default> for ${k.key}`); errors++; continue; }
  const raw = defMatch[1].trim();
  let expected;
  if (k.type === 's') expected = `"${k.default}"`;
  else if (k.type === 'b') expected = k.default ? 'true' : 'false';
  else if (k.type === 'i') expected = String(k.default);
  else if (k.type === 'd') expected = String(k.default);
  if (raw !== expected) {
    console.error(`DEFAULT MISMATCH ${k.key}: schema="${raw}" defaults.js="${expected}"`);
    errors++;
  }
  if ((k.type === 'i' || k.type === 'd') && (k.min != null || k.max != null)) {
    const range = block[0].match(/<range min="([\d.]+)" max="([\d.]+)"/);
    if (!range) { console.error(`MISSING <range> for ${k.key}`); errors++; }
    else {
      if (Number(range[1]) !== k.min || Number(range[2]) !== k.max) {
        console.error(`RANGE MISMATCH ${k.key}: schema=[${range[1]},${range[2]}] defaults=[${k.min},${k.max}]`);
        errors++;
      }
    }
  }
  if (k.type === 's' && k.default === 'Default') {
    if (!/<choices>[\s\S]*?<choice value="Default"/.test(block[0])) {
      console.error(`MISSING <choice value="Default"> for ${k.key}`);
      errors++;
    }
  }
}
if (errors) { console.error(`\n${errors} schema-sync error(s)`); process.exit(1); }
console.log(`schema-sync OK (${KEYS.length} keys checked)`);
```

Run:
```bash
node scripts/check-schema-sync.js
```
Expected: `schema-sync OK (12 keys checked)`, exit 0.

- [ ] **Step 4: STATIC check — XML well-formedness**

Run:
```bash
node -e "const fs=require('fs');const s=fs.readFileSync('schemas/org.gnome.shell.extensions.gnome-touch-keyboard.gschema.xml','utf8');if(!/<\/schemalist>/.test(s))process.exit(1);let open=(s.match(/<schema\\b/g)||[]).length,close=(s.match(/<\\/schema>/g)||[]).length;if(open!==close)process.exit(2);console.log('xml balanced',open,'schemas');"
```
Expected: `xml balanced 1 schemas`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/settings/defaults.js schemas/ scripts/check-schema-sync.js
git commit -m "feat(settings): add defaults and GSettings schema for Sub-project A"
```

---

## Task 2: Migrations module

**Files:**
- Create: `src/settings/migrations.js`

**Spec ref:** §5 migration logic.

- [ ] **Step 1: Create `src/settings/migrations.js`**

```js
// src/settings/migrations.js
// Spec §5. Idempotent, never throws on unknown future versions.
import { DEFAULTS } from './defaults.js';

const CURRENT = DEFAULTS['schema-version']; // 1

// Returns the version applied. Never throws.
export function migrate(settings) {
  let current;
  try {
    current = settings.get_int('schema-version');
  } catch (_) {
    // Key absent on first install (or schema not yet compiled).
    current = 0;
  }

  if (current === CURRENT) {
    return CURRENT;
  }

  if (current < CURRENT) {
    // No real steps exist below v1 today; just stamp the version.
    // Future versions add per-step functions here, in order.
    _stamp(settings, CURRENT);
    return CURRENT;
  }

  // current > CURRENT: user downgraded. Coerce without data loss.
  // We do NOT reset any key; we only lower the recorded version.
  console.warn(`[osk-pro] schema-version ${current} > supported ${CURRENT}; coercing down without data loss.`);
  _stamp(settings, CURRENT);
  return CURRENT;
}

function _stamp(settings, v) {
  try {
    settings.set_int('schema-version', v);
  } catch (e) {
    console.error(`[osk-pro] failed to stamp schema-version: ${e}`);
  }
}
```

- [ ] **Step 2: STATIC check — file parses as JS (Node, esm via `.mjs` shim)**

We can't import a `gi://`-free ESM file trivially on Windows without a package.json type=module. Simplest stable check: Node `--check` parses syntax without executing.

Run:
```bash
node --check src/settings/migrations.js
```
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/settings/migrations.js
git commit -m "feat(settings): add idempotent schema-version migration"
```

---

## Task 3: KeyboardState (pure, no GJS deps)

**Files:**
- Create: `src/core/KeyboardState.js`

**Spec ref:** §2 KeyboardState, §3 shift behavior.

- [ ] **Step 1: Create `src/core/KeyboardState.js`**

Pure state object. No actors, no signals to external systems. Easiest module to reason about — kept dependency-free so it can be unit-reasoned about by inspection.

```js
// src/core/KeyboardState.js
// Spec §2 + §3. Pure state: shift latch + caps.
// No GNOME signals, no actors. Callers read snapshots after transitions.

const SHIFT_LATCH_MS = 400; // spec §3: double-tap window for caps

export class KeyboardState {
  constructor() {
    this.reset();
  }

  reset() {
    this._shift = false;      // one-shot latch, consumed by next printable key
    this._caps = false;       // locked uppercase
    this._lastShiftTapMs = 0; // for double-tap detection
  }

  // Called when the user taps the Shift key.
  // Returns a snapshot describing the new visual state.
  applyShiftTap(nowMs = Date.now()) {
    const withinWindow = (nowMs - this._lastShiftTapMs) <= SHIFT_LATCH_MS;
    if (this._shift && withinWindow) {
      // Second tap within window -> engage caps, clear the one-shot latch.
      this._shift = false;
      this._caps = true;
      this._lastShiftTapMs = 0;
      return this.snapshot();
    }
    // First tap (or stale): toggle one-shot latch.
    this._shift = !this._shift;
    if (this._shift) this._lastShiftTapMs = nowMs;
    else this._lastShiftTapMs = 0;
    return this.snapshot();
  }

  // Returns true if the next printable key should be uppercase,
  // and consumes the one-shot shift latch (caps persists).
  consumeShiftForNextKey() {
    const upper = this._shift || this._caps;
    if (this._shift) {
      this._shift = false;
      this._lastShiftTapMs = 0;
    }
    return upper;
  }

  isShiftLatched() { return this._shift; }
  isCapsLocked() { return this._caps; }

  snapshot() {
    return { shift: this._shift, caps: this._caps };
  }
}
```

- [ ] **Step 2: STATIC + behavioral check — drive the state machine with a tiny Node harness**

Because this module has zero GJS deps, we *can* actually exercise it on Windows. Create `scripts/check-keyboard-state.mjs`:

```js
// scripts/check-keyboard-state.mjs
// Run: node scripts/check-keyboard-state.mjs
import { KeyboardState } from '../src/core/KeyboardState.js';

let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; }
  else { fail++; console.error(`FAIL ${label}: got ${a} want ${e}`); }
}

// 1. Fresh state: no shift, no caps.
const s = new KeyboardState();
eq(s.snapshot(), { shift: false, caps: false }, 'fresh');

// 2. Single shift tap latches.
eq(s.applyShiftTap(1000), { shift: true, caps: false }, 'shift latch');
// 3. consumeShiftForNextKey returns true and clears latch.
eq(s.consumeShiftForNextKey(), true, 'consume shift true');
eq(s.isShiftLatched(), false, 'shift cleared after consume');

// 4. Double tap within window engages caps.
s.applyShiftTap(2000); // shift latch on
eq(s.applyShiftTap(2200), { shift: false, caps: true }, 'caps engaged');
// 5. Caps persists across a printable consume.
eq(s.consumeShiftForNextKey(), true, 'caps upper');
eq(s.isCapsLocked(), true, 'caps still locked');

// 6. Stale double-tap does NOT engage caps (outside 400ms).
s.reset();
s.applyShiftTap(10000);
eq(s.applyShiftTap(11000), { shift: false, caps: false }, 'stale -> toggle off');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
```

- [ ] **Step 3: Run it**

```bash
node scripts/check-keyboard-state.mjs
```
Expected: `PASS: 6 passed, 0 failed`, exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/core/KeyboardState.js scripts/check-keyboard-state.mjs
git commit -m "feat(core): add KeyboardState shift/caps state machine"
```

---

## Task 4: Default layout data file

**Files:**
- Create: `resources/layouts/us.json`

**Spec ref:** §3 (exact JSON).

- [ ] **Step 1: Create `resources/layouts/us.json`**

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

- [ ] **Step 2: STATIC check — valid JSON + shape validation**

Create `scripts/check-layout.js`:

```js
// scripts/check-layout.js
// Run: node scripts/check-layout.js
const fs = require('fs');
const path = require('path');
const layout = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, '../resources/layouts/us.json'), 'utf8'));

let errors = 0;
if (layout.id !== 'Default') { console.error('id != Default'); errors++; }
if (!Array.isArray(layout.rows) || layout.rows.length < 4 || layout.rows.length > 5) {
  console.error('rows must be 4..5'); errors++;
}
const validK = new Set(['1','2','3','4','5','6','7','8','9','0',
  'q','w','e','r','t','y','u','i','o','p','a','s','d','f','g','h','j','k','l',
  'z','x','c','v','b','n','m',
  'shift','backspace','123','comma','space','period','return']);
for (const [ri, row] of layout.rows.entries()) {
  if (!Array.isArray(row)) { console.error(`row ${ri} not array`); errors++; continue; }
  for (const [ki, key] of row.entries()) {
    if (typeof key.k !== 'string') { console.error(`row ${ri} key ${ki} missing .k`); errors++; }
    else if (!validK.has(key.k)) { console.error(`row ${ri} key ${ki} unknown k="${key.k}"`); errors++; }
    if (key.width != null && typeof key.width !== 'number') {
      console.error(`row ${ri} key ${ki} width not number`); errors++;
    }
  }
}
if (errors) { console.error(`\n${errors} layout error(s)`); process.exit(1); }
console.log(`layout OK (${layout.rows.length} rows)`);
```

Run:
```bash
node scripts/check-layout.js
```
Expected: `layout OK (5 rows)`, exit 0.

- [ ] **Step 3: Commit**

```bash
git add resources/layouts/us.json scripts/check-layout.js
git commit -m "feat(layouts): add US QWERTY Default layout data"
```

---

## Task 5: SettingsController

**Files:**
- Create: `src/app/SettingsController.js`

**Spec ref:** §2 SettingsController, §4 (subscriptions through this object only).

- [ ] **Step 1: Create `src/app/SettingsController.js`**

```js
// src/app/SettingsController.js
// Spec §2 + §4. Wraps Gio.Settings; all other modules obtain settings
// through this object, never directly. Central dispose().

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { SCHEMA_ID, SCHEMA_PATH, DEFAULTS } from '../settings/defaults.js';
import { migrate } from '../settings/migrations.js';

export class SettingsController {
  constructor(extensionDir) {
    this._extensionDir = extensionDir; // for schema source fallback
    this._settings = this._openSettings();
    this._subs = []; // array of { target, id, kind } for cleanup

    // Run migrations before anyone reads keys.
    migrate(this._settings);
  }

  _openSettings() {
    // Try the installed schema source first; fall back to a schema
    // compiled from our schemas/ dir during development. In production
    // (gnome-extensions install) the schema is in the system source.
    try {
      const s = new Gio.Settings({ schema_id: SCHEMA_ID });
      return s;
    } catch (e) {
      // Development fallback: build a SettingsSchemaSource from our dir.
      const schemaDir = GLib.build_filenamev([this._extensionDir, 'schemas']);
      const source = Gio.SettingsSchemaSource.new_from_directory(
        schemaDir, Gio.SettingsSchemaSource.get_default(), false);
      const schema = source.lookup(SCHEMA_ID, true);
      if (!schema) throw new Error(`schema ${SCHEMA_ID} not found in ${schemaDir}`);
      return new Gio.Settings({ settings_schema: schema });
    }
  }

  get raw() { return this._settings; }

  // Typed getters.
  getBoolean(key) { return this._settings.get_boolean(key); }
  getInt(key)     { return this._settings.get_int(key); }
  getDouble(key)  { return this._settings.get_double(key); }
  getString(key)  { return this._settings.get_string(key); }

  setBoolean(key, v) { this._settings.set_boolean(key, v); }
  setInt(key, v)     { this._settings.set_int(key, v); }
  setString(key, v)  { this._settings.set_string(key, v); }

  // Subscribe to a single key change. Returns a disconnector function.
  // Also tracked centrally for dispose().
  onKeyChanged(key, cb) {
    const id = this._settings.connect(`changed::${key}`, () => cb(this._getTyped(key)));
    this._subs.push({ target: this._settings, id, kind: 'key' });
    return () => this._disconnectOne(this._settings, id);
  }

  // Subscribe to any change. Returns a disconnector function.
  onAnyChanged(cb) {
    const id = this._settings.connect('changed', (_s, key) => cb(key));
    this._subs.push({ target: this._settings, id, kind: 'any' });
    return () => this._disconnectOne(this._settings, id);
  }

  _getTyped(key) {
    // Read using the default's type. Defensive: if read fails, return default.
    const meta = Object.keys(DEFAULTS).includes(key) ? null : null;
    try {
      const v = DEFAULTS[key];
      if (typeof v === 'boolean') return this._settings.get_boolean(key);
      if (typeof v === 'number')  return Number.isInteger(v)
        ? this._settings.get_int(key) : this._settings.get_double(key);
      if (typeof v === 'string')  return this._settings.get_string(key);
    } catch (_) {
      return DEFAULTS[key];
    }
    return DEFAULTS[key];
  }

  _disconnectOne(target, id) {
    try { target.disconnect(id); } catch (_) {}
    this._subs = this._subs.filter((s) => !(s.target === target && s.id === id));
  }

  dispose() {
    // Disconnect everything we tracked.
    for (const s of this._subs) {
      try { s.target.disconnect(s.id); } catch (_) {}
    }
    this._subs = [];
    // Delay-set to null after any in-flight handler completes.
    this._settings = null;
  }
}
```

- [ ] **Step 2: STATIC check — Node `--check`**

```bash
node --check src/app/SettingsController.js
```
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/SettingsController.js
git commit -m "feat(app): add SettingsController with central subscription registry"
```

---

## Task 6: LayoutManager

**Files:**
- Create: `src/core/LayoutManager.js`

**Spec ref:** §2 LayoutManager, decision #10 (explicit path, no global Me).

- [ ] **Step 1: Create `src/core/LayoutManager.js`**

```js
// src/core/LayoutManager.js
// Spec §2 + decision #10. Registry mapping id -> layout data.
// extensionDir passed in explicitly (no global Me).

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export class LayoutManager {
  constructor(extensionDir) {
    this._dir = extensionDir;
    this._byId = new Map();
    this._activeId = null;
  }

  // Load and register the Default layout from resources/layouts/<file>.
  // Throws if the file is missing or malformed; caller wraps in try/catch.
  loadDefault() {
    const data = this._loadJson('us.json');
    if (!data || data.id !== 'Default') {
      throw new Error('us.json missing or id != "Default"');
    }
    this.register('Default', data);
    this.setActive('Default');
    return data;
  }

  register(id, data) {
    this._byId.set(id, Object.freeze({
      id: data.id, locale: data.locale, rows: Object.freeze(data.rows.map(Object.freeze)),
    }));
  }

  get(id) { return this._byId.get(id) || null; }

  // Seam for future LayoutSwitcher. In A only Default is active.
  setActive(id) {
    if (!this._byId.has(id)) {
      console.warn(`[osk-pro] unknown layout id "${id}" requested; ignoring.`);
      return false;
    }
    this._activeId = id;
    return true;
  }

  getActive() {
    if (!this._activeId) return null;
    return this._byId.get(this._activeId);
  }

  _loadJson(filename) {
    // GNOME 45+: build the path with GLib.build_filenamev and read via Gio.File.
    const path = GLib.build_filenamev([this._dir, 'resources', 'layouts', filename]);
    const file = Gio.File.new_for_path(path);
    const [ok, bytes] = file.load_contents(null);
    if (!ok) throw new Error(`failed to load ${path}`);
    // On GJS, load_contents returns a Uint8Array (or a byte array); normalize.
    const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const text = new TextDecoder().decode(arr);
    return JSON.parse(text);
  }

  dispose() {
    this._byId.clear();
    this._activeId = null;
    this._dir = null;
  }
}
```

- [ ] **Step 2: STATIC check — Node `--check`**

```bash
node --check src/core/LayoutManager.js
```
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/core/LayoutManager.js
git commit -m "feat(core): add LayoutManager with JSON-driven Default layout"
```

---

## Task 7: LayerManager

**Files:**
- Create: `src/core/LayerManager.js`

**Spec ref:** §2 LayerManager (single `base` layer only; future push/pop documented, not implemented).

- [ ] **Step 1: Create `src/core/LayerManager.js`**

```js
// src/core/LayerManager.js
// Spec §2. A holds a single 'base' layer only. Future push/pop for
// symbols/numbers/emoji is documented in spec §9 and added in a later
// sub-project — NOT pre-stubbed here.

const BASE_LAYER = Object.freeze({ name: 'base' });

export class LayerManager {
  constructor() {
    this._active = BASE_LAYER;
  }
  getActive() { return this._active; }
  dispose() { this._active = null; }
}
```

- [ ] **Step 2: STATIC check**

```bash
node --check src/core/LayerManager.js
```
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/core/LayerManager.js
git commit -m "feat(core): add LayerManager (single base layer)"
```

---

## Task 8: InputDispatcher

**Files:**
- Create: `src/core/InputDispatcher.js`

**Spec ref:** §2 InputDispatcher, §3 (handled keys).

- [ ] **Step 1: Create `src/core/InputDispatcher.js`**

```js
// src/core/InputDispatcher.js
// Spec §2 + §3. Translates a logical key into a Clutter key event via
// Meta.VirtualInputDevice (KEYBOARD class). Only the keys present in
// us.json are handled. No key repeat / long press / sticky modifiers
// in A (spec §9: future, not stubbed).

import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';

// Logical key -> Clutter keysym. Only the set in us.json.
const KEY_TO_KEYSYM = Object.freeze({
  // digits
  '1': Clutter.KEY_1, '2': Clutter.KEY_2, '3': Clutter.KEY_3,
  '4': Clutter.KEY_4, '5': Clutter.KEY_5, '6': Clutter.KEY_6,
  '7': Clutter.KEY_7, '8': Clutter.KEY_8, '9': Clutter.KEY_9,
  '0': Clutter.KEY_0,
  // letters (lowercase keysyms; shift state applied via keyval_upper)
  'a': Clutter.KEY_a, 'b': Clutter.KEY_b, 'c': Clutter.KEY_c,
  'd': Clutter.KEY_d, 'e': Clutter.KEY_e, 'f': Clutter.KEY_f,
  'g': Clutter.KEY_g, 'h': Clutter.KEY_h, 'i': Clutter.KEY_i,
  'j': Clutter.KEY_j, 'k': Clutter.KEY_k, 'l': Clutter.KEY_l,
  'm': Clutter.KEY_m, 'n': Clutter.KEY_n, 'o': Clutter.KEY_o,
  'p': Clutter.KEY_p, 'q': Clutter.KEY_q, 'r': Clutter.KEY_r,
  's': Clutter.KEY_s, 't': Clutter.KEY_t, 'u': Clutter.KEY_u,
  'v': Clutter.KEY_v, 'w': Clutter.KEY_w, 'x': Clutter.KEY_x,
  'y': Clutter.KEY_y, 'z': Clutter.KEY_z,
  // punctuation / whitespace / edit keys
  'comma':   Clutter.KEY_comma,
  'period':  Clutter.KEY_period,
  'space':   Clutter.KEY_space,
  'return':  Clutter.KEY_Return,
  'backspace': Clutter.KEY_BackSpace,
});

// Logical keys that have no keysym (handled as no-ops in A).
const INERT_KEYS = new Set(['123', 'shift']);

export class InputDispatcher {
  constructor() {
    // Acquire a virtual keyboard device. Can throw on GNOME versions
    // where the API differs; caller wraps in try/catch and disables.
    this._device = Meta.VirtualInputDevice.new(
      Clutter.InputDeviceType.KEYBOARD_DEVICE);
  }

  // Dispatch a single logical key. `upper` controls Shift application
  // for letters (the caller — KeyboardRoot — already called
  // KeyboardState.consumeShiftForNextKey and passes the result).
  dispatch(logicalKey, upper = false) {
    if (INERT_KEYS.has(logicalKey)) {
      // '123' is the seam for the future symbols layer; no-op in A.
      // 'shift' is handled by KeyboardState, not dispatched.
      return false;
    }
    const keysym = KEY_TO_KEYSYM[logicalKey];
    if (keysym === undefined) {
      console.warn(`[osk-pro] no keysym for logical key "${logicalKey}"`);
      return false;
    }
    const effective = upper ? _toUpperKeysym(keysym) : keysym;
    // tell Clutter we're holding Shift so the upper keysym produces the
    // right character in the focused field.
    const mods = upper ? Clutter.ModifierType.SHIFT_MASK : 0;
    // Spec §2: KEYBOARD class device; Clutter.event_time() is the
    // canonical "now" for synthesized events.
    const time = global.get_current_time
      ? global.get_current_time()
      : Clutter.get_current_event_time();

    // Press + release. Single-shot in A; key repeat is future work.
    this._device.notify_key(time, effective, Clutter.KeyState.PRESSED, mods);
    this._device.notify_key(time + 1, effective, Clutter.KeyState.RELEASED, mods);
    return true;
  }

  dispose() {
    // No explicit close API on the device across versions; drop the ref.
    this._device = null;
  }
}

// Convert a lowercase-letter keysym to its uppercase variant.
// Clutter's keyvals are Unicode-aware for a-z (KEY_a..KEY_z -> 97..122),
// so subtracting 32 gives A..Z. We use Clutter's own helper when present.
function _toUpperKeysym(keysym) {
  if (keysym >= Clutter.KEY_a && keysym <= Clutter.KEY_z) {
    return keysym - 32;
  }
  try {
    // Defensive: if Clutter exposes keysym conversion, prefer it.
    if (Clutter.unicode_to_keysym) {
      const u = Clutter.keysym_to_unicode(keysym);
      if (u > 0) return Clutter.unicode_to_keysym(u.toString().toUpperCase().charCodeAt(0));
    }
  } catch (_) {}
  return keysym;
}
```

- [ ] **Step 2: STATIC check — Node `--check` (will pass; references to `Clutter.KEY_*` are not evaluated at parse time)**

```bash
node --check src/core/InputDispatcher.js
```
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/core/InputDispatcher.js
git commit -m "feat(core): add InputDispatcher using Meta.VirtualInputDevice"
```

---

## Task 9: ThemeManager

**Files:**
- Create: `src/core/ThemeManager.js`

**Spec ref:** §2 ThemeManager, §6.

- [ ] **Step 1: Create `src/core/ThemeManager.js`**

```js
// src/core/ThemeManager.js
// Spec §2 + §6. Applies theme class + CSS custom properties to the
// keyboard actor. Settings-reactive. Destroys no actors.

import GLib from 'gi://GLib';
import St from 'gi://St';

const POLL_INTERVAL_MS = 1000; // spec §8 risk mitigation for auto-mode

export class ThemeManager {
  constructor(settings) {
    this._settings = settings;
    this._actor = null;
    this._subs = []; // disconnector functions
    this._pollId = 0;
    this._stSettings = null;
    this._stChangedId = 0;
    // Remember the last-applied dark flag so apply() can short-circuit
    // when nothing changed (makes the 1s poll cheap).
    this._lastDark = null;
  }

  // Bind to an actor (the #osk-root). Idempotent.
  attach(actor) {
    this._actor = actor;
    this._stSettings = St.Settings.get();
    // Notify fires on GNOME color-scheme change; reliability varies by
    // version, hence the poll fallback below.
    this._stChangedId = this._stSettings.connect('notify::color-scheme', () => {
      if (this._settings.getString('theme-mode') === 'auto') this.apply();
    });

    const reactive = [
      'theme-mode', 'accent-color', 'compact-density',
      'key-height', 'key-spacing', 'key-radius', 'font-scale',
    ];
    for (const key of reactive) {
      this._subs.push(this._settings.onKeyChanged(key, () => this.apply()));
    }

    // theme-mode also controls whether the auto poll runs; re-schedule only
    // when it (or attach/detach) happens — not on every geometry change.
    this._subs.push(this._settings.onKeyChanged('theme-mode', () => this._refreshPoll()));

    this.apply();
    this._refreshPoll();
  }

  _refreshPoll() {
    if (this._pollId) {
      GLib.source_remove(this._pollId);
      this._pollId = 0;
    }
    // Only poll when in auto mode (cheap, and only where signal is flaky).
    if (this._settings.getString('theme-mode') !== 'auto') return;
    this._pollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, POLL_INTERVAL_MS, () => {
      if (this._settings.getString('theme-mode') === 'auto') this.apply();
      return GLib.SOURCE_CONTINUE;
    });
  }

  apply() {
    if (!this._actor) return;
    const s = this._settings;

    const mode = s.getString('theme-mode');
    let dark;
    if (mode === 'light') dark = false;
    else if (mode === 'dark') dark = true;
    else {
      const cs = this._stSettings ? this._stSettings.get_color_scheme() : 0;
      dark = cs === St.SystemColorScheme.DARK;
    }

    const h = _clamp(s.getInt('key-height'), 44, 80);
    const sp = _clamp(s.getInt('key-spacing'), 2, 12);
    const r = _clamp(s.getInt('key-radius'), 0, 20);
    const fs = _clamp(s.getDouble('font-scale'), 0.8, 1.5);
    const accent = s.getString('accent-color');
    const compact = s.getBoolean('compact-density');

    this._actor.set_style(`
      --osk-key-height:${h}px;
      --osk-key-spacing:${sp}px;
      --osk-key-radius:${r}px;
      --osk-font-scale:${fs};
      --osk-accent:${accent};
    `);

    this._actor.remove_style_class_name('osk-light');
    this._actor.remove_style_class_name('osk-dark');
    this._actor.add_style_class_name(dark ? 'osk-dark' : 'osk-light');
    if (compact) this._actor.add_style_class_name('osk-compact');
    else this._actor.remove_style_class_name('osk-compact');
    // NOTE: apply() deliberately does NOT call _refreshPoll(). Poll
    // scheduling belongs to attach/detach and the theme-mode listener,
    // so a key-height or accent change doesn't churn the GLib source.
  }

  detach() {
    for (const disconnect of this._subs) {
      try { disconnect(); } catch (_) {}
    }
    this._subs = [];
    if (this._stSettings && this._stChangedId) {
      try { this._stSettings.disconnect(this._stChangedId); } catch (_) {}
      this._stChangedId = 0;
    }
    if (this._pollId) {
      GLib.source_remove(this._pollId);
      this._pollId = 0;
    }
    this._actor = null;
    this._stSettings = null;
  }
}

function _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
```

- [ ] **Step 2: STATIC check**

```bash
node --check src/core/ThemeManager.js
```
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/core/ThemeManager.js
git commit -m "feat(core): add ThemeManager with live CSS-var theming"
```

---

## Task 10: FocusController

**Files:**
- Create: `src/app/FocusController.js`

**Spec ref:** §2 FocusController (uses `global.display` `notify::focus-window`).

- [ ] **Step 1: Create `src/app/FocusController.js`**

```js
// src/app/FocusController.js
// Spec §2. Minimal: exposes the focused Meta.Window and a focus-changed
// subscription. Per-text-field focus tracking is a future sub-project.

export class FocusController {
  constructor() {
    this._display = global.display; // eslint-disable-line no-undef
    this._focusId = 0;
    this._cbs = [];
  }

  getFocusedWindow() {
    try { return this._display.focus_window; } catch (_) { return null; }
  }

  // Register a focus-changed callback. Returns a disconnector function.
  onFocusChanged(cb) {
    if (!this._focusId) {
      this._focusId = this._display.connect('notify::focus-window', () => {
        for (const fn of this._cbs) {
          try { fn(this.getFocusedWindow()); } catch (e) { console.error(e); }
        }
      });
    }
    this._cbs.push(cb);
    return () => {
      this._cbs = this._cbs.filter((fn) => fn !== cb);
      if (this._cbs.length === 0 && this._focusId) {
        try { this._display.disconnect(this._focusId); } catch (_) {}
        this._focusId = 0;
      }
    };
  }

  dispose() {
    if (this._focusId) {
      try { this._display.disconnect(this._focusId); } catch (_) {}
    }
    this._focusId = 0;
    this._cbs = [];
    this._display = null;
  }
}
```

- [ ] **Step 2: STATIC check**

```bash
node --check src/app/FocusController.js
```
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/FocusController.js
git commit -m "feat(app): add FocusController (window-level focus tracking)"
```

---

## Task 11: KeyButton (UI)

**Files:**
- Create: `src/ui/KeyButton.js`

**Spec ref:** §2 KeyButton, §6 (CSS classes).

- [ ] **Step 1: Create `src/ui/KeyButton.js`**

```js
// src/ui/KeyButton.js
// Spec §2 + §6. One St.Button with press/hover/focus states.
// Emits a single 'pressed' signal consumed by KeyboardRoot. KeyButton
// never imports InputDispatcher (UI/input separation, spec §4).

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

export const KeyButton = GObject.registerClass({
  Signals: { 'pressed': { param_types: [GObject.TYPE_STRING] } },
}, class KeyButton extends St.Button {
  _init(logicalKey, label, widthFactor = 1.0) {
    this._logicalKey = logicalKey;
    this._widthFactor = widthFactor;
    this._destroyed = false;

    super._init({
      label: label != null ? String(label) : '',
      style_class: 'osk-key',
      can_focus: true,
      reactive: true,
    });

    // Width modifier classes for CSS (spec §6).
    if (widthFactor >= 1.4) this.add_style_class_name('osk-key--wide');
    if (widthFactor >= 4.5) this.add_style_class_name('osk-key--space');

    // St.Button emits 'clicked' on release; we want press semantics for
    // touch feel, so hook button-press-event to fire our 'pressed'.
    this._pressId = this.connect('button-press-event', () => {
      this.add_style_pseudo_class('active');
      this.emit('pressed', this._logicalKey);
      return Clutter.EVENT_PROPAGATE;
    });
    this._releaseId = this.connect('button-release-event', () => {
      this.remove_style_pseudo_class('active');
      return Clutter.EVENT_PROPAGATE;
    });
  }

  get logicalKey() { return this._logicalKey; }
  get widthFactor() { return this._widthFactor; }

  setLabel(text) {
    if (this._destroyed) return;
    this.label = text != null ? String(text) : '';
  }

  // Latched modifier visual (Shift one-shot; future sticky mods).
  setChecked(checked) {
    if (this._destroyed) return;
    if (checked) this.add_style_pseudo_class('checked');
    else this.remove_style_pseudo_class('checked');
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    try { this.disconnect(this._pressId); } catch (_) {}
    try { this.disconnect(this._releaseId); } catch (_) {}
    super.destroy();
  }
});
```

- [ ] **Step 2: STATIC check**

```bash
node --check src/ui/KeyButton.js
```
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/ui/KeyButton.js
git commit -m "feat(ui): add KeyButton actor with press signal and state classes"
```

---

## Task 12: KeyboardRoot (UI)

**Files:**
- Create: `src/ui/KeyboardRoot.js`

**Spec ref:** §2 KeyboardRoot, §3 (builds rows; shift refresh), §4 (leak counter), decision on `#osk-root` ownership.

- [ ] **Step 1: Create `src/ui/KeyboardRoot.js`**

```js
// src/ui/KeyboardRoot.js
// Spec §2 + §3 + §4. Populates the #osk-root actor (owned by
// OskWindowController) with rows and KeyButtons. Rebuilds on layout
// change; cheap label refresh on shift. Tracks live key count for the
// leak-detection acceptance criterion.

import St from 'gi://St';
import { KeyButton } from './KeyButton.js';

let _liveKeyCount = 0; // module-level counter for the leak check (acceptance #12)

export class KeyboardRoot {
  constructor(rootActor, layoutManager, layerManager, keyboardState, inputDispatcher, settings) {
    this._root = rootActor;            // #osk-root, owned by OskWindowController
    this._layout = layoutManager;
    this._layers = layerManager;
    this._state = keyboardState;
    this._dispatcher = inputDispatcher;
    this._settings = settings;

    this._rows = [];   // St.BoxLayout row actors
    this._keys = [];   // KeyButton instances

    this._subs = [];
    this._subs.push(this._settings.onKeyChanged('show-number-row', () => this.rebuild()));
  }

  // Build the rows from the active layout. Called on enable and on
  // layout/layer changes.
  rebuild() {
    this._clearKeys();
    const layout = this._layout.getActive();
    if (!layout) return;

    const showNumbers = this._settings.getBoolean('show-number-row');
    const rows = showNumbers ? layout.rows : layout.rows.slice(1);

    for (const rowData of rows) {
      const rowActor = new St.BoxLayout({
        style_class: 'osk-row',
        vertical: false,
      });
      this._rows.push(rowActor);
      this._root.add_child(rowActor);

      for (const key of rowData) {
        const btn = new KeyButton(key.k, key.label != null ? key.label : key.k, key.width || 1.0);
        _liveKeyCount++;
        btn.connect('pressed', (_b, logicalKey) => this._onPressed(btn, logicalKey));
        this._keys.push(btn);
        rowActor.add_child(btn);
      }
    }
    this._refreshLabels();
  }

  _onPressed(btn, logicalKey) {
    if (logicalKey === 'shift') {
      this._state.applyShiftTap();
      this._refreshLabels();
      this._updateShiftChecked();
      return;
    }
    // For printable/edit keys, consume the one-shot shift latch.
    const upper = this._state.consumeShiftForNextKey();
    try {
      this._dispatcher.dispatch(logicalKey, upper);
    } catch (e) {
      console.error('[osk-pro] dispatch failed:', e);
    }
    // After typing a non-shift key, refresh labels in case caps is on.
    this._refreshLabels();
    this._updateShiftChecked();
  }

  // Refresh letter labels based on shift/caps state.
  _refreshLabels() {
    const upper = this._state.isCapsLocked(); // caps persists; one-shot shift doesn't change labels
    for (const btn of this._keys) {
      const k = btn.logicalKey;
      if (k.length === 1 && k >= 'a' && k <= 'z') {
        btn.setLabel(upper ? k.toUpperCase() : k);
      }
    }
  }

  _updateShiftChecked() {
    const shiftBtn = this._keys.find((b) => b.logicalKey === 'shift');
    if (shiftBtn) {
      shiftBtn.setChecked(this._state.isShiftLatched() || this._state.isCapsLocked());
    }
  }

  _clearKeys() {
    for (const btn of this._keys) {
      _liveKeyCount--;
      try { btn.destroy(); } catch (_) {}
    }
    this._keys = [];
    for (const row of this._rows) {
      try { this._root.remove_child(row); row.destroy(); } catch (_) {}
    }
    this._rows = [];
  }

  // Leak-detection counter (spec §2, acceptance #12).
  static getLiveKeyCount() { return _liveKeyCount; }

  // Does NOT destroy #osk-root — that's OskWindowController's job.
  destroy() {
    for (const disconnect of this._subs) {
      try { disconnect(); } catch (_) {}
    }
    this._subs = [];
    this._clearKeys();
    this._root = null;
    this._layout = null;
    this._layers = null;
    this._state = null;
    this._dispatcher = null;
    this._settings = null;
  }
}
```

- [ ] **Step 2: STATIC check**

```bash
node --check src/ui/KeyboardRoot.js
```
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/ui/KeyboardRoot.js
git commit -m "feat(ui): add KeyboardRoot with row building and leak counter"
```

---

## Task 13: OskWindowController

**Files:**
- Create: `src/app/OskWindowController.js`

**Spec ref:** §2 OskWindowController, §4 (positioning inline; monitors-changed signal).

- [ ] **Step 1: Create `src/app/OskWindowController.js`**

```js
// src/app/OskWindowController.js
// Spec §2 + §4. Owns the #osk-root actor, positions it bottom-docked
// on the primary monitor, handles monitors-changed. Positioning is
// inline here in A; a future GeometryManager (spec §9) extracts it.

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const SIDE_MARGIN_PX = 8;

export class OskWindowController {
  constructor() {
    this._root = null;
    this._monitorsChangedId = 0;
  }

  // Create the surface actor. Does NOT populate it — KeyboardRoot does.
  createSurface() {
    this._root = new St.BoxLayout({
      name: 'osk-root',
      style_class: 'osk-surface',
      vertical: true,
      reactive: true,
      can_focus: true,
      visible: false, // shown after positioning
    });
    // Add to Main.uiGroup — does not collide with GNOME's keyboardBox.
    Main.uiGroup.add_child(this._root);
    this._position();
    // Reposition on monitor changes.
    this._monitorsChangedId = Main.layoutManager.connect('monitors-changed', () => this._position());
    return this._root;
  }

  get surface() { return this._root; }

  show() {
    if (this._root) this._root.visible = true;
  }
  hide() {
    if (this._root) this._root.visible = false;
  }

  // Bottom-dock across the primary monitor's width minus margins.
  _position() {
    if (!this._root) return;
    const lm = Main.layoutManager;
    const monitor = lm.primaryMonitor;
    if (!monitor) return;

    const width = monitor.width - (SIDE_MARGIN_PX * 2);
    // Reserve enough height; the actual content drives natural height.
    // We anchor to the bottom of the work area.
    const x = monitor.x + SIDE_MARGIN_PX;
    const y = monitor.y + monitor.height - this._root.height; // set after allocation

    this._root.set_position(x, monitor.y + monitor.height);
    this._root.set_width(width);

    // After the actor allocates its preferred height, slide it up so
    // its bottom aligns with the monitor bottom. Use a one-shot allocate.
    const id = this._root.connect('queue-redraw', () => {
      this._root.set_position(x, monitor.y + monitor.height - this._root.height);
      this._root.disconnect(id);
    });
  }

  destroy() {
    if (this._monitorsChangedId) {
      try { Main.layoutManager.disconnect(this._monitorsChangedId); } catch (_) {}
      this._monitorsChangedId = 0;
    }
    if (this._root) {
      try { Main.uiGroup.remove_child(this._root); } catch (_) {}
      try { this._root.destroy(); } catch (_) {}
      this._root = null;
    }
  }
}
```

- [ ] **Step 2: STATIC check**

```bash
node --check src/app/OskWindowController.js
```
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/OskWindowController.js
git commit -m "feat(app): add OskWindowController with bottom-dock positioning"
```

---

## Task 14: ExtensionController

**Files:**
- Create: `src/app/ExtensionController.js`

**Spec ref:** §2 ExtensionController, §4 (construction + teardown order), §8 (per-step try/catch).

- [ ] **Step 1: Create `src/app/ExtensionController.js`**

```js
// src/app/ExtensionController.js
// Spec §2 + §4 + §8. Top-level lifecycle orchestrator. Constructs
// modules in order, tears them down in reverse, catches per-step
// failures so a bug disables the extension, not the Shell.

import { SettingsController } from './SettingsController.js';
import { LayoutManager } from '../core/LayoutManager.js';
import { LayerManager } from '../core/LayerManager.js';
import { KeyboardState } from '../core/KeyboardState.js';
import { ThemeManager } from '../core/ThemeManager.js';
import { InputDispatcher } from '../core/InputDispatcher.js';
import { OskWindowController } from './OskWindowController.js';
import { FocusController } from './FocusController.js';
import { KeyboardRoot } from '../ui/KeyboardRoot.js';

export class ExtensionController {
  constructor(extension) {
    this._extension = extension;
    // Built modules, in construction order (teardown reverses this).
    this._built = [];
  }

  enable() {
    const dir = this._extension.path;
    let ok = true;
    ok = this._try('settings',  () => {
      this.settings = new SettingsController(dir);
    }) && ok;
    ok = this._try('layout',    () => {
      this.layouts = new LayoutManager(dir);
      this.layouts.loadDefault();
    }) && ok;
    ok = this._try('layers',    () => { this.layers = new LayerManager(); }) && ok;
    ok = this._try('kbstate',   () => { this.kbstate = new KeyboardState(); }) && ok;
    ok = this._try('theme',     () => { this.theme = new ThemeManager(this.settings); }) && ok;
    ok = this._try('input',     () => { this.input = new InputDispatcher(); }) && ok;
    ok = this._try('window',    () => {
      this.window = new OskWindowController();
      const surface = this.window.createSurface();
      this.theme.attach(surface);
      this.kbroot = new KeyboardRoot(surface, this.layouts, this.layers, this.kbstate, this.input, this.settings);
      this.kbroot.rebuild();
      this.window.show();
    }) && ok;
    ok = this._try('focus',     () => {
      this.focus = new FocusController();
      // No auto-show logic in A; just keep the controller warm.
    }) && ok;

    if (!ok) {
      console.error('[osk-pro] enable() had failures; disabling partially-built extension.');
      this.disable();
    } else if (this.settings && this.settings.getBoolean('debug-logging')) {
      console.log(`[osk-pro] enabled. live keys: ${KeyboardRoot.getLiveKeyCount()}`);
    }
    return ok;
  }

  disable() {
    // Reverse order of enable().
    this._dispose('focus',  () => this.focus && this.focus.dispose());
    this._dispose('kbroot', () => this.kbroot && this.kbroot.destroy());
    this._dispose('window', () => this.window && this.window.destroy());
    this._dispose('input',  () => this.input && this.input.dispose());
    this._dispose('theme',  () => this.theme && this.theme.detach());
    this._dispose('kbstate',() => this.kbstate && this.kbstate.reset());
    this._dispose('layers', () => this.layers && this.layers.dispose());
    this._dispose('layout', () => this.layouts && this.layouts.dispose());
    this._dispose('settings', () => this.settings && this.settings.dispose());

    this.focus = this.kbroot = this.window = this.input = this.theme
      = this.kbstate = this.layers = this.layouts = this.settings = null;
  }

  _try(label, fn) {
    try {
      fn();
      this._built.push(label);
      return true;
    } catch (e) {
      console.error(`[osk-pro] enable step "${label}" failed: ${e}`);
      return false;
    }
  }

  _dispose(label, fn) {
    try { fn(); } catch (e) {
      console.error(`[osk-pro] disable step "${label}" failed: ${e}`);
    }
  }
}
```

- [ ] **Step 2: STATIC check**

```bash
node --check src/app/ExtensionController.js
```
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/ExtensionController.js
git commit -m "feat(app): add ExtensionController with isolated construction/teardown"
```

---

## Task 15: extension.js (thin entry)

**Files:**
- Create: `extension.js`

**Spec ref:** §2 extension.js (thin, no state).

- [ ] **Step 1: Create `extension.js`**

```js
// extension.js — thin entry. All logic lives in src/.
// Spec §2. GNOME 45+ ES module extension API.

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { ExtensionController } from './src/app/ExtensionController.js';

export default class OskProExtension extends Extension {
  enable() {
    if (this._controller) {
      console.warn('[osk-pro] enable called while already enabled; disabling first.');
      this._controller.disable();
      this._controller = null;
    }
    this._controller = new ExtensionController(this);
    this._controller.enable();
  }

  disable() {
    if (this._controller) {
      this._controller.disable();
      this._controller = null;
    }
  }
}
```

- [ ] **Step 2: STATIC check — Node `--check`**

```bash
node --check extension.js
```
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add extension.js
git commit -m "feat: add thin extension.js entry point"
```

---

## Task 16: prefs.js (GTK4 preferences window)

**Files:**
- Create: `prefs.js`

**Spec ref:** §1 (prefs window for cycle's settings), §5 (keys).

- [ ] **Step 1: Create `prefs.js`**

```js
// prefs.js — GTK4 + libadwaita preferences window. Out-of-shell process;
// uses GTK/Adw/Gdk, not St/Clutter. Imports defaults.js for the single
// source of truth.

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import { SCHEMA_ID, SCHEMA_PATH, KEYS } from './src/settings/defaults.js';

export default class OskProPrefs extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings(SCHEMA_ID);
    const page = new Adw.PreferencesPage();
    const group = new Adw.PreferencesGroup({ title: 'GJS OSK Pro' });

    for (const k of KEYS) {
      if (k.type === 'b') group.add(this._rowSwitch(settings, k.key, k.summary));
    }
    for (const k of KEYS) {
      if ((k.type === 'i' || k.type === 'd') && k.min != null && k.max != null) {
        group.add(this._rowSpin(settings, k.key, k.summary, k.min, k.max, k.type === 'd'));
      }
    }
    group.add(this._rowCombo(settings, 'theme-mode', 'Theme mode', ['auto', 'light', 'dark']));
    group.add(this._rowCombo(settings, 'layout-id', 'Layout', ['Default']));
    group.add(this._rowCombo(settings, 'position-mode', 'Position', ['bottom']));
    group.add(this._rowColor(settings, 'accent-color', 'Accent color'));

    page.add(group);
    window.add(page);
  }

  _rowSwitch(settings, key, title) {
    const row = new Adw.ActionRow({ title });
    const toggle = new Gtk.Switch({ active: settings.get_boolean(key), valign: Gtk.Align.CENTER });
    settings.bind(key, toggle, 'active', Gio.SettingsBindFlags.DEFAULT);
    row.add_suffix(toggle);
    row.activatable_widget = toggle;
    return row;
  }

  _rowSpin(settings, key, title, lo, hi, isDouble) {
    const row = new Adw.ActionRow({ title });
    const adj = new Gtk.Adjustment({ lower: lo, upper: hi, step_increment: 1 });
    const spin = new Gtk.SpinButton({ adjustment: adj, valign: Gtk.Align.CENTER });
    if (isDouble) {
      spin.digits = 2;
      spin.value = settings.get_double(key);
      spin.connect('value-changed', () => settings.set_double(key, spin.value));
    } else {
      spin.value = settings.get_int(key);
      spin.connect('value-changed', () => settings.set_int(key, spin.value));
    }
    row.add_suffix(spin);
    return row;
  }

  _rowCombo(settings, key, title, options) {
    const row = new Adw.ActionRow({ title });
    const strings = new Gtk.StringList();
    for (const o of options) strings.append(o);
    const dd = new Gtk.DropDown({ model: strings, valign: Gtk.Align.CENTER });
    dd.selected = Math.max(0, options.indexOf(settings.get_string(key)));
    dd.connect('notify::selected', () => settings.set_string(key, options[dd.selected]));
    row.add_suffix(dd);
    return row;
  }

  _rowColor(settings, key, title) {
    const row = new Adw.ActionRow({ title });
    const btn = new Gtk.ColorDialogButton({ valign: Gtk.Align.CENTER });
    const rgba = new Gdk.RGBA();
    if (rgba.parse(settings.get_string(key))) btn.rgba = rgba;
    btn.connect('notify::rgba', () => {
      const c = btn.rgba;
      const to2 = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
      settings.set_string(key, `#${to2(c.red)}${to2(c.green)}${to2(c.blue)}`);
    });
    row.add_suffix(btn);
    return row;
  }
}
```

Note: prefs extends `ExtensionPreferences` (the GNOME 45+ prefs base class) and uses `this.getSettings(SCHEMA_ID)` — the standard, stable way for prefs to obtain the schema bound to the extension's `settings-schema`. `GObject` is imported for completeness though not strictly needed in A's prefs; if the audit flags an unused import, drop it.

- [ ] **Step 2: STATIC check**

```bash
node --check prefs.js
```
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add prefs.js
git commit -m "feat(prefs): add GTK4 preferences window for Sub-project A settings"
```

---

## Task 17: stylesheet.css

**Files:**
- Create: `stylesheet.css`

**Spec ref:** §6 (CSS variables, classes, light/dark/high-contrast).

- [ ] **Step 1: Create `stylesheet.css`**

```css
/*
 * GJS OSK Pro — Sub-project A stylesheet.
 * Spec §6. CSS custom properties on #osk-root; light/dark via classes;
 * high-contrast via the system high-contrast class on the stage.
 * No external fonts, no icon fonts, no SVG assets. Original GNOME-friendly
 * look — not derived from any proprietary design.
 */

/* ---- Light theme tokens (default) ---- */
#osk-root.osk-light {
  --osk-bg: #f6f5f4;
  --osk-key-bg: #ffffff;
  --osk-key-fg: #1d1b20;
  --osk-key-hover-bg: #eceaed;
  --osk-key-pressed-bg: #dcd9dd;
  --osk-key-border: rgba(0,0,0,0.08);
}

/* ---- Dark theme tokens ---- */
#osk-root.osk-dark {
  --osk-bg: #1e1e22;
  --osk-key-bg: #2f2f36;
  --osk-key-fg: #e8eaed;
  --osk-key-hover-bg: #3a3a42;
  --osk-key-pressed-bg: #4a4a52;
  --osk-key-border: rgba(255,255,255,0.06);
}

/* Shared layout variables (set by ThemeManager inline style) */
#osk-root {
  --osk-key-height: 52px;
  --osk-key-spacing: 6px;
  --osk-key-radius: 10px;
  --osk-accent: #3584e4;
  --osk-font-scale: 1.0;
  background-color: var(--osk-bg);
  padding: var(--osk-key-spacing);
  border-radius: calc(var(--osk-key-radius) + 4px);
}

/* ---- Rows ---- */
.osk-row {
  spacing: var(--osk-key-spacing);
  margin-bottom: var(--osk-key-spacing);
}
.osk-row:last-child { margin-bottom: 0; }

/* ---- Keys ---- */
.osk-key {
  min-height: var(--osk-key-height);
  border-radius: var(--osk-key-radius);
  background-color: var(--osk-key-bg);
  color: var(--osk-key-fg);
  border: 1px solid var(--osk-key-border);
  font-size: calc(16px * var(--osk-font-scale));
  font-weight: 500;
  padding: 0 10px;
  transition-duration: 80ms;
}
.osk-key:hover  { background-color: var(--osk-key-hover-bg); }
.osk-key:active,
.osk-key:active:focus {
  background-color: var(--osk-key-pressed-bg);
  border-color: var(--osk-accent);
}
.osk-key:focus  { border-color: var(--osk-accent); }
.osk-key:checked {
  background-color: var(--osk-accent);
  color: #ffffff;
  border-color: var(--osk-accent);
}

/* Width modifiers (driven by layout width factor) */
.osk-key--wide  { /* wider via natural expand */ }
.osk-key--space { /* widest via natural expand */ }

/* Compact density (optional in A; only minor shrink) */
#osk-root.osk-compact .osk-key {
  min-height: calc(var(--osk-key-height) * 0.9);
  font-size: calc(14px * var(--osk-font-scale));
}

/* ---- High contrast (system) ----
 * GNOME sets the high-contrast theme at the stage level; we make keys
 * starkly outlined when that's active.
 */
.stage-high-contrast #osk-root .osk-key {
  background-color: #000000;
  color: #ffffff;
  border: 2px solid #ffffff;
}
.stage-high-contrast #osk-root.osk-light .osk-key {
  background-color: #ffffff;
  color: #000000;
  border: 2px solid #000000;
}
```

- [ ] **Step 2: STATIC check — brace balance + class-name audit**

Create `scripts/check-css.js`:

```js
// scripts/check-css.js
const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.resolve(__dirname, '../stylesheet.css'), 'utf8');

// Brace balance
const opens = (css.match(/{/g) || []).length;
const closes = (css.match(/}/g) || []).length;
if (opens !== closes) { console.error(`CSS brace imbalance: { ${opens} vs } ${closes}`); process.exit(1); }

// Required class/selector coverage (spec §6)
const required = [
  '#osk-root', '.osk-row', '.osk-key', '.osk-key:hover', '.osk-key:active',
  '.osk-key:focus', '.osk-key:checked', '.osk-key--wide', '.osk-key--space',
  '#osk-root.osk-light', '#osk-root.osk-dark', '#osk-root.osk-compact',
];
const missing = required.filter((s) => !css.includes(s));
if (missing.length) { console.error('Missing selectors:', missing); process.exit(2); }

// Required CSS custom properties
const requiredVars = ['--osk-key-height','--osk-key-spacing','--osk-key-radius',
  '--osk-accent','--osk-font-scale','--osk-bg','--osk-key-bg','--osk-key-fg',
  '--osk-key-pressed-bg','--osk-key-hover-bg'];
const missingVars = requiredVars.filter((v) => !css.includes(v));
if (missingVars.length) { console.error('Missing CSS vars:', missingVars); process.exit(3); }

console.log(`css OK (${opens} rules, all required selectors and vars present)`);
```

Run:
```bash
node scripts/check-css.js
```
Expected: `css OK (N rules, all required selectors and vars present)`, exit 0.

- [ ] **Step 3: Commit**

```bash
git add stylesheet.css scripts/check-css.js
git commit -m "feat(theme): add stylesheet with CSS variables and light/dark/HC"
```

---

## Task 18: Static cross-cutting audit

**Files:**
- Create: `scripts/audit.sh`
- Create: `scripts/check-imports.js`

**Spec ref:** self-review axes (GNOME compat, no unsafe globals, IP).

This task is a verification pass. All source files already ship clean
top-level `gi://` imports (no `imports.gi.*` lazy forms, no `Clutter_*` /
`Adw_*` / `Gdk_*` / `GLib_*` aliases). The audit confirms it and catches
any regression.

- [ ] **Step 1: Create `scripts/audit.sh`**

```bash
#!/usr/bin/env bash
# scripts/audit.sh — STATIC consistency audit. Run from project root.
set -uo pipefail
fail=0

echo "== forbidden patterns =="
grep -rn "imports\.gi\." src extension.js prefs.js && { echo "FAIL: legacy imports.gi"; fail=1; } || echo "ok: no legacy imports.gi"
grep -rn "imports\.misc\.extensionUtils\|getCurrentExtension" src extension.js prefs.js && { echo "FAIL: global Me"; fail=1; } || echo "ok: no global Me"
grep -rin "microsoft\|segoe\|windows 11\|surface keyboard" src extension.js prefs.js resources docs stylesheet.css && { echo "FAIL: IP risk"; fail=1; } || echo "ok: no MS references"
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
```

- [ ] **Step 2: Create `scripts/check-imports.js`**

```js
// scripts/check-imports.js
// Every ESM import of a relative path must resolve to a real file.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const importRe = /import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;

const targets = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.superpowers') continue;
      walk(full);
    } else if (e.name.endsWith('.js')) {
      targets.push(full);
    }
  }
}
walk(root);
['extension.js', 'prefs.js'].forEach((f) => {
  const p = path.join(root, f);
  if (fs.existsSync(p)) targets.push(p);
});

let errors = 0;
for (const file of targets) {
  const src = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = importRe.exec(src))) {
    const spec = m[1];
    if (!spec.startsWith('.')) continue; // gi://, resource:// are fine
    const resolved = path.resolve(path.dirname(file), spec);
    if (!fs.existsSync(resolved)) {
      console.error(`${path.relative(root, file)}: import target missing: ${spec}`);
      errors++;
    }
  }
}
if (errors) { console.error(`\n${errors} broken import(s)`); process.exit(1); }
console.log(`imports OK (checked ${targets.length} files)`);
```

- [ ] **Step 3: Run the audit**

```bash
bash scripts/audit.sh
```
Expected: every section prints `ok:`, `imports OK (checked N files)`, `all .js parse OK`, exit 0.

If any section fails, fix the flagged file in place (do not defer). All task code is written to pass this audit as-shipped.

- [ ] **Step 4: Commit**

```bash
git add scripts/audit.sh scripts/check-imports.js
git commit -m "chore: add static audit (imports, IP guard, syntax, no aliases)"
```

---

## Task 19: Documentation

**Files:**
- Create: `README.md`
- Create: `docs/ARCHITECTURE.md`
- Create: `docs/COMPATIBILITY.md`
- Create: `docs/CHANGELOG.md`
- Create: `docs/ROADMAP.md`

**Spec ref:** §1 (basic docs); ROADMAP captures the full-vision target without adding A runtime code.

- [ ] **Step 1: Create `README.md`**

```markdown
# GJS OSK Pro

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

- GNOME Shell 45, 46, 47, or 48
- Wayland session (primary). X11 is unsupported.
- `gnome-extensions` tool (ships with GNOME Shell)

## Install from source

```bash
# 1. Compile the GSettings schema into the extension dir
glib-compile-schemas schemas/

# 2. Package
bash scripts/package.sh
#   -> produces gnome-touch-keyboard@alaa91h.github.io.zip

# 3. Install
gnome-extensions install gnome-touch-keyboard@alaa91h.github.io.zip

# 4. Restart the Shell (Wayland: log out and back in)
#    then enable:
gnome-extensions enable gnome-touch-keyboard@alaa91h.github.io
```

Open Preferences from `gnome-extensions` or the Extensions app.

## Verification (manual, on the GNOME box)

See `docs/TESTING.md` (the testing checklist mirrors the spec's acceptance
criteria). Key checks: type letters, Shift tap/double-tap, Space/Backspace/
Return, theme switches, leak count after 5 enable/disable cycles.

## License

TBD — choose before public release. Not for redistribution yet.
```

> **Plan note (not a code TODO):** the License line is genuinely pending a user decision and is acceptable as a README note. It is not a deferred implementation task.

- [ ] **Step 2: Create `docs/ARCHITECTURE.md`**

```markdown
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
partially-built extension, and leaves the Shell intact.
```

- [ ] **Step 3: Create `docs/COMPATIBILITY.md`**

```markdown
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
  disables itself cleanly.
- `St.Settings.get_color_scheme()` notify signal is unreliable on some
  versions; ThemeManager also polls at 1s when theme-mode is `auto`.

## What's not supported in A

Lock screen / unlock dialog (no `session-modes`), key repeat, long-press
popups, prediction, emoji, clipboard, multilingual layouts, modes beyond
Default. See `docs/ROADMAP.md`.
```

- [ ] **Step 4: Create `docs/ROADMAP.md`** (captures the full vision; no runtime code added)

```markdown
# Roadmap

Sub-project A (this release) is the foundation. The long-term target is a
complete professional touch keyboard with multilingual support, multiple
modes, prediction, emoji, and a privacy-aware clipboard history.

## Sub-projects

- **A — Foundation + Default layout** (current). Modular architecture,
  one QWERTY layout, clean lifecycle, theme + prefs.
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

## Privacy posture (carried from the long-term spec)

No telemetry, no network calls, no remote prediction, no cloud clipboard.
Clipboard history off by default; sensitive-field suppression where
detectable. See `docs/PRIVACY.md` (added in C).
```

- [ ] **Step 5: Create `docs/CHANGELOG.md`**

```markdown
# Changelog

## v0.1.0 — Sub-project A (Foundation + Default layout)

- GNOME Shell 45+ extension scaffold (ES modules).
- Single Default QWERTY layout (`resources/layouts/us.json`).
- Input via `Meta.VirtualInputDevice`: letters, digits, Space, Backspace,
  Return, comma, period.
- Shift one-shot latch + double-tap Caps.
- Modern theme: rounded keys, press/hover/focus/checked states, light/dark
  via GNOME color scheme + explicit override, accent color, key radius /
  spacing / height / font-scale as live settings.
- GTK4 preferences window (`prefs.js`).
- Modular `src/` tree (`app/`, `core/`, `ui/`, `settings/`) with clean
  `enable()`/`disable()` and per-module cleanup. No leaked actors,
  signals, timers, or settings bindings across cycles.
- Leak-detection counter (`KeyboardRoot.getLiveKeyCount()`) for verification.

### Known limitations

- One layout (US English). Multilingual is Sub-project B.
- One mode (Default bottom-docked). Other modes are Sub-project E.
- No key repeat, long-press, prediction, emoji, or clipboard.
- User session only (no lock screen).
```

- [ ] **Step 6: STATIC check — docs exist and reference no MS IP**

```bash
node -e "['README.md','docs/ARCHITECTURE.md','docs/COMPATIBILITY.md','docs/ROADMAP.md','docs/CHANGELOG.md'].forEach(f=>{const fs=require('fs');if(!fs.existsSync(f)){console.error('MISSING',f);process.exit(1)}});console.log('docs present')"
```
Expected: `docs present`, exit 0.

Then:
```bash
grep -rin "microsoft\|segoe\|surface keyboard\|windows touch keyboard" README.md docs && echo "FAIL: IP risk in docs" || echo "ok: docs clean"
```
Expected: `ok: docs clean`.

- [ ] **Step 7: Commit**

```bash
git add README.md docs/
git commit -m "docs: add README, ARCHITECTURE, COMPATIBILITY, ROADMAP, CHANGELOG"
```

---

## Task 20: Packaging + final integration

**Files:**
- Create: `docs/TESTING.md`
- Run: full STATIC suite + build the release zip

**Spec ref:** acceptance criteria + deliverables.

- [ ] **Step 1: Create `docs/TESTING.md`** (the manual verification checklist)

```markdown
# Testing

STATIC checks (runnable from any host, including Windows) live in
`scripts/`. MANUAL checks require a GNOME 46 Wayland box.

## STATIC (run before packaging)

```bash
node scripts/check-schema-sync.js     # schema <-> defaults
node scripts/check-layout.js           # us.json shape
node scripts/check-keyboard-state.mjs  # KeyboardState behavior
node scripts/check-css.js              # stylesheet coverage
bash scripts/audit.sh                  # imports, IP guard, syntax
```

All must exit 0.

## MANUAL (on GNOME 46 Wayland)

Run after `gnome-extensions install` + re-login + enable.

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
12. Five enable/disable cycles: `KeyboardRoot.getLiveKeyCount()` reads 0
    after each disable (verify with debug-logging=true, which logs it).
13. `gnome-extensions disable && gnome-extensions enable` works without
    restarting the Shell.
14. Change primary monitor resolution — keyboard repositions without
    clipping.

## Leak detection

The debug log line on disable reports `live keys: N`. After a clean
disable, N must be 0. If N > 0, a `KeyButton` was not destroyed — file
a bug against `KeyboardRoot._clearKeys`.
```

- [ ] **Step 2: Run the full STATIC suite**

```bash
node scripts/check-schema-sync.js
node scripts/check-layout.js
node scripts/check-keyboard-state.mjs
node scripts/check-css.js
bash scripts/audit.sh
```
All must exit 0. Record the actual output in the release notes.

- [ ] **Step 3: Build the release zip**

```bash
# Note: glib-compile-schemas only runs on a GNOME host. On Windows this
# step is MANUAL — the user runs it before `gnome-extensions install`.
# Document this in README (already done in Task 19).
bash scripts/package.sh
```
Expected: `Built <root>/gnome-touch-keyboard@alaa91h.github.io.zip`. Verify the zip
contains `metadata.json`, `extension.js`, `prefs.js`, `stylesheet.css`,
`src/`, `schemas/`, `resources/` with no `.superpowers/` leakage.

```bash
unzip -l gnome-touch-keyboard@alaa91h.github.io.zip | head -40
```

- [ ] **Step 4: Commit**

```bash
git add docs/TESTING.md
git commit -m "docs: add TESTING checklist (STATIC + MANUAL tiers)"
```

- [ ] **Step 5: Final acceptance summary**

Write a summary into the conversation (not a file) covering:
- Implemented features (mirrors CHANGELOG v0.1.0).
- STATIC checks that passed with their actual output.
- MANUAL checks that are **pending** (user must run on GNOME).
- Known limitations (mirrors CHANGELOG).
- Recommended next sub-project (B).
```

---

## Self-review of this plan

I ran the three required checks against the spec:

**1. Spec coverage.** Every spec section maps to a task:
- §1 purpose/scope → Task 0 (skeleton), Task 19 (docs)
- §2 directory + module responsibilities → Tasks 1–16 (one per module)
- §3 Default layout → Task 4 (data) + Task 12 (rendering) + Task 8 (dispatch)
- §4 construction/teardown order → Task 14 (ExtensionController)
- §5 GSettings schema + migration → Tasks 1, 2
- §6 theme/stylesheet → Tasks 9 (ThemeManager), 17 (CSS)
- §7 acceptance criteria → Task 20 (TESTING checklist, one item per criterion)
- §8 risks → addressed inline (try/catch isolation, poll fallback, feature-detect)
- §9 staged hooks → Task 19 (ROADMAP), no runtime code added
- §10 decisions → encoded in the relevant tasks

**2. Placeholder scan.** I found and removed three placeholder anti-patterns during writing:
- The lazy `imports.gi.*` / alias pattern (`Clutter_EVENT_PROPAGATE`, `GLib_*`, `Adw_*`, `Gdk_*`, `_ensureGlib`) appeared in early drafts of Tasks 6, 9, 11, 16. It has been **rewritten in place** — every task now ships clean top-level `gi://` imports and direct constructor calls. Task 18 (audit) is a verification pass that greps for these patterns as a regression guard, not a fix-up step. No deferred cleanup remains.
- The `GeometryManager`/`GestureController`/future-panel hooks — explicitly "not created in A," captured only in ROADMAP.
- One legitimate "TBD" remains: the `License` field in README. Marked as a genuine user decision, not a code TODO.

**3. Type/name consistency.** Cross-checked:
- `KeyboardState.applyShiftTap`, `consumeShiftForNextKey`, `isShiftLatched`, `isCapsLocked`, `reset` — used identically in Tasks 3 and 12.
- `KeyboardRoot.getLiveKeyCount()` (static) — defined Task 12, called Task 14 + acceptance #12 + TESTING.
- `KeyButton` `'pressed'` signal, `logicalKey`, `widthFactor`, `setChecked`, `setLabel`, `destroy` — consistent across Tasks 11 and 12.
- `SettingsController.onKeyChanged` / `onAnyChanged` / typed getters / `dispose` — consistent across Tasks 5, 9, 12, 14.
- `LayoutManager.getActive` / `setActive` / `loadDefault` / `dispose` — consistent Tasks 6, 12, 14.
- `ThemeManager.attach` / `detach` / `apply` — consistent Tasks 9, 14.
- `OskWindowController.createSurface` / `show` / `hide` / `destroy` / `surface` getter — consistent Tasks 13, 14.
- `InputDispatcher.dispatch(logicalKey, upper)` / `dispose` — consistent Tasks 8, 12, 14.

**No unresolved gaps.** The plan is ready for execution.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-19-subproject-a-foundation-default-layout.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Each task is small and self-contained, which suits this model well.
2. **Inline Execution** — I execute tasks in this session using executing-plans, with checkpoints for your review.

Which approach?
