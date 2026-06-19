// scripts/check-css.js
const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.resolve(__dirname, '../stylesheet.css'), 'utf8');

// Brace balance
const opens = (css.match(/{/g) || []).length;
const closes = (css.match(/}/g) || []).length;
if (opens !== closes) { console.error(`CSS brace imbalance: { ${opens} vs } ${closes}`); process.exit(1); }

// Required class/selector coverage (spec §6)
const required = [
  '#osk-root', '.osk-row', '.osk-key', '.osk-key:hover', '.osk-key:active',
  '.osk-key:focus', '.osk-key:checked', '.osk-key--wide', '.osk-key--space',
  '#osk-root.osk-light', '#osk-root.osk-dark', '#osk-root.osk-compact',
];
const missing = required.filter((s) => !css.includes(s));
if (missing.length) { console.error('Missing selectors:', missing); process.exit(2); }

// Required CSS custom properties
const requiredVars = ['--osk-key-height','--osk-key-spacing','--osk-key-radius',
  '--osk-accent','--osk-font-scale','--osk-bg','--osk-key-bg','--osk-key-fg',
  '--osk-key-pressed-bg','--osk-key-hover-bg'];
const missingVars = requiredVars.filter((v) => !css.includes(v));
if (missingVars.length) { console.error('Missing CSS vars:', missingVars); process.exit(3); }

console.log(`css OK (${opens} rules, all required selectors and vars present)`);
