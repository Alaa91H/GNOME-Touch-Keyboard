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
    this.label = text != null ? String(text) : '';
  }

  // Latched modifier visual (Shift one-shot; future sticky mods).
  setChecked(checked) {
    if (checked) this.add_style_pseudo_class('checked');
    else this.remove_style_pseudo_class('checked');
  }

  destroy() {
    this.disconnect(this._pressId);
    this.disconnect(this._releaseId);
    super.destroy();
  }
});
