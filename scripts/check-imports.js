// scripts/check-imports.js
// Every ESM import of a relative path must resolve to a real file.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const importRe = /import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;

const targets = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.superpowers') continue;
      walk(full);
    } else if (e.name.endsWith('.js')) {
      targets.push(full);
    }
  }
}
walk(root);
['extension.js', 'prefs.js'].forEach((f) => {
  const p = path.join(root, f);
  if (fs.existsSync(p)) targets.push(p);
});

let errors = 0;
for (const file of targets) {
  const src = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = importRe.exec(src))) {
    const spec = m[1];
    if (!spec.startsWith('.')) continue; // gi://, resource:// are fine
    const resolved = path.resolve(path.dirname(file), spec);
    if (!fs.existsSync(resolved)) {
      console.error(`${path.relative(root, file)}: import target missing: ${spec}`);
      errors++;
    }
  }
}
if (errors) { console.error(`\n${errors} broken import(s)`); process.exit(1); }
console.log(`imports OK (checked ${targets.length} files)`);
