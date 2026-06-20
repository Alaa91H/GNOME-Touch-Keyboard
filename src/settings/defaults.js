// src/settings/defaults.js
// Single source of truth for GSettings keys, types, and default values.
// Spec §5. MUST stay byte-identical to schemas/*.gschema.xml.
// Importable both in-shell (extension.js) and out-of-shell (prefs.js),
// so it contains NO gi:// imports — pure data only.

export const SCHEMA_ID = 'org.gnome.shell.extensions.gnome-touch-keyboard';
export const SCHEMA_PATH = '/org/gnome/shell/extensions/gnome-touch-keyboard/';

// Each entry: { key, type, default, summary, min?, max? }
export const KEYS = Object.freeze([
  { key: 'schema-version', type: 'i', default: 1,
    summary: 'Schema version for forward migrations.' },
  { key: 'layout-id', type: 's', default: 'Default',
    summary: 'Active layout id. Only "Default" valid in Sub-project A.' },
  { key: 'language-id', type: 's', default: 'en',
    summary: 'Active keyboard language id; scanned from resources/layouts/*.json.' },
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
