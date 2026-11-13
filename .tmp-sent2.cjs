const { readFileSync } = require("node:fs");
const mpq = require("mdx-m3-viewer/dist/cjs/parsers/mpq");
const Archive = (mpq.default ?? mpq).Archive;
const a = new Archive();
a.load(new Uint8Array(readFileSync("Warcraft III zhCN/Maps/hhkj/Spellcraft_Open_Remastered_8.0.5.w3x")), true);
const s = Buffer.from((a.get("scripts\\war3map.j") || a.get("war3map.j")).bytes()).toString("utf8");
require("node:fs").writeFileSync("/tmp/sc.j", s);
const lines = s.split("\n");
for (const n of [7340, 7348, 7360, 7384, 7390]) {
  console.log("---- around", n);
  for (let i = n - 6; i < n + 10 && i < lines.length; i++) console.log(String(i + 1).padStart(5), lines[i].slice(0, 160));
}
