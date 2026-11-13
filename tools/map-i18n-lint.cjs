// A map's SCRIPT, against its Chinese language file: does the translation change a value the
// script tests? Run: node tools/map-i18n-lint.cjs "Maps/hhkj/DotA v6.83d.w3x" [...more]
//
// The failure this exists for is invisible until a map quietly stops doing something. A map can
// only reach its own text through `GetObjectName`/`GetUnitName`, and DotA uses those as FLAGS:
//
//   if GetObjectName(1848657992) == "Language: English" then  … print the English-only tips
//   if GetUnitName(it) != "Bloodrune"                  then  … treat it as a hero
//
// A `.zhCN.json` that renames that object answers the question for the script: the branch the
// author wrote stops being taken, and nobody sees an error — the feature is simply gone. So the
// two sides are compared HERE, at build time, instead of in a match:
//
//   · the object's AUTHORED name, out of the map's own copy of the string tables (a map carries
//     its own `Units\*Strings.txt`, and that is where DotA's unit names actually live);
//   · the name the dictionary puts over it (`objects.<kind>.<rawcode>.name`).
//
// A literal that is not a rawcode (`GetUnitName(it) != "Bloodrune"`) is resolved the other way
// round: which table row is NAMED that, and does the dictionary rename that row.
//
// Exit code 1 when at least one comparison is flipped, so this can guard a build.

const { readFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");
const mpq = require("mdx-m3-viewer/dist/cjs/parsers/mpq");
const Archive = (mpq.default ?? mpq).Archive;

/** The map's MPQ, read by hash even when it carries no listfile (protected maps do not). */
function openMap(path) {
  const buf = readFileSync(path);
  const bytes = new Uint8Array(buf.byteLength);
  bytes.set(buf);
  const archive = new Archive();
  archive.load(bytes, true);
  const read = (...names) => {
    for (const name of names) {
      try {
        const file = archive.get(name);
        if (file) return Buffer.from(file.bytes());
      } catch {
        /* a protected archive throws on names it does not hold — try the next spelling */
      }
    }
    return null;
  };
  return { read };
}

/** [FrameDef] keys whose value is a NAME, not a sentence: the map's version banner in the
 *  upkeep slot ("v6.83d") and the AI's own name ("DOTA AI"). Translating them would be wrong. */
const SKIN_EXEMPT = new Set(["UPKEEP_NONE", "COMPUTER"]);

const TEXT_TABLES = [  "Units\\CampaignUnitStrings.txt", "Units\\UnitStrings.txt",
  "Units\\HumanUnitStrings.txt", "Units\\OrcUnitStrings.txt",
  "Units\\UndeadUnitStrings.txt", "Units\\NightElfUnitStrings.txt",
  "Units\\NeutralUnitStrings.txt", "Units\\ItemStrings.txt",
  "Units\\CampaignAbilityStrings.txt", "Units\\CommonAbilityStrings.txt",
  "Units\\HumanAbilityStrings.txt", "Units\\OrcAbilityStrings.txt",
  "Units\\UndeadAbilityStrings.txt", "Units\\NightElfAbilityStrings.txt",
  "Units\\NeutralAbilityStrings.txt", "Units\\ItemAbilityStrings.txt",
  "Units\\CampaignUpgradeStrings.txt", "Units\\HumanUpgradeStrings.txt",
  "Units\\OrcUpgradeStrings.txt", "Units\\UndeadUpgradeStrings.txt",
  "Units\\NightElfUpgradeStrings.txt", "Units\\NeutralUpgradeStrings.txt",
];

/** `[n0HH]\nName=Language: English` blocks, per file the map ships. */
function parseStrings(bytes) {
  const out = new Map();
  if (!bytes) return out;
  const text = new TextDecoder("utf-8").decode(bytes); // a Chinese map's own tables are UTF-8
  let id = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const head = /^\[([^\]]+)\]$/.exec(line);
    if (head) { id = head[1]; continue; }
    if (!id) continue;
    const kv = /^Name\s*=\s*(.*)$/i.exec(line);
    if (kv && !out.has(id)) out.set(id, kv[1].replace(/^"|"$/g, "").trim());
  }
  return out;
}

