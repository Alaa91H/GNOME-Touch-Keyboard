// src/core/LayerManager.js
// Spec §2. A holds a single 'base' layer only. Future push/pop for
// symbols/numbers/emoji is documented in spec §9 and added in a later
// sub-project — NOT pre-stubbed here.

const BASE_LAYER = Object.freeze({ name: 'base' });

export class LayerManager {
  constructor() {
    this._active = BASE_LAYER;
  }
  getActive() { return this._active; }
  dispose() { this._active = null; }
}
