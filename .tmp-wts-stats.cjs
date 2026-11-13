const { readFileSync, writeFileSync } = require("node:fs");
const mpq = require("mdx-m3-viewer/dist/cjs/parsers/mpq");
const Archive = (mpq.default ?? mpq).Archive;
const P = "Warcraft III zhCN/Maps/hhkj/Spellcraft_Open_Remastered_8.0.5.w3x";
const a = new Archive();
a.load(new Uint8Array(readFileSync(P)), true);
const s = Buffer.from(a.get("war3map.wts").bytes()).toString("utf8").replace(/^\uFEFF/, "");
const re = /STRING\s+(\d+)\s*\r?\n(\/\/[^\n]*\r?\n)?\s*\{\s*\r?\n([\s\S]*?)\r?\n\}/g;
const rows = [];
let m;
while ((m = re.exec(s))) rows.push({ id: m[1], comment: (m[2]||"").replace(/^\/\/\s*/,"").trim(), text: m[3] });
writeFileSync("/tmp/sc-wts.json", JSON.stringify(rows, null, 1));
console.log("rows", rows.length);
let chars = 0, empty = 0;
const kinds = {};
for (const r of rows) {
  chars += r.text.length;
  if (!r.text.trim()) empty++;
  const k = (r.comment.match(/\((.*?)\)\s*$/) || [])[1] || "?";
  kinds[k] = (kinds[k]||0)+1;
}
console.log("total chars", chars, "empty", empty);
console.log(Object.entries(kinds).sort((a,b)=>b[1]-a[1]).slice(0,25));
// distribution of lengths
const buckets = { "1-20":0, "21-60":0, "61-150":0, "151-400":0, "400+":0 };
for (const r of rows) { const n=r.text.length; buckets[n<=20?"1-20":n<=60?"21-60":n<=150?"61-150":n<=400?"151-400":"400+"]++; }
console.log(buckets);
