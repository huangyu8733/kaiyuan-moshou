#!/usr/bin/env node
// Put the NAMES back into the prose.
//
//   node tools/map-zh-patch/apply-names.cjs "Warcraft III zhCN/Maps/hhkj/<map>.w3x.zhCN.json" [...]
//
// DotA's own tooltips are written the way a player reads them: a recipe lists
// "Plate Mail - 1400", a hero's card lists its skills by name, a shop button says
// "Buy Shiva's Guard". The sidecar translated the SENTENCES — the names inside them were
// left in the map's language, because they are object names, not prose.
//
// So this pass learns the map's own English name for every rawcode (the name tables the map
// ships in `Units\*Strings.txt`, which is where DotA keeps them — it has no war3map.w3u/w3t),
// pairs each with the Chinese name the sidecar already carries for that same rawcode, and
// rewrites every text field with those pairs. The pairs also go INTO the file under `names`,
// so the engine can answer for a name that only turns up in a script string.
//
// Only ITEM and ABILITY names are substituted: unit and hero names are left alone on purpose,
// because they turn up inside backstories ("…Mortred 的姐妹…") where the proper noun is what
// the sentence is about, and swapping it for a title would read wrong.

const fs = require("node:fs");
const path = require("node:path");

const REPO = path.join(__dirname, "..", "..");
const mpqMod = require(path.join(REPO, "node_modules/mdx-m3-viewer/dist/cjs/parsers/mpq"));
const Archive = (mpqMod.default ?? mpqMod).Archive;

const NAME_TABLES = {
  items: "Units\\ItemStrings.txt",
  abilities: "Units\\CampaignAbilityStrings.txt",
  units: "Units\\CampaignUnitStrings.txt",
};

/** `[CODE]` sections and their `Name=` from one of the map's string tables. */
function readSections(archive, member) {
  const file = archive.get(member);
  if (!file) return new Map();
  const text = Buffer.from(file.bytes()).toString("utf8").replace(/^\uFEFF/, "");
  const out = new Map();
  let section = null;
  for (const line of text.split(/\r?\n/)) {
    const head = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (head) {
      section = head[1].trim();
      if (!out.has(section)) out.set(section, {});
      continue;
    }
    if (!section) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    if (key) out.get(section)[key] = line.slice(eq + 1).trim();
  }
  return out;
}

