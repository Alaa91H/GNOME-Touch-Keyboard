// scripts/check-layout.js
// Run: node scripts/check-layout.js
const fs = require('fs');
const path = require('path');
const layout = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, '../resources/layouts/us.json'), 'utf8'));

let errors = 0;
if (layout.id !== 'Default') { console.error('id != Default'); errors++; }
if (!Array.isArray(layout.rows) || layout.rows.length < 4 || layout.rows.length > 5) {
  console.error('rows must be 4..5'); errors++;
}
const validK = new Set(['1','2','3','4','5','6','7','8','9','0',
  'q','w','e','r','t','y','u','i','o','p','a','s','d','f','g','h','j','k','l',
  'z','x','c','v','b','n','m',
  'shift','backspace','123','comma','space','period','return']);
for (const [ri, row] of layout.rows.entries()) {
  if (!Array.isArray(row)) { console.error(`row ${ri} not array`); errors++; continue; }
  for (const [ki, key] of row.entries()) {
    if (typeof key.k !== 'string') { console.error(`row ${ri} key ${ki} missing .k`); errors++; }
    else if (!validK.has(key.k)) { console.error(`row ${ri} key ${ki} unknown k="${key.k}"`); errors++; }
    if (key.width != null && typeof key.width !== 'number') {
      console.error(`row ${ri} key ${ki} width not number`); errors++;
    }
  }
}
if (errors) { console.error(`\n${errors} layout error(s)`); process.exit(1); }
console.log(`layout OK (${layout.rows.length} rows)`);
