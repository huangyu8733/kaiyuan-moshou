// Split `--missing` exports into translation batches. One batch = one JSON object whose KEYS are
// the exact dictionary keys the generator looks up. A translator returns the same keys with
// Chinese values, preserving every {N}, <Token,Field>, |n and |cXXXXXXXX / |r marker.
const fs = require("node:fs");
const path = require("node:path");

const OUT = path.join(__dirname, "batches");
fs.mkdirSync(OUT, { recursive: true });

const sources = ["690g", "683d"].map((tag) => ({
  tag,
  doc: JSON.parse(fs.readFileSync(path.join(__dirname, `missing-${tag}.json`), "utf8")),
}));

// Script literals left blank are machine text: hashtable keys, Invoker key combos, the font
// test string. Translating them would corrupt script logic, so they are deliberately excluded.
const groups = { ability: {}, unitBody: {}, unitTip: {} };
for (const { doc } of sources) {
  for (const [key, original] of Object.entries(doc.abilities)) groups.ability[key] = original;
  for (const key of Object.keys(doc.unitBodies)) groups.unitBody[key] = key;
  for (const key of Object.keys(doc.unitTips)) groups.unitTip[key] = key;
}

// A batch is bounded by total source characters so every translator gets a comparable load.
const MAX_CHARS = 11000;
const manifest = [];
for (const [group, entries] of Object.entries(groups)) {
  const keys = Object.keys(entries).sort();
  let batch = {}, size = 0, n = 0;
  const flush = () => {
    if (!Object.keys(batch).length) return;
    const file = `${group}-${String(++n).padStart(2, "0")}.json`;
    fs.writeFileSync(path.join(OUT, file), `${JSON.stringify(batch, null, 2)}\n`, "utf8");
    manifest.push({ file, group, keys: Object.keys(batch).length, chars: size });
    batch = {}; size = 0;
  };
  for (const key of keys) {
    const cost = key.length + String(entries[key]).length;
    if (size + cost > MAX_CHARS && Object.keys(batch).length) flush();
    batch[key] = entries[key];
    size += cost;
  }
  flush();
}
fs.writeFileSync(path.join(OUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(manifest.map((m) => `${m.file}\t${m.keys} keys\t${m.chars} chars`).join("\n"));
console.log(`total ${manifest.length} batches, ${manifest.reduce((a, b) => a + b.keys, 0)} keys`);
