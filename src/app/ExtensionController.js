// src/app/ExtensionController.js
// Top-level lifecycle orchestrator. Constructs modules on enable and
// tears them down in reverse order on disable.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import { SettingsController } from './SettingsController.js';
import { createLanguageManager } from '../core/LanguageManager.js';
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
  }

  enable() {
    const dir = this._extension.path;
    this._enabled = true;

    this.settings = new SettingsController(this._extension.getSettings());
    this.layers = new LayerManager();
    this.kbstate = new KeyboardState();
    this.theme = new ThemeManager(this.settings);
    this.input = new InputDispatcher();

    const layoutsDir = Gio.File.new_for_path(
      GLib.build_filenamev([dir, 'resources', 'layouts']));
    this.langs = createLanguageManager({
      layoutsDir,
      settings: this.settings.raw,
    });

    // Load layouts asynchronously so file IO never blocks the Shell, then
    // build the keyboard once they are available.
    this.langs.load().then(() => {
      // disable() may have run while the load was in flight.
      if (!this._enabled) return;

      this.window = new OskWindowController();
      const surface = this.window.createSurface();
      this.theme.attach(surface);
      this.kbroot = new KeyboardRoot(
        surface, this.langs, this.layers, this.kbstate, this.input, this.settings);
      this.kbroot.rebuild();
      this.window.show();

      this.focus = new FocusController();
    }).catch((e) => {
      console.error(`[osk-pro] failed to load layouts: ${e}`);
    });
  }

  disable() {
    this._enabled = false;

    // Reverse order of enable().
    this.focus?.dispose();
    this.kbroot?.destroy();
    this.window?.destroy();
    this.input?.dispose();
    this.theme?.detach();
    this.kbstate?.reset();
    this.layers?.dispose();
    this.settings?.dispose();

    this.focus = this.kbroot = this.window = this.input = this.theme
      = this.kbstate = this.layers = this.langs = this.settings = null;
  }
}
