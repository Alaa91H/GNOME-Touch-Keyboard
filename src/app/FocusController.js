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
