// tests/e2e/language_switch_e2e.test.js
// Integration test for the language-switch data contract: drives
// LanguageManager through every shipped language and reproduces the row
// selection logic KeyboardRoot.rebuild() applies (src/ui/KeyboardRoot.js).
//
// This is NOT a real GNOME Shell UI test — driving actual St/Clutter actors
// requires a running compositor (nested Wayland session + extension
// activation over D-Bus), which isn't reproducible in headless CI. What
// matters for regressions is that every language's layout data is valid
// input to KeyboardRoot; that's what this test verifies.
//
// Run: gjs -m tests/e2e/language_switch_e2e.test.js

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
  const backend = Gio.memory_settings_backend_new();
  return new Gio.Settings({ settings_schema: schema, backend });
}

// Mirrors KeyboardRoot.rebuild()'s row selection (src/ui/KeyboardRoot.js):
// showNumbers ? layout.rows : layout.rows.slice(1).
function rowsForRender(layout, showNumbers) {
  return showNumbers ? layout.rows : layout.rows.slice(1);
}

async function main() {
  const layoutsDir = Gio.File.new_for_path(
    GLib.build_filenamev([ROOT, 'resources', 'layouts']));
  const settings = makeSettings();
  const lm = createLanguageManager({ layoutsDir, settings });
  await lm.load();

  const ids = lm.getAvailableIds();
  assert(ids.length > 0, 'at least one language is available');

  let changeEvents = 0;
  lm.connect('language-changed', () => changeEvents++);

  const initialId = lm.getActiveId();

  for (const id of ids) {
    const ok = lm.setActive(id);
    assert(ok, `switch to "${id}" succeeds`);
    assert(lm.getActiveId() === id, `getActiveId() reports "${id}" after switch`);

    const layout = lm.getActiveLayout();
    assert(layout?.rows?.length > 0, `"${id}" layout has at least one row`);

    const withNumbers = rowsForRender(layout, true);
    const withoutNumbers = rowsForRender(layout, false);
    assert(withNumbers.length === layout.rows.length,
      `"${id}": show-number-row=true renders all ${layout.rows.length} rows`);
    assert(withoutNumbers.length === layout.rows.length - 1,
      `"${id}": show-number-row=false drops exactly one row`);

    for (const row of withNumbers) {
      assert(Array.isArray(row) && row.every((key) => typeof key.k === 'string'),
        `"${id}": every key in every row has a string "k"`);
    }
  }

  assert(changeEvents === ids.length,
    `language-changed fired once per switch (${changeEvents}/${ids.length})`);

  lm.setActive(initialId);

  if (failures > 0) {
    printerr(`\n${failures} assertion(s) failed`);
    return 1;
  }
  print('\nAll language-switch integration checks passed.');
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
