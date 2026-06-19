// src/app/ExtensionController.js
// Spec §2 + §4 + §8. Top-level lifecycle orchestrator. Constructs
// modules in order, tears them down in reverse, catches per-step
// failures so a bug disables the extension, not the Shell.

import { SettingsController } from './SettingsController.js';
import { LayoutManager } from '../core/LayoutManager.js';
import { LayerManager } from '../core/LayerManager.js';
import { KeyboardState } from '../core/KeyboardState.js';
import { ThemeManager } from '../core/ThemeManager.js';
import { InputDispatcher } from '../core/InputDispatcher.js';
import { OskWindowController } from './OskWindowController.js';
import { FocusController } from './FocusController.js';
import { KeyboardRoot } from '../ui/KeyboardRoot.js';

export class ExtensionController {
  constructor(extension) {
    this._extension = extension;
    // Built module labels, in construction order (teardown reverses this).
    this._built = [];
  }

  enable() {
    const dir = this._extension.path;
    let ok = true;
    ok = this._try('settings',  () => {
      this.settings = new SettingsController(dir);
    }) && ok;
    ok = this._try('layout',    () => {
      this.layouts = new LayoutManager(dir);
      this.layouts.loadDefault();
    }) && ok;
    ok = this._try('layers',    () => { this.layers = new LayerManager(); }) && ok;
    ok = this._try('kbstate',   () => { this.kbstate = new KeyboardState(); }) && ok;
    ok = this._try('theme',     () => { this.theme = new ThemeManager(this.settings); }) && ok;
    ok = this._try('input',     () => { this.input = new InputDispatcher(); }) && ok;
    ok = this._try('window',    () => {
      this.window = new OskWindowController();
      const surface = this.window.createSurface();
      this.theme.attach(surface);
      this.kbroot = new KeyboardRoot(surface, this.layouts, this.layers, this.kbstate, this.input, this.settings);
      this.kbroot.rebuild();
      this.window.show();
    }) && ok;
    ok = this._try('focus',     () => {
      this.focus = new FocusController();
      // No auto-show logic in A; just keep the controller warm.
    }) && ok;

    if (!ok) {
      console.error('[osk-pro] enable() had failures; disabling partially-built extension.');
      this.disable();
    } else if (this.settings && this.settings.getBoolean('debug-logging')) {
      console.log(`[osk-pro] enabled. live keys: ${KeyboardRoot.getLiveKeyCount()}`);
    }
    return ok;
  }

  disable() {
    // Reverse order of enable().
    this._dispose('focus',  () => this.focus && this.focus.dispose());
    this._dispose('kbroot', () => this.kbroot && this.kbroot.destroy());
    this._dispose('window', () => this.window && this.window.destroy());
    this._dispose('input',  () => this.input && this.input.dispose());
    this._dispose('theme',  () => this.theme && this.theme.detach());
    this._dispose('kbstate',() => this.kbstate && this.kbstate.reset());
    this._dispose('layers', () => this.layers && this.layers.dispose());
    this._dispose('layout', () => this.layouts && this.layouts.dispose());
    this._dispose('settings', () => this.settings && this.settings.dispose());

    this.focus = this.kbroot = this.window = this.input = this.theme
      = this.kbstate = this.layers = this.layouts = this.settings = null;
  }

  _try(label, fn) {
    try {
      fn();
      this._built.push(label);
      return true;
    } catch (e) {
      console.error(`[osk-pro] enable step "${label}" failed: ${e}`);
      return false;
    }
  }

  _dispose(label, fn) {
    try { fn(); } catch (e) {
      console.error(`[osk-pro] disable step "${label}" failed: ${e}`);
    }
  }
}
