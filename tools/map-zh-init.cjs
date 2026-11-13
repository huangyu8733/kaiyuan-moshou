// Start (or refresh) a map's Chinese language file — the `<map>.w3x.zhCN.json` sidecar that
// `src/i18n/mapLanguage.ts` reads. Works on ANY map: nothing here knows Spellcraft or DotA.
//
//   node tools/map-zh-init.cjs "Maps/hhkj/Some Map.w3x"             # add what is missing, keep work
//   node tools/map-zh-init.cjs "Maps/hhkj/Some Map.w3x" --report    # only say what is missing
//   node tools/map-zh-init.cjs "Maps/hhkj/Some Map.w3x" --prune     # also DROP keys that are empty
//
// It collects the five tables a sidecar can answer, each from the place the engine actually reads:
//
//   wts     war3map.wts          STRING id → text. THE table for a map whose object data is
//                                `TRIGSTR_nnn`: translate an id and every Name/Tip/Ubertip that
//                                points at it changes at once — no per-object entry needed.
//                                The file's own `// Units: h01F (Necromancy), Name (Name)` comment
//                                is kept as `_comment` so a translator knows which field it is.
//   text    scripts\war3map.j    the prose literals the script prints (DisplayTextTo…), filtered:
//                                rawcodes, asset paths, animation names, colour-only strings and
//                                command tokens are dropped — see `prose()`.
//   skin    war3mapSkin.txt      [FrameDef] values that are LITERALS. A `TRIGSTR_n` value needs no
//                                entry: it resolves through the wts above.
//   errors  war3mapSkin.txt      [Errors] values, same rule.
//   info    war3map.w3i          name/description/suggested players, when they are literals
//                                (a `TRIGSTR_n` is answered by the wts table instead).
//
// A blank value means NOT TRANSLATED — the engine keeps the map's own line. So the generated file
// is safe to load the moment it exists: every entry it has not answered yet reads as the author
// wrote it. `--prune` exists because that rule also means a blank entry is dead weight.
//
// The `.w3x` is only READ. Nothing is repacked.

const { readFileSync, writeFileSync, existsSync } = require("node:fs");
const mpq = require("mdx-m3-viewer/dist/cjs/parsers/mpq");
const Archive = (mpq.default ?? mpq).Archive;

/** The field tag the WE wrote into the wts comment, e.g. "Name" out of
 *  `// Units: h01F (Necromancy), Name (Name)`. "" when the comment has no such shape. */
