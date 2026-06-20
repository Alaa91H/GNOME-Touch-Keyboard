// tests/unit/LanguageManager.test.js
// Plain-gjs unit test for LanguageManager. No GNOME Shell process needed —
// Gio/GLib/GObject work standalone, so this runs as `gjs -m` in CI.
//
// Requires schemas/gschemas.compiled to exist (run `glib-compile-schemas
// schemas/` first; the CI workflow does this before invoking tests).
//
// Run: gjs -m tests/unit/LanguageManager.test.js

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { createLanguageManager } from '../../src/core/LanguageManager.js';

const SCRIPT_DIR = Gio.File.new_for_uri(import.meta.url).get_parent().get_path();
const ROOT = GLib.build_filenamev([SCRIPT_DIR, '..', '..']);
const SCHEMA_ID = 'org.gnome.shell.extensions.gnome-touch-keyboard';

let failures = 0;

function assert(cond, msg) {
  if (!cond) {
    failures++;
    printerr(`FAIL: ${msg}`);
  } else {
    print(`ok: ${msg}`);
  }
}

function makeSettings() {
  const schemaDir = GLib.build_filenamev([ROOT, 'schemas']);
  const source = Gio.SettingsSchemaSource.new_from_directory(
    schemaDir, Gio.SettingsSchemaSource.get_default(), false);
  const schema = source.lookup(SCHEMA_ID, true);
  if (!schema) {
    throw new Error(
      `schema ${SCHEMA_ID} not found in ${schemaDir} — run ` +
      `'glib-compile-schemas schemas/' before running this test`);
  }
  // Memory-backed: never touches the real dconf store.
  const backend = Gio.memory_settings_backend_new();
  return new Gio.Settings({ settings_schema: schema, backend });
}

async function main() {
  const layoutsDir = Gio.File.new_for_path(
    GLib.build_filenamev([ROOT, 'resources', 'layouts']));

  // Count the *.json files on disk to know what "fully loaded" means.
  // us.json is the legacy single-layout file (id: "Default") and is
  // intentionally excluded by LanguageManager — it's not a language.
  const expectedIds = [];
  {
    const en = layoutsDir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
    let info;
    while ((info = en.next_file(null)) !== null) {
      const name = info.get_name();
      if (name.endsWith('.json') && name !== 'us.json') expectedIds.push(name.slice(0, -5));
    }
    en.close(null);
  }
  assert(expectedIds.length > 0, 'found layout JSON files on disk');

  const lm = createLanguageManager({ layoutsDir, settings: makeSettings() });
  await lm.load();

  const loadedIds = lm.getAvailableIds();
  assert(loadedIds.length === expectedIds.length,
    `all ${expectedIds.length} language layouts loaded without error (got ${loadedIds.length})`);
  assert(!loadedIds.includes('us'),
    'legacy us.json (id: "Default") is excluded from the language list');

  for (const id of expectedIds) {
    const wasLoaded = loadedIds.includes(id);
    assert(wasLoaded, `layout "${id}" parsed successfully`);
    if (!wasLoaded) continue;
    const ok = lm.setActive(id);
    assert(ok, `setActive("${id}") succeeds`);
    const layout = lm.getActiveLayout();
    assert(Array.isArray(layout?.rows) && layout.rows.length > 0,
      `layout "${id}" has a non-empty rows array`);
  }

  assert(lm.getActiveId() === expectedIds[expectedIds.length - 1],
    'getActiveId() reflects the last setActive() call');

  let changeCount = 0;
  lm.connect('language-changed', () => changeCount++);
  lm.cycle();
  assert(changeCount === 1, 'cycle() emits language-changed exactly once');

  if (failures > 0) {
    printerr(`\n${failures} assertion(s) failed`);
    return 1;
  }
  print('\nAll LanguageManager checks passed.');
  return 0;
}

const loop = GLib.MainLoop.new(null, false);
let exitCode = 0;
main()
  .then((code) => { exitCode = code; })
  .catch((e) => { printerr(`ERROR: ${e}`); exitCode = 1; })
  .finally(() => loop.quit());
loop.run();
imports.system.exit(exitCode);
