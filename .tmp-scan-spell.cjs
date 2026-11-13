const { readFileSync } = require("node:fs");
const mpq = require("mdx-m3-viewer/dist/cjs/parsers/mpq");
const Archive = (mpq.default ?? mpq).Archive;
const a = new Archive();
a.load(new Uint8Array(readFileSync("Warcraft III zhCN/Maps/hhkj/Spellcraft_Open_Remastered_8.0.5.w3x")), true);
console.log("files:", a.files.length);
for (const f of a.files.slice(0, 60)) console.log("  ", f.name, f.size);
