const { readFileSync } = require("node:fs");
const mpq = require("mdx-m3-viewer/dist/cjs/parsers/mpq");
const Archive = (mpq.default ?? mpq).Archive;
const P = "Warcraft III zhCN/Maps/hhkj/Spellcraft_Open_Remastered_8.0.5.w3x";
const a = new Archive();
a.load(new Uint8Array(readFileSync(P)), true);
const read = (...n) => { for (const x of n) { try { const f = a.get(x); if (f) return Buffer.from(f.bytes()); } catch {} } return null; };
const wts = read("war3map.wts");
const j = read("scripts\\war3map.j", "war3map.j");
const skin = read("war3mapSkin.txt", "War3MapSkin.txt");
console.log("wts bytes", wts ? wts.length : "MISSING");
console.log("j bytes", j ? j.length : "MISSING");
console.log("skin", skin ? skin.length : "MISSING");
if (wts) {
  const s = wts.toString("utf8").replace(/^\uFEFF/, "");
  const ids = [...s.matchAll(/STRING\s+(\d+)/g)].map(m => m[1]);
  console.log("wts STRING count", ids.length, "first", ids.slice(0,5), "last", ids.slice(-5));
  console.log("---- head of wts ----");
  console.log(s.slice(0, 1200));
}
if (j) {
  const s = j.toString("utf8");
  const lits = new Set();
  for (const m of s.matchAll(/"((?:[^"\\]|\\.)*)"/g)) lits.add(m[1]);
  console.log("script literals", lits.size);
}
