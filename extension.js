// extension.js — thin entry. All logic lives in src/.
// Spec §2. GNOME 45+ ES module extension API.

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { ExtensionController } from './src/app/ExtensionController.js';

export default class OskProExtension extends Extension {
  enable() {
    if (this._controller) {
      console.warn('[osk-pro] enable called while already enabled; disabling first.');
      this._controller.disable();
      this._controller = null;
    }
    this._controller = new ExtensionController(this);
    this._controller.enable();
  }

  disable() {
    if (this._controller) {
      this._controller.disable();
      this._controller = null;
    }
  }
}
