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
    this._keys = [];   // { btn, pressedId } pairs so we can disconnect

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
        const pressedId = btn.connect('pressed', (_b, logicalKey) => this._onPressed(btn, logicalKey));
        this._keys.push({ btn, pressedId });
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
    for (const { btn } of this._keys) {
      const k = btn.logicalKey;
      if (k.length === 1 && k >= 'a' && k <= 'z') {
        btn.setLabel(upper ? k.toUpperCase() : k);
      }
    }
  }

  _updateShiftChecked() {
    const shiftEntry = this._keys.find(({ btn }) => btn.logicalKey === 'shift');
    if (shiftEntry) {
      shiftEntry.btn.setChecked(this._state.isShiftLatched() || this._state.isCapsLocked());
    }
  }

  _clearKeys() {
    for (const { btn, pressedId } of this._keys) {
      try { btn.disconnect(pressedId); } catch (_) {}
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
