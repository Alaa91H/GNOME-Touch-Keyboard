// scripts/check-schema-sync.js
// Run: node scripts/check-schema-sync.js
// Verifies schemas/*.gschema.xml matches src/settings/defaults.js.
// Pure Node — no gi:// deps, runs on Windows.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

// defaults.js is an ES module. Read it as text and eval only the KEYS
// array (avoids needing a package.json type=module or a loader).
const src = fs.readFileSync(path.join(root, 'src/settings/defaults.js'), 'utf8');
const m = src.match(/export const KEYS\s*=\s*(?:Object\.freeze\()?\s*(\[[\s\S]*?\])\s*\)?\s*;/);
if (!m) { console.error('Could not find KEYS array in defaults.js'); process.exit(1); }
const KEYS = eval(m[1]);

const xml = fs.readFileSync(
  path.join(root, 'schemas/org.gnome.shell.extensions.gnome-touch-keyboard.gschema.xml'), 'utf8');

let errors = 0;
for (const k of KEYS) {
  const blockRe = new RegExp(`<key name="${k.key}" type="${k.type}"[\\s\\S]*?</key>`);
  const block = xml.match(blockRe);
  if (!block) { console.error(`MISSING <key name="${k.key}">`); errors++; continue; }
  const defMatch = block[0].match(/<default>([\s\S]*?)<\/default>/);
  if (!defMatch) { console.error(`MISSING <default> for ${k.key}`); errors++; continue; }
  const raw = defMatch[1].trim();
  let expected;
  if (k.type === 's') expected = `"${k.default}"`;
  else if (k.type === 'b') expected = k.default ? 'true' : 'false';
  else if (k.type === 'i') expected = String(k.default);
  else if (k.type === 'd') {
    // Preserve at least one decimal place to match the schema's GVariant
    // double serialization (e.g. 1.0 -> "1.0", not "1").
    const s = String(k.default);
    expected = s.includes('.') ? s : s + '.0';
  }
  if (raw !== expected) {
    console.error(`DEFAULT MISMATCH ${k.key}: schema="${raw}" defaults.js="${expected}"`);
    errors++;
  }
  if ((k.type === 'i' || k.type === 'd') && (k.min != null || k.max != null)) {
    const range = block[0].match(/<range min="([\d.]+)" max="([\d.]+)"/);
    if (!range) { console.error(`MISSING <range> for ${k.key}`); errors++; }
    else {
      if (Number(range[1]) !== k.min || Number(range[2]) !== k.max) {
        console.error(`RANGE MISMATCH ${k.key}: schema=[${range[1]},${range[2]}] defaults=[${k.min},${k.max}]`);
        errors++;
      }
    }
  }
  if (k.type === 's' && Array.isArray(k.choices)) {
    for (const c of k.choices) {
      if (!new RegExp(`<choice value="${c}"`).test(block[0])) {
        console.error(`MISSING <choice value="${c}"> for ${k.key}`);
        errors++;
      }
    }
  }
}
if (errors) { console.error(`\n${errors} schema-sync error(s)`); process.exit(1); }
console.log(`schema-sync OK (${KEYS.length} keys checked)`);