const rawcode = (n) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0);
  return b.toString("latin1");
};

/** Every `GetObjectName(<id>)` / `GetUnitName(x)` the line compares against a literal. */
function comparisons(script) {
  const out = [];
  script.split(/\r?\n/).forEach((line, i) => {
    const cmp = line.includes("==") || line.includes("!=");
    if (!cmp) return;
    // the compared expression must be the whole call, not a piece of a concatenation.
    // `((1848657992))` is how a compiled 6.90G spells the same id — allow the extra parens.
    const byId = /GetObjectName\(\s*\(*\s*(\d{6,})\s*\)*\s*\)\s*([=!]=)\s*"([^"]*)"/.exec(line);
    if (byId) { out.push({ line: i + 1, kind: "id", id: Number(byId[1]), lit: byId[3], text: line.trim() }); return; }
    const rev = /"([^"]*)"\s*([=!]=)\s*GetObjectName\(\s*\(*\s*(\d{6,})\s*\)*\s*\)/.exec(line);
    if (rev) { out.push({ line: i + 1, kind: "id", id: Number(rev[3]), lit: rev[1], text: line.trim() }); return; }
    // `GetUnitName(K1[GetPlayerId(x)])` nests its own brackets, so take everything up to the `)`
    // that closes the call by matching the comparison instead of the argument list.
    const byName = /Get(?:UnitName|HeroProperName)\(.*\)\s*([=!]=)\s*"([^"]*)"/.exec(line);
    if (byName) { out.push({ line: i + 1, kind: "name", lit: byName[2], text: line.trim() }); return; }
    const revName = /"([^"]*)"\s*([=!]=)\s*Get(?:UnitName|HeroProperName)\(/.exec(line);
    if (revName) out.push({ line: i + 1, kind: "name", lit: revName[1], text: line.trim() });
  });
  return out;
}

/** The w3i's first four strings and nothing else: name, author, description, suggested
 *  players — all the map-info pane's own text, and the first thing a player reads in the
 *  Custom Game list. Enough of the format to answer "is this field a TRIGSTR_?" without
 *  taking on the whole reader: the four are length-free C strings right after the version. */
function w3iHeader(bytes) {
  if (!bytes || bytes.length < 12) return null;
  const version = bytes.readInt32LE(0);
  let at = 12; // format version, save count, editor version
  if (version > 27) at += 16; // …and the four build-version words (w3i v32+)
  const out = [];
  for (let i = 0; i < 4; i++) {
    const end = bytes.indexOf(0, at);
    if (end < 0) return out;
    out.push(bytes.toString("utf-8", at, end));
    at = end + 1;
  }
  return out;
}

/** `TRIGSTR_50001` → `"50001"`, or null for a literal. */
function trigId(value) {
  const m = /^TRIGSTR_(\d+)$/i.exec((value || "").trim());
  return m ? String(parseInt(m[1], 10)) : null;
}

/** …and the map's own NAME and BLURB, which the Custom Game list and the map-info pane print
 *  before any match exists. A DotA writes `TRIGSTR_50000`/`50001` and its sidecar already holds
 *  both lines, but nothing used to ask: the list resolved them out of the INSTALL's wts, so the
 *  row and the description stayed in the author's language while a Chinese file sat beside the
 *  map. `world/mapInfo.ts` keeps the w3i's spelling and `i18n/mapLanguage.ts` asks the sidecar
 *  by that id — this is the check that the sidecar answers. */
