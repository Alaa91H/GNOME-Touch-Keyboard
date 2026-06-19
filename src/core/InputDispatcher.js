// src/core/InputDispatcher.js
// Spec §2 + §3. Translates a logical key into a Clutter key event via
// Meta.VirtualInputDevice (KEYBOARD class). Only the keys present in
// us.json are handled. No key repeat / long press / sticky modifiers
// in A (spec §9: future, not stubbed).
//
// API NOTE: GNOME's stable synthetic-input method is notify_keyval()
// (takes a Clutter keyval + Clutter.KeyState), NOT notify_key() (which
// takes a hardware keycode we don't have). The original plan/spec draft
// referenced notify_key(); this implementation uses notify_keyval() to
// match the real GNOME 45+ API. This is the kind of detail that MUST be
// verified on a real GNOME Wayland box — see docs/TESTING.md.

import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';

// Logical key -> Clutter keysym. Only the set in us.json.
const KEY_TO_KEYSYM = Object.freeze({
  // digits
  '1': Clutter.KEY_1, '2': Clutter.KEY_2, '3': Clutter.KEY_3,
  '4': Clutter.KEY_4, '5': Clutter.KEY_5, '6': Clutter.KEY_6,
  '7': Clutter.KEY_7, '8': Clutter.KEY_8, '9': Clutter.KEY_9,
  '0': Clutter.KEY_0,
  // letters (lowercase keysyms; uppercase derived in _toUpperKeysym)
  'a': Clutter.KEY_a, 'b': Clutter.KEY_b, 'c': Clutter.KEY_c,
  'd': Clutter.KEY_d, 'e': Clutter.KEY_e, 'f': Clutter.KEY_f,
  'g': Clutter.KEY_g, 'h': Clutter.KEY_h, 'i': Clutter.KEY_i,
  'j': Clutter.KEY_j, 'k': Clutter.KEY_k, 'l': Clutter.KEY_l,
  'm': Clutter.KEY_m, 'n': Clutter.KEY_n, 'o': Clutter.KEY_o,
  'p': Clutter.KEY_p, 'q': Clutter.KEY_q, 'r': Clutter.KEY_r,
  's': Clutter.KEY_s, 't': Clutter.KEY_t, 'u': Clutter.KEY_u,
  'v': Clutter.KEY_v, 'w': Clutter.KEY_w, 'x': Clutter.KEY_x,
  'y': Clutter.KEY_y, 'z': Clutter.KEY_z,
  // punctuation / whitespace / edit keys
  'comma':   Clutter.KEY_comma,
  'period':  Clutter.KEY_period,
  'space':   Clutter.KEY_space,
  'return':  Clutter.KEY_Return,
  'backspace': Clutter.KEY_BackSpace,
});

// Logical keys that have no keysym (handled as no-ops in A).
const INERT_KEYS = new Set(['123', 'shift']);

export class InputDispatcher {
  constructor() {
    // Acquire a virtual keyboard device. Can throw on GNOME versions
    // where the API differs; caller wraps in try/catch and disables.
    this._device = Meta.VirtualInputDevice.new(
      Clutter.InputDeviceType.KEYBOARD_DEVICE);
  }

  // Dispatch a single logical key. `upper` controls Shift application
  // for letters (the caller — KeyboardRoot — already called
  // KeyboardState.consumeShiftForNextKey and passes the result).
  dispatch(logicalKey, upper = false) {
    if (INERT_KEYS.has(logicalKey)) {
      // '123' is the seam for the future symbols layer; no-op in A.
      // 'shift' is handled by KeyboardState, not dispatched.
      return false;
    }
    const keysym = KEY_TO_KEYSYM[logicalKey];
    if (keysym === undefined) {
      console.warn(`[osk-pro] no keysym for logical key "${logicalKey}"`);
      return false;
    }
    const effective = upper ? _toUpperKeysym(keysym) : keysym;
    const time = global.get_current_time
      ? global.get_current_time()
      : Clutter.get_current_event_time();

    // Press + release. Single-shot in A; key repeat is future work.
    // notify_keyval takes (time, keyval, state) — see API NOTE above.
    this._device.notify_keyval(time, effective, Clutter.KeyState.PRESSED);
    this._device.notify_keyval(time + 1, effective, Clutter.KeyState.RELEASED);
    return true;
  }

  dispose() {
    // No explicit close API on the device across versions; drop the ref.
    this._device = null;
  }
}

// Convert a lowercase-letter keysym to its uppercase variant.
// Clutter's keyvals are Unicode-aware for a-z (KEY_a..KEY_z -> 97..122),
// so subtracting 32 gives A..Z. Prefer Clutter's own helper when present.
function _toUpperKeysym(keysym) {
  if (keysym >= Clutter.KEY_a && keysym <= Clutter.KEY_z) {
    return keysym - 32;
  }
  return keysym;
}
