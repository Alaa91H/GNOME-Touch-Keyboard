// src/core/KeyboardState.js
// Spec §2 + §3. Pure state: shift latch + caps.
// No GNOME signals, no actors. Callers read snapshots after transitions.

const SHIFT_LATCH_MS = 400; // spec §3: double-tap window for caps

export class KeyboardState {
  constructor() {
    this.reset();
  }

  reset() {
    this._shift = false;      // one-shot latch, consumed by next printable key
    this._caps = false;       // locked uppercase
    this._lastShiftTapMs = 0; // for double-tap detection
  }

  // Called when the user taps the Shift key.
  // Returns a snapshot describing the new visual state.
  applyShiftTap(nowMs = Date.now()) {
    const withinWindow = (nowMs - this._lastShiftTapMs) <= SHIFT_LATCH_MS;
    if (this._shift && withinWindow) {
      // Second tap within window -> engage caps, clear the one-shot latch.
      this._shift = false;
      this._caps = true;
      this._lastShiftTapMs = 0;
      return this.snapshot();
    }
    // First tap (or stale): toggle one-shot latch.
    this._shift = !this._shift;
    if (this._shift) this._lastShiftTapMs = nowMs;
    else this._lastShiftTapMs = 0;
    return this.snapshot();
  }

  // Returns true if the next printable key should be uppercase,
  // and consumes the one-shot shift latch (caps persists).
  consumeShiftForNextKey() {
    const upper = this._shift || this._caps;
    if (this._shift) {
      this._shift = false;
      this._lastShiftTapMs = 0;
    }
    return upper;
  }

  isShiftLatched() { return this._shift; }
  isCapsLocked() { return this._caps; }

  snapshot() {
    return { shift: this._shift, caps: this._caps };
  }
}
