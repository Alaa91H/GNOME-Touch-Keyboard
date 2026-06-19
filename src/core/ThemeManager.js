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
