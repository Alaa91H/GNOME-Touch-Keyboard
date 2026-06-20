// src/app/SettingsController.js
// Spec §2 + §4. Wraps Gio.Settings; all other modules obtain settings
// through this object, never directly. Central dispose().

import { DEFAULTS } from '../settings/defaults.js';
import { migrate } from '../settings/migrations.js';

export class SettingsController {
  // `settings` is the Gio.Settings provided by Extension.getSettings().
  constructor(settings) {
    this._settings = settings;
    this._subs = []; // array of { target, id, kind } for cleanup

    // Run migrations before anyone reads keys.
    migrate(this._settings);
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