function w3iText(bytes, dict) {
  const header = w3iHeader(bytes);
  if (!header || !dict) return { fields: 0, answered: 0, missing: [] };
  const [name, , description, recommended] = header;
  const info = (dict.info && typeof dict.info === "object" ? dict.info : {}) || {};
  const wts = (dict.wts && typeof dict.wts === "object" ? dict.wts : {}) || {};
  const text = (dict.text && typeof dict.text === "object" ? dict.text : {}) || {};
  const answered = (v) => typeof v === "string" && v.trim() !== "";
  let fields = 0;
  const missing = [];
  for (const [field, raw] of [["name", name], ["description", description], ["recommendedPlayers", recommended]]) {
    if (!raw) continue;
    const id = trigId(raw);
    // A bare number ("10") is no text at all — there is nothing to translate.
    if (!id && !/[A-Za-z]{3}/.test(raw)) continue;
    fields += 1;
    if (answered(info[field])) continue;
    if (id && answered(wts[id])) continue;
    if (!id && answered(text[raw.trim()])) continue;
    missing.push({ field, raw, id });
  }
  return { fields, answered: fields - missing.length, missing };
}

function lint(mapPath) {
  const { read } = openMap(mapPath);
  const scriptBytes = read("scripts\\war3map.j", "war3map.j", "Scripts\\war3map.j");
  if (!scriptBytes) {
    console.log(`${mapPath}: no scripts\\war3map.j — not a custom map, nothing to check`);
    return 0;
  }
  const script = scriptBytes.toString("utf-8");

  // The map's own names: id → authored `Name`. Several files may carry the same id; the first wins.
  const named = new Map();
  for (const t of TEXT_TABLES) for (const [id, name] of parseStrings(read(t))) if (!named.has(id)) named.set(id, name);
  const byName = new Map([...named].map(([id, name]) => [name, id]));

  // The dictionary that sits beside the map.
  const sidecarPath = `${mapPath}.zhCN.json`;
  let dict = null;
  if (existsSync(sidecarPath)) {
    try { dict = JSON.parse(readFileSync(sidecarPath, "utf-8").replace(/^\uFEFF/, "")); } catch { dict = null; }
  }
  const renamed = new Map(); // rawcode → the name the dictionary puts there
  for (const block of Object.values((dict && dict.objects) || {})) {
    for (const [id, t] of Object.entries(block || {})) {
      if (t && typeof t.name === "string" && t.name) renamed.set(id, t.name);
    }
  }

  const checks = comparisons(script);
  const flipped = [];
  console.log(`\n=== ${mapPath}`);
  console.log(`    ${checks.length} name comparison(s) in the script, ${renamed.size} object(s) renamed by ${dict ? "the sidecar" : "NO sidecar"}`);
  for (const c of checks) {
    if (c.kind === "id") {
      const id = rawcode(c.id);
      const authored = named.get(id);
      const now = renamed.get(id);
      const hit = now !== undefined && authored !== undefined && authored === c.lit;
      if (hit) flipped.push(c);
      console.log(`  ${hit ? "FLIP" : "ok  "}  L${c.line}  GetObjectName(${id}) ${hit ? "==" : "??"} "${c.lit}"` +
        (authored === undefined ? "  (name not in the map's own tables)" : `  authored="${authored}"`) +
        (now === undefined ? "" : `  dictionary="${now}"`));
    } else {
      const id = byName.get(c.lit);
      const now = id === undefined ? undefined : renamed.get(id);
      const hit = now !== undefined;
      if (hit) flipped.push(c);
      console.log(`  ${hit ? "FLIP" : "ok  "}  L${c.line}  GetUnitName(…) vs "${c.lit}"` +
        (id === undefined ? "  (no row by that name)" : `  [${id}]`) +
        (now === undefined ? "" : `  dictionary="${now}"`));
    }
  }
  if (!dict) console.log("  — no .zhCN.json beside this map: names are the author's, nothing can be flipped.");

  // …and the map's OWN text, as the Custom Game list prints it.
  const mapText = w3iText(read("war3map.w3i", "War3Map.w3i"), dict);
  if (mapText.fields) {
    console.log(`  ${mapText.fields} w3i text field(s) (name/description/suggested players), ${mapText.answered} answered by the sidecar`);
    for (const u of mapText.missing) {
      const how = u.id ? `TRIGSTR_${u.id} not in wts` : "literal, not in text/info";
      console.log(`  INFO  ${u.field} = ${u.raw.slice(0, 60)}  (${how})`);
    }
  }

  // …and the map's own HUD words: `war3mapSkin.txt` [FrameDef]. These are literals the author
  // TYPED (DotA: `KEY_QUESTS=Map Info (F9)`), so the map's wts never carries them and the
  // install's Chinese data cannot reach them — the one place a Chinese build showed English was
  // the top-left button bar: `Map Info | 菜单 | 盟友 | 聊天`. The sidecar's `skin` table answers
  // by FrameDef key; a long line left in the author's language is the failure this catches.
  const skinBytes = read("war3mapSkin.txt", "War3MapSkin.txt");
  const untranslated = [];
  let skinKeys = 0;
  let skinAnswered = 0;
  const errorUntranslated = [];
  let errorKeys = 0;
  let errorAnswered = 0;
  if (skinBytes) {
    const table = (dict && dict.skin) || {};
    // `[Errors]` is keyed the same way but matched case-INsensitively (the block's own casing is
    // inconsistent, and so is the engine's). One index serves both tests below.
    const errorTable = new Map(Object.entries((dict && dict.errors) || {}).map(([k, v]) => [k.toLowerCase(), v]));
    let into = null;
    for (const raw of skinBytes.toString("utf-8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
      const line = raw.trim();
      const head = /^\[(.+)\]$/.exec(line);
      if (head) { into = head[1].trim().toLowerCase(); continue; }
      if (into !== "framedef" && into !== "errors") continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (!value) continue;
      if (into === "errors") {
        // A key the map RE-WORDS is a line the install's own copy cannot speak for — DotA's
        // `Nolumber` is "you do not need a recipe for this item", so the stock Chinese
        // "木材不够。" flashes the wrong sentence. Unanswered means exactly that.
        errorKeys += 1;
        if (errorTable.has(key.toLowerCase())) { errorAnswered += 1; continue; }
        errorUntranslated.push({ key, value });
        continue;
      }
      skinKeys += 1;
      const zh = table[key];
      if (typeof zh === "string" && zh.trim()) { skinAnswered += 1; continue; }
      // The map's version banner and the AI's own name are not translated on purpose.
      if (SKIN_EXEMPT.has(key)) { skinAnswered += 1; continue; }
      if (value.length < 8 || !/[A-Za-z]/.test(value) || /[\u4e00-\u9fff]/.test(value)) continue;
      untranslated.push({ key, value });
    }
  }
  if (skinKeys) {
    console.log(`  ${skinKeys} [FrameDef] key(s) in war3mapSkin.txt, ${skinAnswered} answered by the sidecar`);
    for (const u of untranslated) console.log(`  EN    ${u.key} = ${u.value.slice(0, 60)}`);
  }
  if (errorKeys) {
    console.log(`  ${errorKeys} [Errors] key(s) re-worded by war3mapSkin.txt, ${errorAnswered} answered by the sidecar`);
    for (const u of errorUntranslated) console.log(`  ERR   ${u.key} = ${u.value.slice(0, 60)}`);
  }
  return flipped.length + untranslated.length + errorUntranslated.length + mapText.missing.length;
}

const maps = process.argv.slice(2);
if (!maps.length) {
  console.error("usage: node tools/map-i18n-lint.cjs <map.w3x> [...more]");
  process.exit(2);
}
let total = 0;
for (const m of maps) total += lint(m);
if (total) console.log(`\n${total} comparison(s) flipped by the dictionary — the map will take the other branch.`);
else console.log("\nevery name comparison still answers what the author wrote.");
process.exit(total ? 1 : 0);