function commentField(comment) {
  const m = /,\s*([A-Za-z ]+?)\s*\(/.exec(comment);
  return m ? m[1].trim() : "";
}

/** Which wts fields are NOT player text. A hotkey is a keyboard letter, and `EditorHotkey` is
 *  the same letter in the editor: translating either would unbind the ability. */
const NON_TEXT_FIELDS = new Set(["Hotkey", "EditorHotkey", "Researchhotkey", "Unhotkey", "Unhotkey",
  "Revivehotkey", "Autocasthotkey", "Usehotkey", "Onhotkey", "Offhotkey"]);

/** `STRING 12\n// comment\n{\n text \n}` — the whole table, comment kept. */
function parseWtsFull(buf) {
  const text = buf.toString("utf8").replace(/^\uFEFF/, "");
  const out = [];
  const re = /STRING\s+(\d+)\s*\r?\n(?:\/\/[^\n]*\r?\n)?\s*\{\s*\r?\n([\s\S]*?)\r?\n\}/g;
  let m;
  while ((m = re.exec(text))) out.push({ id: m[1], text: m[2] });
  return out;
}

/** `STRING 12` + the comment line right above the `{`. Read separately because the body regex
 *  above deliberately skips it. */
function wtsComments(buf) {
  const text = buf.toString("utf8").replace(/^\uFEFF/, "");
  const out = new Map();
  const re = /STRING\s+(\d+)\s*\r?\n(\/\/[^\n]*)\r?\n\s*\{/g;
  let m;
  while ((m = re.exec(text))) out.set(m[1], m[2].replace(/^\/\/\s*/, "").trim());
  return out;
}

/** A string literal the player reads, or null for machine text. Kept deliberately strict: a
 *  language file full of asset paths is a language file nobody finishes. */
function prose(literal) {
  if (literal.length < 4 || literal.length > 400) return null;
  if (!/[A-Za-z]{3,}/.test(literal)) return null;
  const content = literal
    .replace(/\|c[0-9a-fA-F]{2,8}/g, "")
    .replace(/\|r|\|n/gi, "")
    .replace(/%[-0-9.]*[sd]/g, "")
    .replace(/[\s0-9.,:;!%+\-/()'"=<>[\]{}]/g, "");
  if (content.length < 3) return null;
  if (/^[A-Za-z0-9_]{4}$/.test(literal)) return null; // a rawcode
  if (/^TRIGSTR_\d+$/.test(literal)) return null; // resolved through the wts
  if (!/\s/.test(literal) && (/[a-z][A-Z]/.test(literal) || /^[A-Z_]{4,}$/.test(literal))) return null;
  // An asset path, a music playlist, an animation name — the engine reads these, a player doesn't.
  if (/^(war3map|scripts|units|abilities|ui|sound|fonts|objects|environment|replaceabletextures|doodads|terrain)\b/i.test(literal)) return null;
  if (/\.(mdx|mdl|blp|tga|wav|mp3|slk|txt|fdf|toc|j|ai)$/i.test(literal.trim())) return null;
  if (/^(stand|walk|attack|spell|birth|death|morph|dissipate|portrait|gold|lumber|weapon|hand|overhead|origin|chest)\b/i.test(literal)) return null;
  if (/^(right|left)[ ,]?hand$/i.test(literal)) return null;
  if (literal.trim().startsWith("-")) return null; // a chat command ("-ap")
  if (literal.trim().startsWith("$")) return null; // a script placeholder ("$dead")
  if (!/\s/.test(literal) && !/[!?:%]/.test(literal) && /^[a-z]+$/.test(literal)) return null;
  return literal;
}

/** Prose literals of a JASS script, deduplicated, longest first (the order a translator wants:
 *  sentences before fragments). */
function scriptLiterals(script) {
  const counts = new Map();
  const re = /"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(script))) {
    const raw = m[1]
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\r/g, "");
    const text = prose(raw);
    if (text) counts.set(text, (counts.get(text) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[0].length - a[0].length);
}

/** `[Section]` + `Key=Value` out of war3mapSkin.txt. */
function parseSkin(src) {
  const out = { customskin: new Map(), framedef: new Map(), errors: new Map() };
  let into = null;
  for (const raw of src.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("//")) continue;
    const head = /^\[(.+)\]$/.exec(line);
    if (head) {
      const name = head[1].trim().toLowerCase();
      into = name === "customskin" ? out.customskin : name === "framedef" ? out.framedef
        : name === "errors" ? out.errors : null;
      continue;
    }
    const eq = line.indexOf("=");
    if (!into || eq <= 0) continue;
    let value = line.slice(eq + 1).trim();
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    into.set(line.slice(0, eq).trim(), value);
  }
  return out;
}

/** The w3i's own text: the four C strings after the header. Enough for `info`, which is all this
 *  tool needs — the engine has a real reader for the rest (compat/w3i.ts). */
function w3iHeader(bytes) {
  if (!bytes || bytes.length < 12) return null;
  const version = bytes.readInt32LE(0);
  let at = 12;
  if (version > 27) at += 16;
  const out = [];
  for (let i = 0; i < 4; i++) {
    const end = bytes.indexOf(0, at);
    if (end < 0) return out;
    out.push(bytes.toString("utf-8", at, end));
    at = end + 1;
  }
  return out;
}

const args = process.argv.slice(2);
const mapPath = args.find((a) => !a.startsWith("--"));
const reportOnly = args.includes("--report");
const prune = args.includes("--prune");
if (!mapPath) {
  console.error("usage: node tools/map-zh-init.cjs <map.w3x> [--report] [--prune]");
  process.exit(2);
}
const outPath = `${mapPath}.zhCN.json`;

const archive = new Archive();
archive.load(new Uint8Array(readFileSync(mapPath)), true);
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

// --- what the map has -------------------------------------------------------------------
const wtsBytes = read("war3map.wts", "scripts\\war3map.wts");
const scriptBytes = read("scripts\\war3map.j", "war3map.j", "Scripts\\war3map.j");
const skinBytes = read("war3mapSkin.txt", "War3MapSkin.txt");
const w3iBytes = read("war3map.w3i");

const existing = existsSync(outPath)
  ? (() => { try { return JSON.parse(readFileSync(outPath, "utf8").replace(/^\uFEFF/, "")); } catch { return null; } })()
  : null;
const prior = (table) => (existing && typeof existing[table] === "object" && existing[table]) || {};

// --- wts --------------------------------------------------------------------------------
const wts = {};
const wtsFields = {};
if (wtsBytes) {
  const comments = wtsComments(wtsBytes);
  const priorWts = prior("wts");
  for (const { id, text } of parseWtsFull(wtsBytes)) {
    const field = commentField(comments.get(id) ?? "");
    if (NON_TEXT_FIELDS.has(field)) continue;
    if (!text.trim()) continue;
    // A bare number is a count ("1-10" players), not prose.
    if (!/[A-Za-z\u4e00-\u9fff]/.test(text)) continue;
    const kept = typeof priorWts[id] === "string" ? priorWts[id] : "";
    wts[id] = kept;
    wtsFields[id] = field;
  }
}
const answers = (o) => Object.values(o).filter((v) => typeof v === "string" && v.trim() !== "").length;

// --- script literals --------------------------------------------------------------------
const text = {};
if (scriptBytes) {
  const priorText = prior("text");
  for (const [line] of scriptLiterals(scriptBytes.toString("utf8"))) {
    text[line] = typeof priorText[line] === "string" ? priorText[line] : "";
  }
}

// --- skin tables (literal values only; a TRIGSTR_ is the wts table's job) ----------------
const skin = {};
const errors = {};
if (skinBytes) {
  const parsed = parseSkin(skinBytes.toString("utf8"));
  const priorSkin = prior("skin");
  const priorErrors = prior("errors");
  for (const [key, value] of parsed.framedef) {
    if (/^TRIGSTR_\d+$/i.test(value.trim())) continue;
    skin[key] = typeof priorSkin[key] === "string" ? priorSkin[key] : "";
  }
  for (const [key, value] of parsed.errors) {
    if (/^TRIGSTR_\d+$/i.test(value.trim())) continue;
    errors[key] = typeof priorErrors[key] === "string" ? priorErrors[key] : "";
  }
}

// --- the map-info block, only when the w3i wrote literals --------------------------------
const info = {};
const priorInfo = (existing && typeof existing.info === "object" && existing.info) || {};
if (w3iBytes) {
  const header = w3iHeader(w3iBytes);
  const fields = [["name", header?.[0]], ["description", header?.[2]], ["recommendedPlayers", header?.[3]]];
  for (const [field, value] of fields) {
    if (!value || /^TRIGSTR_\d+$/i.test(value.trim())) continue;
    if (!/[A-Za-z]{3}/.test(value)) continue;
    info[field] = typeof priorInfo[field] === "string" ? priorInfo[field] : "";
  }
}

// --- write ------------------------------------------------------------------------------
const dropBlank = (table) => Object.fromEntries(Object.entries(table).filter(([, v]) => (prune ? v.trim() !== "" : true)));
const doc = { format: 1, locale: "zhCN", map: mapPath.replace(/\\/g, "/").replace(/^.*\//, "") };
if (Object.keys(info).length) doc.info = dropBlank(info);
if (Object.keys(wts).length) doc.wts = dropBlank(wts);
if (Object.keys(text).length) doc.text = dropBlank(text);
if (Object.keys(skin).length) doc.skin = dropBlank(skin);
if (Object.keys(errors).length) doc.errors = dropBlank(errors);
// Anything a human added by hand (objects, names, …) survives a refresh.
for (const [key, value] of Object.entries(existing ?? {})) if (!(key in doc)) doc[key] = value;

if (!reportOnly) writeFileSync(outPath, `${JSON.stringify(doc, null, 1)}\n`, "utf8");

// --- report -----------------------------------------------------------------------------
const byField = new Map();
for (const [id, field] of Object.entries(wtsFields)) {
  const row = byField.get(field || "(no comment)") ?? { total: 0, done: 0, chars: 0 };
  row.total += 1;
  row.chars += 0;
  if (typeof wts[id] === "string" && wts[id].trim()) row.done += 1;
  byField.set(field || "(no comment)", row);
}
console.log(`\n=== ${mapPath}`);
console.log(`    ${reportOnly ? "reporting" : "wrote"} ${outPath}`);
console.log(`    wts     ${answers(wts)} / ${Object.keys(wts).length} translated`);
for (const [field, row] of [...byField].sort((a, b) => b[1].total - a[1].total)) {
  if (row.total < 3 && field === "(no comment)") continue;
  console.log(`      ${field.padEnd(16)} ${String(row.done).padStart(4)} / ${String(row.total).padEnd(4)}`);
}
if (Object.keys(text).length) console.log(`    text    ${answers(text)} / ${Object.keys(text).length} translated`);
if (Object.keys(skin).length) console.log(`    skin    ${answers(skin)} / ${Object.keys(skin).length} translated`);
if (Object.keys(errors).length) console.log(`    errors  ${answers(errors)} / ${Object.keys(errors).length} translated`);
if (Object.keys(info).length) console.log(`    info    ${answers(info)} / ${Object.keys(info).length} translated`);
if (existing && Object.keys(existing.objects ?? {}).length) {
  console.log(`    objects kept as they were: ${Object.values(existing.objects).reduce((n, b) => n + Object.keys(b ?? {}).length, 0)} row(s)`);
}
const blanks = Object.entries(wts).filter(([, v]) => !v.trim());
if (blanks.length) {
  console.log(`\n    ${blanks.length} wts entr${blanks.length === 1 ? "y" : "ies"} still blank. First few:`);
  for (const [id] of blanks.slice(0, 8)) console.log(`      ${id}  ${wtsFields[id] || ""}`);
}
console.log("");
