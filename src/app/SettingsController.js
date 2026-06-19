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
    if (!(key in DEFAULTS)) return null;
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