/** The name as a player sees it: colour codes off, quotes off. */
const plain = (s) =>
  String(s)
    .replace(/\|[cC][0-9a-fA-F]{8}/g, "")
    .replace(/\|r/gi, "")
    .replace(/\|[a-zA-Z]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const CJK = /[\u4e00-\u9fff]/;
const LATIN = /[A-Za-z]/;

/** A name worth substituting: a short Latin phrase, not a sentence and not a fragment. */
function usable(name) {
  if (!name || name.length < 3 || name.length > 48) return false;
  if (!LATIN.test(name) || CJK.test(name)) return false;
  if (/["\n\r]/.test(name)) return false;
  if (/[.;:!?]$/.test(name)) return false;
  if (name.split(" ").length > 5) return false;
  return true;
}

function pairsFor(archive, sidecar, kind) {
  const sections = readSections(archive, NAME_TABLES[kind]);
  const zh = sidecar.objects?.[kind] || {};
  const pairs = new Map();
  for (const [code, entry] of sections) {
    const en = plain(entry.Name || "");
    const cn = plain(zh[code]?.name || "");
    if (!usable(en) || !CJK.test(cn) || !cn) continue;
    if (pairs.has(en) && pairs.get(en) !== cn) continue; // ambiguous rawcodes: first wins
    pairs.set(en, cn);
  }
  return pairs;
}

/** English ability names → Chinese, from the hand-written table in tools/. */
function abilityDictionary() {
  const file = path.join(REPO, "tools", "dota-ability-zh.json");
  const out = new Map();
  if (!fs.existsSync(file)) return out;
  const dict = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const [en, zh] of Object.entries(dict)) {
    const name = typeof zh === "string" ? zh : zh?.name;
    if (!usable(en) || !name || !CJK.test(name)) continue;
    out.set(en, plain(name));
  }
  return out;
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Shop names — the `(Enchanted Artifacts)` a recipe puts after a component's price. They are
 *  UNIT names, which this pass otherwise leaves alone (see the header), so they are collected
 *  separately and only swapped where they stand inside brackets. */
function shopPairsFor(archive, sidecar) {
  const sections = readSections(archive, NAME_TABLES.units);
  const zh = sidecar.objects?.units || {};
  const pairs = new Map();
  for (const [code, entry] of sections) {
    const en = plain(entry.Name || "");
    const cn = plain(zh[code]?.name || "");
    if (!usable(en) || !CJK.test(cn) || !cn) continue;
    // A shop's name is a NAME, not a sentence: two or three words, no punctuation.
    if (en.split(" ").length > 3) continue;
    if (pairs.has(en) && pairs.get(en) !== cn) continue;
    pairs.set(en, cn);
  }
  return pairs;
}

/** Swap a shop name only where it appears inside brackets. */
function bracketReplacer(pairs) {
  const names = [...pairs.keys()].sort((a, b) => b.length - a.length);
  if (!names.length) return (s) => s;
  const re = new RegExp(`\\(\\s*(${names.map(escape).join("|")})\\s*\\)`, "g");
  return (s) => s.replace(re, (m, name) => `(${pairs.get(name) ?? name})`);
}

/** One long alternation, longest name first, matched on word boundaries — with WC3's markup
 *  SET ASIDE first.
 *
 *  A recipe reads `|nMaelstrom - 2800`, an ultimate `|c00ff8000Enrage|r`: in both, the
 *  character in front of the name is a letter of the markup (`n`, or the last digit of a
 *  colour code). Matching on "not preceded by a letter" therefore skipped exactly the names
 *  that matter. The markup is swapped for `\u0001<index>\u0001` while the substitution runs and
 *  put back afterwards, so a name always has a non-letter in front of it and the markup comes
 *  out byte-identical. */
function replacer(pairs) {
  const names = [...pairs.keys()].sort((a, b) => b.length - a.length);
  if (!names.length) return (s) => s;
  const re = new RegExp(`(?<![A-Za-z])(${names.map(escape).join("|")})(?![A-Za-z])`, "g");
  const MARKUP = /\|c[0-9a-fA-F]{8}|\|[nr]/g;
  return (s) => {
    if (!s || !/[A-Za-z]/.test(s)) return s;
    const saved = [];
    const masked = s.replace(MARKUP, (m) => {
      saved.push(m);
      return `\u0001${saved.length - 1}\u0001`;
    });
    const next = masked.replace(re, (m) => pairs.get(m) ?? m);
    if (next === masked) return s;
    return next.replace(/\u0001(\d+)\u0001/g, (_, i) => saved[Number(i)]);
  };
}

/** Fields whose text is prose the player reads. Names are NOT here: they are already Chinese. */
const STRING_FIELDS = ["description", "summary", "tip"];
const LIST_FIELDS = ["tips", "uberTips", "ubertips", "researchTip", "researchUberTip"];

function rewrite(sidecar, pairs, stats, shopPairs = new Map()) {
  const fixName = replacer(pairs);
  const fixShop = bracketReplacer(shopPairs);
  const fix = (s) => fixShop(fixName(s));
  const walk = (where, value) => {
    if (typeof value === "string") {
      const next = fix(value);
      if (next !== value) {
        stats.changed++;
        if (stats.samples.length < 8) stats.samples.push(`${where}: …${value.slice(0, 60)}… → …${next.slice(0, 60)}…`);
      }
      return next;
    }
    if (Array.isArray(value)) return value.map((v, i) => walk(`${where}[${i}]`, v));
    return value;
  };

  for (const [id, line] of Object.entries(sidecar.wts || {})) sidecar.wts[id] = walk(`wts.${id}`, line);
  for (const [line, zh] of Object.entries(sidecar.text || {})) sidecar.text[line] = walk("text", zh);

  for (const kind of ["units", "items", "abilities", "upgrades"]) {
    for (const [code, entry] of Object.entries(sidecar.objects?.[kind] || {})) {
      for (const field of STRING_FIELDS) {
        if (typeof entry[field] === "string") entry[field] = walk(`${kind}.${code}.${field}`, entry[field]);
      }
      for (const field of LIST_FIELDS) {
        if (Array.isArray(entry[field])) entry[field] = walk(`${kind}.${code}.${field}`, entry[field]);
      }
    }
  }
}

function main() {
  const files = process.argv.slice(2).filter((a) => a.endsWith(".json"));
  if (!files.length) {
    console.error("usage: apply-names.cjs <sidecar.json> [...]");
    process.exit(1);
  }
  const backup = "/tmp/map-names-backup";
  fs.mkdirSync(backup, { recursive: true });

  // The map's own archives, for its name tables. A sidecar whose map is not on disk still gets
  // the hand-written dictionary, which is most of the item names anyway.
  const archives = new Map();
  const archiveFor = (sidecarPath) => {
    const mapFile = sidecarPath.replace(/\.zhCN\.json$/i, "");
    if (!fs.existsSync(mapFile)) return null;
    if (archives.has(mapFile)) return archives.get(mapFile);
    const archive = new Archive();
    archive.load(fs.readFileSync(mapFile).buffer);
    archives.set(mapFile, archive);
    return archive;
  };

  const dict = abilityDictionary();
  console.log(`[names] dictionary: ${dict.size} English ability name(s) from tools/dota-ability-zh.json`);

  for (const file of files) {
    const sidecar = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
    const archive = archiveFor(file);
    const pairs = new Map(archive ? [...pairsFor(archive, sidecar, "items"), ...pairsFor(archive, sidecar, "abilities")] : []);
    for (const [en, zh] of dict) if (!pairs.has(en)) pairs.set(en, zh);

    const stats = { changed: 0, samples: [] };
    const shops = archive ? shopPairsFor(archive, sidecar) : new Map();
    rewrite(sidecar, pairs, stats, shops);
    sidecar.names = Object.fromEntries([...pairs.entries()].sort((a, b) => a[0].localeCompare(b[0])));

    fs.copyFileSync(file, path.join(backup, path.basename(file)));
    fs.writeFileSync(file, JSON.stringify(sidecar, null, 2) + "\n");
    console.log(`[names] ${path.basename(file)}: ${pairs.size} pair(s), ${shops.size} shop name(s), ${stats.changed} string(s) rewritten`);
    for (const s of stats.samples) console.log("        " + s);
  }
}

main();
