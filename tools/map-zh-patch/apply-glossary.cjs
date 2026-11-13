#!/usr/bin/env node
/**
 * 把侧车里残留的英文/葡语专名与技能名换成中文。
 *
 *   node tools/map-zh-patch/apply-glossary.cjs <地图>.w3x.zhCN.json [...]
 *
 * 做四件事：
 *   1. 修掉生成器把多个字符串拼成一条时留下的 `","` 残渣（英雄卡尾部会拖一段别的英雄的技能表）；
 *   2. 去掉译文里夹带的葡语动词注记（`（deixando-os）` 之类）；
 *   3. 用 glossary-zh.json 的 phrases/words 做整体替换（先长后短、只在词边界上匹配）；
 *   4. 换完把 `|cXXXXXXXX`/`|n`/`|r` 原样还原，并报告还剩多少拉丁字符。
 */
const fs = require("node:fs");
const path = require("node:path");

const GLOSSARY = JSON.parse(fs.readFileSync(path.join(__dirname, "glossary-zh.json"), "utf8"));
const OVERRIDES = fs.existsSync(path.join(__dirname, "item-overrides.json"))
  ? JSON.parse(fs.readFileSync(path.join(__dirname, "item-overrides.json"), "utf8"))
  : {};

const BACKUP_DIR = "/tmp/glossary-backup";
const FIELDS = ["description", "tip", "summary", "tips", "uberTips", "properNames", "names", "name"];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 颜色码与换行标记先换成一个不含字母的占位符，替换完再放回去。 */
function mask(text) {
  const held = [];
  const keep = (m) => `\u0001${held.push(m) - 1}\u0001`;
  let out = text.replace(/\|c[0-9a-fA-F]{8}/g, keep);
  out = out.replace(/\|[nrdh]/g, keep);
  return { out, restore: (s) => s.replace(/\u0001(\d+)\u0001/g, (_, i) => held[Number(i)]) };
}

/** 先把词组按长度倒序拼成一条正则，再逐词兜底。 */
function buildReplacer(table) {
  const keys = Object.keys(table).sort((a, b) => b.length - a.length);
  if (!keys.length) return (s) => s;
  const re = new RegExp(`(?<![A-Za-z\\u00C0-\\u00FF])(${keys.map(escapeRe).join("|")})(?![A-Za-z\\u00C0-\\u00FF])`, "g");
  return (s) => s.replace(re, (m) => table[m] ?? m);
}

const replacePhrases = buildReplacer(GLOSSARY.phrases);
const replaceWords = buildReplacer(GLOSSARY.words);
const drops = [...GLOSSARY.drop].sort((a, b) => b.length - a.length);

let stats = { fixedJoin: 0, dropped: 0, rewritten: 0, byKind: {} };

