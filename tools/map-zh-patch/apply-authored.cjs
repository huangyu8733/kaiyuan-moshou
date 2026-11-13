// 重生成侧车（map-zh-extract.cjs）会把源图空的 ubertip 刷回 [""]。
// 本脚本读取 authored-ubertips.json，把所有"当前为空"的能力重新补上原创描述。
// 用法：node tools/map-zh-patch/apply-authored.cjs
const fs = require("fs");
const path = require("path");

const ROOT = "/Users/huangyu/魔兽/开源魔兽争霸";
const AUTHORED = path.join(ROOT, "tools/map-zh-patch/authored-ubertips.json");
const FILES = [
  "Warcraft III zhCN/Maps/hhkj/DotA AI v6.90G PT-BR v4.1.w3x.zhCN.json",
  "Warcraft III zhCN/Maps/hhkj/DotA v6.83d.w3x.zhCN.json",
  "Warcraft III enUS/Maps/hhkj/DotA AI v6.90G PT-BR v4.1.w3x.zhCN.json",
  "Warcraft III enUS/Maps/hhkj/DotA v6.83d.w3x.zhCN.json",
].map((p) => path.join(ROOT, p));

const authored = JSON.parse(fs.readFileSync(AUTHORED, "utf8"));

function emptyUber(o) {
  const u = o && o.uberTips;
  return !u || u.length === 0 || u.every((x) => !String(x).trim());
}
function padLen(o) {
  const t = o && o.tips;
  return Array.isArray(t) && t.length ? t.length : 1;
}

let total = 0;
for (const f of FILES) {
  const s = JSON.parse(fs.readFileSync(f, "utf8"));
  const A = s.objects.abilities;
  let cnt = 0;
  for (const [id, o] of Object.entries(A)) {
    const nm = (o.name || "").trim();
    if (nm && emptyUber(o) && authored[id]) {
      const len = padLen(o);
      A[id].uberTips = Array.from({ length: len }, () => authored[id]);
      cnt++;
    }
  }
  fs.writeFileSync(f, JSON.stringify(s, null, 2));
  console.log(path.basename(f) + " : 应用 " + cnt + " 个");
  total += cnt;
}
console.log("共应用 " + total + " 次（含四份重复）");
