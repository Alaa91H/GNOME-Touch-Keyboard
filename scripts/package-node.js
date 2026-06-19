// scripts/package-node.js
// Node-only store-mode zip writer. Produces the same flat .shell-extension.zip
// that scripts/package.sh does, but runs on Windows (where `zip` is absent).
// gnome-extensions install accepts uncompressed zips, so store-only is fine.
//
// NOTE: This bundles the source files only. The GNOME-side step
// `glib-compile-schemas schemas/` MUST still be run on the GNOME host
// before `gnome-extensions install` so the compiled schema is present
// alongside the XML.
//
// Run: node scripts/package-node.js
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outPath = path.join(root, 'gnome-touch-keyboard@alaa91h.github.io.zip');

const files = ['metadata.json', 'extension.js', 'prefs.js', 'stylesheet.css'];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(p);
    } else if (/\.(js|json|xml)$/.test(e.name)) {
      files.push(p.slice(root.length + 1).replace(/\\/g, '/'));
    }
  }
}
walk(path.join(root, 'src'));
walk(path.join(root, 'schemas'));
walk(path.join(root, 'resources'));

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ~c >>> 0;
}

const localChunks = [];
const centralEntries = [];
let offset = 0;

for (const rel of files) {
  const abs = path.join(root, rel);
  const buf = fs.readFileSync(abs);
  const name = Buffer.from(rel, 'utf8');
  const crc = crc32(buf);
  const size = buf.length;

  const lhdr = Buffer.alloc(30);
  lhdr.writeUInt32LE(0x04034b50, 0); // signature
  lhdr.writeUInt16LE(20, 4);         // version needed
  lhdr.writeUInt16LE(0, 6);          // flags
  lhdr.writeUInt16LE(0, 8);          // method = store
  lhdr.writeUInt16LE(0, 10);         // mod time
  lhdr.writeUInt16LE(0, 12);         // mod date
  lhdr.writeUInt32LE(crc, 14);
  lhdr.writeUInt32LE(size, 18);      // compressed size
  lhdr.writeUInt32LE(size, 22);      // uncompressed size
  lhdr.writeUInt16LE(name.length, 26);
  lhdr.writeUInt16LE(0, 28);         // extra length

  localChunks.push(lhdr, name, buf);

  const cent = Buffer.alloc(46);
  cent.writeUInt32LE(0x02014b50, 0);
  cent.writeUInt16LE(20, 4);
  cent.writeUInt16LE(20, 6);
  cent.writeUInt16LE(0, 8);
  cent.writeUInt16LE(0, 10);
  cent.writeUInt16LE(0, 12);
  cent.writeUInt16LE(0, 14);
  cent.writeUInt32LE(crc, 16);
  cent.writeUInt32LE(size, 20);
  cent.writeUInt32LE(size, 24);
  cent.writeUInt16LE(name.length, 28);
  cent.writeUInt16LE(0, 30); // extra
  cent.writeUInt16LE(0, 32); // comment
  cent.writeUInt16LE(0, 34); // disk number
  cent.writeUInt16LE(0, 36); // internal attrs
  cent.writeUInt32LE(0, 38); // external attrs
  cent.writeUInt32LE(offset, 42);
  centralEntries.push(cent, name);

  offset += lhdr.length + name.length + buf.length;
}

const centralStart = offset;
const central = Buffer.concat(centralEntries);

const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(0, 4);             // disk
end.writeUInt16LE(0, 6);             // disk with central
end.writeUInt16LE(files.length, 8);  // entries this disk
end.writeUInt16LE(files.length, 10); // entries total
end.writeUInt32LE(central.length, 12);
end.writeUInt32LE(centralStart, 16);
end.writeUInt16LE(0, 20);            // comment length

fs.writeFileSync(outPath, Buffer.concat([...localChunks, central, end]));
console.log(`Built ${path.relative(root, outPath)} (${files.length} files, store-only)`);