function clean(text, kind, id) {
  let s = text;

  // 1. 生成器把数组拼成了 `"a","b"` 的形式：真正的文本在第一个 `","` 之前。
  const cut = s.indexOf('","');
  if (cut > 0) {
    const head = s.slice(0, cut);
    // 只在“看起来是完整句子”时截断，避免误伤正常引号
    if (!/["{[]$/.test(head)) {
      s = head;
      stats.fixedJoin++;
    }
  }

  // 2. 译文里夹带的葡语注记
  for (const d of drops) {
    if (!s.includes(d)) continue;
    s = s.split(d).join("");
    stats.dropped++;
  }

  // 3. 中文后面粘着的半截拉丁词尾（早期机翻留下的 “恢复ção”、“光环ção”）
  s = s.replace(/([\u4e00-\u9fff])([A-Za-z\u00C0-\u00FF]{1,8})(?![A-Za-z\u00C0-\u00FF])/g, "$1");

  // 4. 词表替换
  const { out, restore } = mask(s);
  let next = replacePhrases(out);
  next = replaceWords(next);
  next = restore(next);

  // 5. 夹在中文里的葡语/英语连接词、机翻留下的连字符
  next = next.replace(/([\u4e00-\u9fff])\s+(?:de|da|do|em|ou|com|of|the)\s+([\u4e00-\u9fff])/g, "$1$2");
  next = next.replace(/([\u4e00-\u9fff])-([\u4e00-\u9fff])/g, "$1$2");

  // 5b. 技能/科技文本里的引擎占位符 <AHav,DataA1> / <Rosp,base1>：客户端不会解析，
  //      原样显示就是一堆尖括号，换成“若干”。
  if (kind === "abilities" || kind === "upgrades") {
    next = next.replace(/<[A-Za-z0-9]{4},[^<>]{1,30}>/g, "若干");
  }

  // 6. 中文之间的多余空格
  next = next.replace(/([\u4e00-\u9fff])[ \t]+([\u4e00-\u9fff])/g, "$1$2");

  if (next !== s) stats.rewritten++;
  // 出现过的“（）”空括号、双空格一并收掉
  next = next.replace(/[（(]\s*[)）]/g, "").replace(/[ \t]{2,}/g, " ");
  next = next.replace(/\s+([，。、；：])/g, "$1");

  const bucket = (stats.byKind[kind] ||= { total: 0, latin: 0 });
  bucket.total++;
  if (latinWords(next).length) bucket.latin++;
  return next;
}

/** 去掉标记后还剩哪些拉丁词——只用来报告，不参与替换。 */
function latinWords(s) {
  const plain = s.replace(/\|c[0-9a-fA-F]{8}|\|[nrdh]/g, " ").replace(/<[^<>]{1,40}>/g, " ");
  const out = new Set();
  for (const m of plain.matchAll(/[A-Za-z\u00C0-\u00FF][A-Za-z\u00C0-\u00FF'\u2019-]*/g)) {
    const w = m[0].replace(/['\u2019-]+$/, "");
    if (w.length >= 2) out.add(w);
  }
  return [...out];
}

function applyFile(file) {
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  const objects = doc.objects || {};

  for (const kind of ["units", "items", "abilities", "upgrades"]) {
    for (const [id, def] of Object.entries(objects[kind] || {})) {
      if (OVERRIDES[kind] && OVERRIDES[kind][id]) {
        Object.assign(def, OVERRIDES[kind][id]);
      }
      for (const field of FIELDS) {
        const v = def[field];
        if (typeof v === "string") def[field] = clean(v, kind, id);
        else if (Array.isArray(v)) def[field] = v.map((x) => (typeof x === "string" ? clean(x, kind, id) : x));
      }
    }
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const backup = path.join(BACKUP_DIR, path.basename(file));
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);

  fs.writeFileSync(file, JSON.stringify(doc, null, 1));
  return { file, objects };
}

function main() {
const files = process.argv.slice(2);
if (!files.length) {
  console.error("usage: node tools/map-zh-patch/apply-glossary.cjs <sidecar.json> [...]");
  process.exit(1);
}

for (const file of files) {
  stats = { fixedJoin: 0, dropped: 0, rewritten: 0, byKind: {} };
  applyFile(file);
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  console.log(`\n=== ${path.basename(file)} ===`);
  console.log(`  拼接残渣修复: ${stats.fixedJoin}  葡语注记删除: ${stats.dropped}  字符串重写: ${stats.rewritten}`);
  for (const kind of ["units", "items", "abilities", "upgrades"]) {
    const blk = d.objects[kind] || {};
    const left = new Map();
    for (const def of Object.values(blk)) {
      for (const field of ["description", "tip", "summary", "tips", "uberTips"]) {
        const v = def[field];
        for (const s of Array.isArray(v) ? v : [v]) {
          if (typeof s !== "string") continue;
          for (const w of latinWords(s)) left.set(w, (left.get(w) || 0) + 1);
        }
      }
    }
    const arr = [...left.entries()].sort((a, b) => b[1] - a[1]);
    console.log(`  ${kind}: 残留 ${arr.length} 种 / ${arr.reduce((n, [, c]) => n + c, 0)} 处`);
    if (arr.length && kind !== "abilities" && kind !== "upgrades") {
      console.log("    " + arr.slice(0, 60).map(([w, c]) => `${w}(${c})`).join(" "));
    }
  }
}
}

module.exports = { clean };

if (require.main === module) main();
