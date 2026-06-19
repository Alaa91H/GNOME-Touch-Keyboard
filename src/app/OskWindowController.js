// src/app/OskWindowController.js
// Spec §2 + §4. Owns the #osk-root actor, positions it bottom-docked
// on the primary monitor, handles monitors-changed. Positioning is
// inline here in A; a future GeometryManager (spec §9) extracts it.

import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const SIDE_MARGIN_PX = 8;

export class OskWindowController {
  constructor() {
    this._root = null;
    this._monitorsChangedId = 0;
    this._heightNotifyId = 0; // one-shot, to anchor after first allocation
  }

  // Create the surface actor. Does NOT populate it — KeyboardRoot does.
  createSurface() {
    this._root = new St.BoxLayout({
      name: 'osk-root',
      style_class: 'osk-surface',
      vertical: true,
      reactive: true,
      can_focus: true,
      visible: false, // shown after positioning
    });
    // Add to Main.uiGroup — does not collide with GNOME's keyboardBox.
    Main.uiGroup.add_child(this._root);
    this._position();
    // Reposition on monitor changes.
    this._monitorsChangedId = Main.layoutManager.connect('monitors-changed', () => this._position());
    return this._root;
  }

  get surface() { return this._root; }

  show() {
    if (this._root) this._root.visible = true;
  }
  hide() {
    if (this._root) this._root.visible = false;
  }

  // Bottom-dock across the primary monitor's width minus margins.
  _position() {
    if (!this._root) return;
    const lm = Main.layoutManager;
    const monitor = lm.primaryMonitor;
    if (!monitor) return;

    const width = monitor.width - (SIDE_MARGIN_PX * 2);
    const x = monitor.x + SIDE_MARGIN_PX;

    // Width is known now; height arrives after content allocates.
    this._root.set_width(width);

    // Anchor at the bottom: once we know our height, place so the
    // bottom edge sits margin above the monitor bottom. Use a one-shot
    // notify::height so we don't churn on every redraw.
    const placeAtBottom = () => {
      if (!this._root) return;
      const h = this._root.height || 0;
      this._root.set_position(x, monitor.y + monitor.height - h - SIDE_MARGIN_PX);
    };
    placeAtBottom(); // try immediately (height may already be allocated)
    if (this._heightNotifyId) {
      try { this._root.disconnect(this._heightNotifyId); } catch (_) {}
    }
    this._heightNotifyId = this._root.connect('notify::height', () => {
      placeAtBottom();
      // Keep the handler connected: a layout rebuild changes height and
      // must re-anchor. It is disconnected in destroy().
    });
  }

  destroy() {
    if (this._heightNotifyId && this._root) {
      try { this._root.disconnect(this._heightNotifyId); } catch (_) {}
      this._heightNotifyId = 0;
    }
    if (this._monitorsChangedId) {
      try { Main.layoutManager.disconnect(this._monitorsChangedId); } catch (_) {}
      this._monitorsChangedId = 0;
    }
    if (this._root) {
      try { Main.uiGroup.remove_child(this._root); } catch (_) {}
      try { this._root.destroy(); } catch (_) {}
      this._root = null;
    }
  }
}
