// scripts/check-keyboard-state.mjs
// Run: node scripts/check-keyboard-state.mjs
// Behavioral check for KeyboardState (the one pure module we can drive on Windows).
import { KeyboardState } from '../src/core/KeyboardState.js';

let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; }
  else { fail++; console.error(`FAIL ${label}: got ${a} want ${e}`); }
}

// 1. Fresh state: no shift, no caps.
const s = new KeyboardState();
eq(s.snapshot(), { shift: false, caps: false }, 'fresh');

// 2. Single shift tap latches.
eq(s.applyShiftTap(1000), { shift: true, caps: false }, 'shift latch');
// 3. consumeShiftForNextKey returns true and clears latch.
eq(s.consumeShiftForNextKey(), true, 'consume shift true');
eq(s.isShiftLatched(), false, 'shift cleared after consume');

// 4. Double tap within window engages caps.
s.applyShiftTap(2000); // shift latch on
eq(s.applyShiftTap(2200), { shift: false, caps: true }, 'caps engaged');
// 5. Caps persists across a printable consume.
eq(s.consumeShiftForNextKey(), true, 'caps upper');
eq(s.isCapsLocked(), true, 'caps still locked');

// 6. Stale double-tap does NOT engage caps (outside 400ms).
s.reset();
s.applyShiftTap(10000);
eq(s.applyShiftTap(11000), { shift: false, caps: false }, 'stale -> toggle off');

console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
