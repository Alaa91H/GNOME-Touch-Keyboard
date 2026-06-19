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
