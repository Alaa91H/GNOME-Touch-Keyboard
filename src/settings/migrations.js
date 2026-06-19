// src/settings/migrations.js
// Spec §5. Idempotent, never throws on unknown future versions.
import { DEFAULTS } from './defaults.js';

const CURRENT = DEFAULTS['schema-version']; // 1

// Returns the version applied. Never throws.
export function migrate(settings) {
  let current;
  try {
    current = settings.get_int('schema-version');
  } catch (_) {
    // Key absent on first install (or schema not yet compiled).
    current = 0;
  }

  if (current === CURRENT) {
    return CURRENT;
  }

  if (current < CURRENT) {
    // No real steps exist below v1 today; just stamp the version.
    // Future versions add per-step functions here, in order.
    _stamp(settings, CURRENT);
    return CURRENT;
  }

  // current > CURRENT: user downgraded. Coerce without data loss.
  // We do NOT reset any key; we only lower the recorded version.
  console.warn(`[osk-pro] schema-version ${current} > supported ${CURRENT}; coercing down without data loss.`);
  _stamp(settings, CURRENT);
  return CURRENT;
}

function _stamp(settings, v) {
  try {
    settings.set_int('schema-version', v);
  } catch (e) {
    console.error(`[osk-pro] failed to stamp schema-version: ${e}`);
  }
}
