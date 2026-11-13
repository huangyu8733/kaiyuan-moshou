// A MAP's own words, said in Chinese — read from a file BESIDE the map.
//
// The maps we play are protected: their war3map.wts and their script are what they are and we
// are not going to repack them. But three of the four places a custom map's text lives are read
// at load time, so a file sitting next to the .w3x can answer for them (the same shape of
// feature as CustomKeys.txt, data/customKeys.ts, which is also a loose file in the install):
//
//   · war3map.wts — the map's STRING table: its name, description, credits, mode list;
//   · scripts\war3map.j — the on-screen lines the script prints (kills, sprees, mode notices),
//     reachable only at the DISPLAY boundary (natives/text.ts), never in script logic;
//   · the object tables — a name/tooltip override per rawcode, applied after the map's own
//     w3u/w3a so it wins.
//
// The file is `<map file name>.zhCN.json` in the map's folder:
//
//   Maps\hhkj\DotA v6.83d.w3x.zhCN.json
//
// Format 1:
//
//   { "format": 1, "locale": "zhCN",
//     "wts":   { "50001": "在史诗般的战斗中从 112 位英雄中选择一位…" },
//     "text":  { "First Blood": "第一滴血", "has just been killed by": "被以下玩家击杀：" },
//     "skin":  { "KEY_QUESTS": "地图信息(|Cfffed312F9|R)", "RESOURCES_COLUMN0": "金币" },
//     "errors": { "Nolumber": "该物品不需要卷轴。请直接购买配方中的组件。" },
//     "info":  { "name": "DotA 6.83d", "description": "从 112 位英雄中选择一位…" },
//     "objects": { "abilities": { "A00Y": { "name": "弧形闪电", "tip": ["…"], "ubertip": ["…"] } } } }
//
// Matching is deterministic, never a machine translation:
//   · wts    — by STRING id first, then by the ORIGINAL line through `text`;
//   · text   — CRLF→LF and trimmed on both sides; a whole-line hit first, then LONGEST key
//              first substring replacement (keys under 4 characters or without a letter are
//              never used, so rawcodes and colour codes are safe);
//   · skin   — the running map's `war3mapSkin.txt` [FrameDef] section, BY KEY (never as a
//              substring): its values are literals the author typed there, so the wts never
//              carries them and the install's Chinese data cannot reach them. This is where
//              DotA's `KEY_QUESTS=Map Info (F9)` lives — the top-left button bar's label;
//   · errors — the same file's [Errors] section, by error KEY: DotA re-words three of the
//              engine's refusals ("Nolumber" is not "not enough lumber" here but "you do not
//              need a recipe for this item"), so the install's own translation is the WRONG
//              sentence for the map — both the re-wording and its translation come from here;
//   · info   — the map's w3i name, description and suggested players, BY FIELD (not by the
//              source line): the Custom Game list and the map-info pane read these before any
//              match exists, and a description is a paragraph — as a `text` key it would have
//              to match a few hundred characters, colour codes, line breaks and all, and one
//              stray space would lose the translation in silence. DotA's w3i name is a literal
//              ("DotA v6.83d"), so the install's Chinese data cannot reach it either;
//   · objects— rawcode → fields; tip/ubertip arrays are level-aligned and an empty entry keeps
//              the original.
//
// The dictionary is opt-in per map: a `<map>.zhCN.json` beside the map is the player's explicit
// choice to localize that one map, and the file's own `locale` ("zhCN") is its scope. So the
// match applies it whenever the sidecar loads — an English player who has no sidecar still gets
// the map exactly as its author wrote it (the behaviour the campaign dictionary, i18n/campaignZh.ts,
// reaches through a different, built-in path).

import { parseWts } from "../jass/wts";
import { currentLocale, type Locale } from "./index";
import type { MapInfo } from "../world/mapInfo";
import type { UnitRegistry } from "../data/units";
import type { AbilityRegistry } from "../data/abilities";
import type { ItemRegistry } from "../data/items";
import type { UpgradeRegistry } from "../data/upgrades";

/** One object's replacement text. Every field is optional: absent means "leave it alone". */
export interface ObjectText {
  name?: string;
  /** Hero given names (units only); replaces the pool outright when it has entries. */
  properNames?: string[];
  /** Per-rank button titles; index-aligned, "" keeps the original. */
  tips?: string[];
  /** Per-rank descriptions; index-aligned, "" keeps the original. */
  uberTips?: string[];
  /** Items only: the long body / the one-line summary / the shop title. */
  description?: string;
  summary?: string;
  tip?: string;
  /** Upgrades only: the per-rank names ("Iron Forged Swords" → "铁铸剑"). */
  names?: string[];
}

export interface MapLanguage {
  readonly format: number;
  readonly locale: string;
  /** STRING id (as written in the file) → text. */
  readonly wts: ReadonlyMap<string, string>;
  /** Original line → text, for both wts values and on-screen lines. */
  readonly text: ReadonlyMap<string, string>;
  /** `war3mapSkin.txt` `[FrameDef]` KEY → text (the top-left button bar's "Map Info", the gold
   *  tooltip, …). Keyed, never matched inside a sentence: these are LITERALS the author typed
   *  into the skin, so `text` cannot own them, and a bare word like "Gold" must not become a
   *  substring rule for every other line on screen. */
  readonly skin: ReadonlyMap<string, string>;
  /** `war3mapSkin.txt` `[Errors]` KEY → text. A map may RE-WORD an engine refusal (DotA's
   *  `Nolumber` means "you do not need a recipe for this item", not "not enough lumber"), so
   *  this table translates the map's wording, which the install's own Chinese copy cannot. */
  readonly errors: ReadonlyMap<string, string>;
  /** The map's own w3i text, by FIELD — what the Custom Game list and the map-info pane print
   *  before a match exists (`localizedMapInfo`). Field-keyed rather than line-keyed because a
   *  description is a paragraph: as a `text` entry its key would be the whole thing, colour
   *  codes and line breaks included, and one edited space would drop the translation silently. */
  readonly info: MapInfoText;
  readonly objects: {
    readonly units: ReadonlyMap<string, ObjectText>;
    readonly abilities: ReadonlyMap<string, ObjectText>;
    readonly items: ReadonlyMap<string, ObjectText>;
    readonly upgrades: ReadonlyMap<string, ObjectText>;
  };
}

/** The map's own w3i text, in the sidecar's `info` block. Every field is optional: absent means
 *  "leave the map's own line alone". */
export interface MapInfoText {
  /** What the Custom Game list's row, the map-info pane and the loading screen title print. */
  name?: string;
  /** The author's blurb under the minimap (and, on a map that has one, the loading text). */
  description?: string;
  /** The "Suggested Players" row — usually a bare number, but a map may write "4v4" or a
   *  TRIGSTR sentence into it, which is why it is worth translating at all. */
  recommendedPlayers?: string;
}

const EMPTY: MapLanguage = {
  format: 1, locale: "zhCN",
  wts: new Map(), text: new Map(), skin: new Map(), errors: new Map(), info: {},
  objects: { units: new Map(), abilities: new Map(), items: new Map(), upgrades: new Map() },
};

const norm = (s: string): string => s.replace(/\r\n/g, "\n").trim();

/** The text-table keys longest first, filtered to ones safe to match inside a sentence.
 *  A blank value means "NOT TRANSLATED" (the generator leaves script-internal tokens such as
 *  `Source`, `Caster`, `Invoker|Wex` empty), so it must never become a substring rule: replacing
 *  one with "" would silently DELETE that word from any on-screen line containing it.
 *
 *  Each entry may contribute TWO candidates: the trimmed key (the long-standing behaviour) and
 *  the key AS WRITTEN, spaces and all (CRLF-normalized only). The raw form is how a sidecar
 *  authors a SHORT tail that the trim would kill: a Spellcraft timer reads "Level 12  in " and
 *  the answer for the trailing "  in " is a two-space key that must NOT widen into every bare
 *  "in" on screen. Kept apart from the trimmed candidate, longest first, so an exact whole-line
 *  key still wins before any fragment applies. */
function matchKeys(text: ReadonlyMap<string, string>): Array<{ key: string; value: string }> {
  const out: Array<{ key: string; value: string }> = [];
  const seen = new Set<string>();
  for (const [rawKey, value] of text) {
    if (value.trim() === "") continue;
    const raw = rawKey.replace(/\r\n/g, "\n");
    for (const key of raw.trim() === raw ? [raw] : [raw, raw.trim()]) {
      if (key.length >= 4 && /[A-Za-z]/.test(key) && !seen.has(key)) {
        seen.add(key);
        out.push({ key, value });
      }
    }
  }
  return out.sort((a, b) => b.key.length - a.key.length);
}

/** Read the `info` block. A blank field means "NOT TRANSLATED" — the map's own line stays —
 *  which is the same rule the `objects` block uses. */
function mapInfoText(raw: unknown): MapInfoText {
  const out: MapInfoText = {};
  if (!raw || typeof raw !== "object") return out;
  const v = raw as Record<string, unknown>;
  for (const field of ["name", "description", "recommendedPlayers"] as const) {
    const s = v[field];
    if (typeof s === "string" && s.trim() !== "") out[field] = s;
  }
  return out;
}

/** Read one `objects` block into a rawcode map; anything malformed is dropped, not thrown. */
function objectBlock(raw: unknown): Map<string, ObjectText> {
  const out = new Map<string, ObjectText>();
  if (!raw || typeof raw !== "object") return out;
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const v = value as Record<string, unknown>;
    const entry: ObjectText = {};
    for (const field of ["name", "description", "summary", "tip"] as const) {
      if (typeof v[field] === "string" && v[field] !== "") entry[field] = v[field] as string;
    }
    for (const field of ["properNames", "tips", "uberTips", "names"] as const) {
      const list = v[field];
      if (Array.isArray(list) && list.every((x) => typeof x === "string")) entry[field] = list as string[];
    }
    if (Object.keys(entry).length) out.set(id, entry);
  }
  return out;
}

/** The file as a MapLanguage, or null when it is not one (no version, not an object). */
export function parseMapLanguage(json: string): MapLanguage | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json.replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const doc = raw as Record<string, unknown>;
  if (typeof doc.format !== "number") return null;
  const strings = (v: unknown): Map<string, string> => {
    const out = new Map<string, string>();
    if (!v || typeof v !== "object") return out;
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (typeof x === "string") out.set(k, x);
    }
    return out;
  };
  const objects = (doc.objects && typeof doc.objects === "object" ? doc.objects : {}) as Record<string, unknown>;
  return {
    format: doc.format,
    locale: typeof doc.locale === "string" ? doc.locale : "zhCN",
    wts: strings(doc.wts),
    text: strings(doc.text),
    skin: strings(doc.skin),
    errors: strings(doc.errors),
    info: mapInfoText(doc.info),
    objects: {
      units: objectBlock(objects.units),
      abilities: objectBlock(objects.abilities),
      items: objectBlock(objects.items),
      upgrades: objectBlock(objects.upgrades),
    },
  };
}

// --- the active dictionary -------------------------------------------------------------

let active: MapLanguage | null = null;
let keys: Array<{ key: string; value: string }> = [];
/** Everything the object pass overwrote, so the next match starts from the install's rows. */
let undo: Array<{ target: Record<string, unknown>; field: string; before: unknown }> = [];

/**
 * The dictionary for the current match, or null when the map has none.
 *
 * Every display hook asks this first. The gate used to be `currentLocale() === "zhCN"` (the
 * APP's own UI language), but that was the wrong signal: a player can run a Chinese install
 * (`Warcraft III zhCN`, whose game data is Chinese) with the app's menus in another language,
 * and then the whole map dictionary was silently suppressed — skills, items, the in-game menu
 * all stayed in the map's authored language. The dictionary is *opt-in* instead: a map gets
 * Chinese only when a `<map>.zhCN.json` sidecar sits beside it, and that file's own `locale`
 * field (`zhCN`) is the scope. Its presence is the player's explicit choice to localize that
 * one map, so loading it is all the gate needs — an English player with no sidecar gets the map
 * exactly as its author wrote it, which is the behaviour we wanted.
 */
function live(): MapLanguage | null {
  return active;
}

/** Install (or clear) the dictionary for a match. Clearing puts every overridden object field
 *  back the way the registry had it, so a map with a language file cannot leak into the next. */
export function setMapLanguage(lang: MapLanguage | null): void {
  for (const u of undo) u.target[u.field] = u.before;
  undo = [];
  active = lang;
  keys = lang ? matchKeys(lang.text) : [];
}

export function mapLanguage(): MapLanguage | null {
  return active;
}

/** One of the map's own STRING-table lines, by id — what a `TRIGSTR_<id>` field resolves to
 *  (`world/mapInfo.ts` reads the w3i before the sidecar is applied anywhere else). */
export function mapWtsString(id: number): string | undefined {
  const lang = live();
  return lang?.wts.get(String(id));
}

/** The dictionary for one line of wts text: by SOURCE line through the text table. */
function wtsBySource(line: string): string | undefined {
  if (!active) return undefined;
  return active.text.get(norm(line));
}

/** Apply the dictionary to a parsed wts table IN PLACE (the table every consumer shares). */
export function localizeMapWtsTable(table: Map<number, string>): Map<number, string> {
  const lang = live();
  if (!lang) return table;
  for (const [id, line] of table) {
    const byId = lang.wts.get(String(id));
    const next = byId ?? wtsBySource(line);
    if (next !== undefined && next !== "") table.set(id, next);
  }
  return table;
}

/** The same for the raw file, which is how jass/index.ts hands it to the interpreter. Rebuilt
 *  only when something changed, in the campaign dictionary's own shape. */
export function localizeMapWtsText(text: string): string {
  if (!live()) return text;
  const table = parseWts(text);
  let changed = false;
  for (const [id, line] of table) {
    const byId = active!.wts.get(String(id));
    const next = byId ?? wtsBySource(line);
    if (next === undefined || next === "") continue;
    table.set(id, next);
    changed = true;
  }
  if (!changed) return text;
  return [...table].map(([id, line]) => `STRING ${id}\n{\n${line}\n}`).join("\n\n") + "\n";
}

/**
 * One string on its way to the screen. Whole-line first, then the longest dictionary key found
 * inside it — DotA builds its announcements by concatenation ("|c00ff0303" + name + "|r is on a
 * killing spree!"), so a line-for-line table alone would translate almost none of them.
 */
export function mapDisplayText(text: string): string {
  const lang = live();
  if (!lang || !text) return text;
  const exact = lang.text.get(norm(text));
  // Same "blank = not translated" rule as `matchKeys`: an empty/whitespace answer keeps the
  // original line rather than blanking the screen.
  if (exact !== undefined && exact.trim() !== "") return exact;
  let out = text;
  for (const { key, value } of keys) {
    if (out.includes(key)) out = out.split(key).join(value);
  }
  return out;
}

/**
 * One `[FrameDef]` line out of the running map's `war3mapSkin.txt`.
 *
 * Keyed by the FrameDef KEY, not by the value: DotA rewrites `KEY_QUESTS` to "Map Info (F9)" so
 * the top-left button bar reads `Map Info | 菜单 | 盟友 | 聊天`, and the same file rewrites the
 * gold tooltip and the stat-bonus lines. Those values are literals the author typed, so the
 * map's war3map.wts never carries them and the install's Chinese data cannot reach them either.
 * A key the sidecar's `skin` table does not name falls through to the ordinary text table, so a
 * skin value that IS a TRIGSTR-backed wts line still translates the usual way.
 */
export function mapSkinText(key: string, value: string): string {
  const lang = live();
  if (!lang) return value;
  const hit = lang.skin.get(key);
  if (hit !== undefined && hit.trim() !== "") return hit;
  return mapDisplayText(value);
}

/**
 * One `[Errors]` line out of the running map's `war3mapSkin.txt`.
 *
 * Keyed by the error KEY ("Nolumber"), not by the sentence, because a map's `[Errors]` block is
 * where a custom map takes an engine refusal over and re-words it for its own rules: DotA's
 * `Nolumber` is "You do not need a recipe for this item. Buy the components listed in the
 * recipe instead." — nothing to do with lumber. The install's Chinese copy of `Nolumber` ("木材
 * 不够。") is therefore not merely untranslated but the WRONG sentence, which is why the
 * dictionary has to answer for the key and not the line.
 *
 * Lookup is case-insensitive: the data's own casing is inconsistent ("Needemptytree" here,
 * "Targettree" in the install's file) and the engine matches it that way.
 */
export function mapErrorText(key: string, value: string): string {
  const lang = live();
  if (!lang) return value;
  const hit = errorLookup(lang, key);
  if (hit !== undefined && hit.trim() !== "") return hit;
  return mapDisplayText(value);
}

/** `errors.<key>` by the spelling the caller has, then folded — the caller may hold the map's
 *  own casing ("Nolumber") or a lower-cased one ("nolumber", which is how `[Errors]` is stored
 *  in the overlay and how `CommandStrings` indexes its own table). */
function errorLookup(lang: MapLanguage, key: string): string | undefined {
  const exact = lang.errors.get(key) ?? lang.errors.get(key.toLowerCase());
  if (exact !== undefined) return exact;
  const lower = key.toLowerCase();
  for (const [k, v] of lang.errors) if (k.toLowerCase() === lower) return v;
  return undefined;
}

/**
 * The map's own name, description and suggested players (the Custom Game list, the map-info
 * pane and the loading screen), as a COPY — `MapInfo` is cached per path, so a Chinese title
 * must not stick to the cache.
 *
 * Three answers, in order:
 *   1. the sidecar's `info` block — the translators' own wording for this screen;
 *   2. the sidecar's `wts` table, by STRING ID — this is the one that matters for a DotA: its
 *      w3i says `TRIGSTR_50001` and the file already holds both the name and the blurb under
 *      50000/50001. The LIST reads maps before any match, so `resolveName` answered from the
 *      INSTALL's wts and printed the author's line; `MapInfo.sources` keeps the id so this can
 *      ask the sidecar the same question;
 *   3. the `text` table as a WHOLE-LINE hit (a short name a shipped file already carries).
 */
export function localizedMapInfo(info: MapInfo, lang: MapLanguage | null = live()): MapInfo {
  if (!lang) return info;
  const name = infoField(lang, info, "name", info.name);
  const description = infoField(lang, info, "description", info.description);
  const recommendedPlayers = infoField(lang, info, "recommendedPlayers", info.recommendedPlayers);
  // …and the headings and owner lines the same w3i names: the lobby prints a force's own name
  // over its rows, and a DotA's two are "The Sentinel" / "The Scourge" — TRIGSTRs 50002/50003
  // its sidecar already holds in Chinese.
  const forces = namedCopy(info.forces, lang);
  const slots = namedCopy(info.slots, lang);
  const neutralPlayers = namedCopy(info.neutralPlayers, lang);
  const same = name === info.name && description === info.description
    && recommendedPlayers === info.recommendedPlayers
    && forces === info.forces && slots === info.slots && neutralPlayers === info.neutralPlayers;
  return same ? info : { ...info, name, description, recommendedPlayers, forces, slots, neutralPlayers };
}

/** A list of map-declared owners with each `name` translated. Returns the SAME array when
 *  nothing changed, so the cached `MapInfo` keeps its identity and the pane's minimap cache
 *  (keyed on the object) still hits. */
function namedCopy<T extends { name: string; nameSource?: string }>(list: readonly T[], lang: MapLanguage): T[] {
  let changed = false;
  const out = list.map((item) => {
    const name = translateSource(lang, item.nameSource ?? item.name, item.name);
    if (name === item.name) return item;
    changed = true;
    return { ...item, name };
  });
  return changed ? out : (list as T[]);
}

/** One `info` field: the block, then the wts id the w3i named, then a whole-line `text` hit,
 *  then the map's own line. */
function infoField(lang: MapLanguage, info: MapInfo, field: keyof MapInfoText, source: string): string {
  const declared = lang.info[field];
  if (declared !== undefined) return declared;
  return translateSource(lang, info.sources?.[field] ?? source, source);
}

/** A map-declared line: the sidecar's `wts` answer to the id the w3i named, else a whole-line
 *  hit in `text`, else the map's own line. */
function translateSource(lang: MapLanguage, source: string, shown: string): string {
  const byId = wtsLine(lang, source);
  if (byId !== undefined) return byId;
  const hit = lang.text.get(norm(shown));
  return hit !== undefined && hit.trim() !== "" ? hit : shown;
}

/** A `TRIGSTR_nnn` source asked of the sidecar's own `wts` table. Undefined for a literal, and
 *  for an id the file does not answer with real text. */
function wtsLine(lang: MapLanguage, source: string | undefined): string | undefined {
  const m = /^TRIGSTR_(\d+)$/i.exec((source ?? "").trim());
  if (!m) return undefined;
  const hit = lang.wts.get(String(parseInt(m[1], 10)));
  return hit !== undefined && hit.trim() !== "" ? hit : undefined;
}

/** The install door as the reader `loadMapLanguage` wants: a file beside a map is just another
 *  install file (the same seam `data/customKeys.ts` reads CustomKeys.txt through). */
export function installReader(vfs: { exists(path: string): boolean; read(path: string): Promise<Uint8Array> }): (path: string) => Promise<Uint8Array | null> {
  return async (path) => {
    if (vfs.exists(path)) return vfs.read(path);
    // `exists` is only as good as the layer that answers it. A sidecar is a LOOSE file sitting
    // beside the map, and the loose layer is a different source from the one holding the game's
    // archives — a spelling it normalizes differently, a stacked source that does not forward,
    // and a file that reads perfectly answers "no". So ask the bytes once before believing it;
    // the cost is one failed lookup per map, and only for maps that have no sidecar at all.
    try {
      return await vfs.read(path);
    } catch {
      return null;
    }
  };
}

/** Put one level-aligned array of strings over another. Empty entries keep the original. */
function overlayList(before: string[], after: string[] | undefined): string[] | undefined {
  if (!after || !after.length) return undefined;
  const out = before.length >= after.length ? [...before] : [...after].map((v, i) => before[i] ?? v);
  for (let i = 0; i < after.length; i++) if (after[i] !== "") out[i] = after[i];
  return out;
}

function record<T extends object>(target: T, field: keyof T & string): void {
  undo.push({ target: target as unknown as Record<string, unknown>, field, before: (target as unknown as Record<string, unknown>)[field] });
}

/** Apply the `objects` block to the five registries, after the map's own object data. */
export function applyMapObjectLanguage(regs: {
  registry: UnitRegistry;
  abilities: AbilityRegistry;
  items: ItemRegistry;
  upgrades: UpgradeRegistry;
}): void {
  const lang = live();
  if (!lang) return;
  // IDEMPOTENT. The match bring-up asks again (mapViewer `beginMatch`), so a dictionary that
  // arrived after the map's object data still lands — and a second call must start from the rows
  // the install had, not from its own answer, or clearing would "restore" the Chinese.
  for (const u of undo) u.target[u.field] = u.before;
  undo = [];
  /** How many of the file's rows found their object. A file that matches NOTHING is the one
   *  failure the old log hid completely: it printed only when something was overridden. */
  let matched = 0;
  let missing = 0;
  for (const [id, t] of lang.objects.units) {
    const def = regs.registry.get(id);
    if (!def) { missing++; continue; }
    matched++;
    if (t.name !== undefined) { record(def, "name"); def.name = t.name; }
    const names = overlayList(def.properNames, t.properNames);
    if (names) { record(def, "properNames"); def.properNames = names; }
    // The map's own `Tip`/`Ubertip` (hover title and body of a unit or a building) — DotA
    // authored these in English/Portuguese, and the install row cannot answer for them.
    for (const field of ["tip", "description"] as const) {
      const v = t[field];
      if (v !== undefined) { record(def, field); def[field] = v; }
    }
  }
  for (const [id, t] of lang.objects.abilities) {
    const def = regs.abilities.get(id);
    if (!def) { missing++; continue; }
    matched++;
    if (t.name !== undefined) { record(def, "name"); def.name = t.name; }
    const tips = overlayList(def.tips, t.tips);
    if (tips) { record(def, "tips"); def.tips = tips; }
    const uber = overlayList(def.uberTips, t.uberTips);
    if (uber) { record(def, "uberTips"); def.uberTips = uber; }
    // …AND THE LEARN PAGE, which reads a different pair: `Researchtip` ("Learn X - [Level N]")
    // and `Researchubertip` (what every rank does). The file has no rows for either, so a hero's
    // learn sheet kept the map's own words while its command card turned Chinese — the one screen
    // a DotA player spends the first minute of a match on. Both have a Chinese answer here
    // already: the title is the (now Chinese) name with the page's own `%d` rank slot, and the
    // body is `uberTips`, which the learn button falls back to when `researchUberTip` is empty.
    if (t.name !== undefined) {
      record(def, "researchTip");
      def.researchTip = `${def.name} - [|cffffcc00等级 %d|r]`;
      if (uber) { record(def, "researchUberTip"); def.researchUberTip = ""; }
    }
  }
  for (const [id, t] of lang.objects.items) {
    const def = regs.items.get(id);
    if (!def) { missing++; continue; }
    matched++;
    for (const field of ["name", "description", "summary", "tip"] as const) {
      const v = t[field];
      if (v !== undefined) { record(def, field); def[field] = v; }
    }
  }
  for (const [id, t] of lang.objects.upgrades) {
    const def = regs.upgrades.get(id);
    if (!def) { missing++; continue; }
    matched++;
    const names = overlayList(def.names, t.names);
    if (names) { record(def, "names"); def.names = names; }
    const tips = overlayList(def.tips, t.tips);
    if (tips) { record(def, "tips"); def.tips = tips; }
    const uber = overlayList(def.uberTips, t.uberTips);
    if (uber) { record(def, "uberTips"); def.uberTips = uber; }
  }
  if (!matched) {
    // Loaded, but not one row landed: the registries were empty when this ran, or the ids are
    // not the ones the map uses. Either way the screen stays in the author's language, so say so.
    console.warn(`[i18n] map language matched NO object (${lang.objects.units.size + lang.objects.abilities.size + lang.objects.items.size + lang.objects.upgrades.size} row(s) in the file, ${missing} unknown here) — was it applied before the object data?`);
  } else {
    console.info(`[i18n] map language: ${undo.length} object field(s) overridden (${matched} object(s) matched, ${missing} not in this install).`);
  }
}

// --- reading the file -------------------------------------------------------------------

/** The last segment of a path, whatever separator the caller spelled it with. */
function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/** The two names a sidecar may have: `<file name>.<locale>.json` and `<base>.<locale>.json`.
 *  The app's own language is asked for first; a Chinese dictionary still answers for a map on
 *  an English-speaking menu, because that is the one sidecar this project has always shipped. */
function candidates(mapPath: string): string[] {
  const sep = mapPath.includes("\\") ? "\\" : "/";
  const cut = Math.max(mapPath.lastIndexOf("\\"), mapPath.lastIndexOf("/"));
  const dir = cut >= 0 ? mapPath.slice(0, cut) : "";
  const file = cut >= 0 ? mapPath.slice(cut + 1) : mapPath;
  const base = file.replace(/\.w3[mx]$/i, "");
  const prefix = dir ? dir + sep : "";
  const locale: Locale = currentLocale();
  const locales = locale === "zhCN" ? ["zhCN"] : [locale, "zhCN"];
  return locales.flatMap((lang) => [
    `${prefix}${file}.${lang}.json`,
    `${prefix}${base}.${lang}.json`,
  ]);
}

/** Read and parse ONE candidate. Null when it is absent, empty or not a language file. */
async function readLanguageAt(
  read: (path: string) => Promise<Uint8Array | null>,
  path: string,
): Promise<MapLanguage | null> {
  let bytes: Uint8Array | null = null;
  try {
    bytes = await read(path);
  } catch {
    return null;
  }
  if (!bytes || !bytes.length) return null;
  const lang = parseMapLanguage(new TextDecoder("utf-8").decode(bytes));
  if (!lang) {
    console.warn(`[i18n] map language file is not valid JSON: ${path}`);
    return null;
  }
  console.info(`[i18n] map language: ${path} (${lang.wts.size} wts, ${lang.text.size} text, ${lang.objects.units.size + lang.objects.abilities.size + lang.objects.items.size + lang.objects.upgrades.size} object(s))`);
  return lang;
}

/**
 * Load the language file beside a map. `read` is the install door's reader (a sibling of the
 * map is just another install file); a null answer means "no language file", which is the
 * normal case for every map that was not translated.
 */
export async function loadMapLanguage(
  read: (path: string) => Promise<Uint8Array | null>,
  mapPath: string,
): Promise<MapLanguage | null> {
  const tried: string[] = [];
  for (const path of candidates(mapPath)) {
    tried.push(path);
    const lang = await readLanguageAt(read, path);
    if (lang) return lang;
  }
  // Not silent: "the map is still in its author's language" was indistinguishable from "the
  // sidecar is there but this build cannot see it", which is a whole afternoon of guessing.
  console.info(`[i18n] no map language file beside ${mapPath || "(no map path)"} — tried ${tried.join(", ")}`);
  return null;
}

/**
 * The same file found BY NAME, wherever the install spells its path.
 *
 * `loadMapLanguage` asks for the sidecar at a path built from the map's own path, so it answers
 * only when the two agree character for character. A host can hand the installer a path whose
 * folder is spelled differently (`Maps\hhkj` vs `maps\hhkj`) or that is not install-relative at
 * all, and then a file that IS there reads as absent — the map stays in its author's language
 * with nothing in the log to say why. This is the same question asked of the install's own file
 * list instead: same last segment, case-insensitively. Cheap, and it only runs on a miss.
 */
export async function findMapLanguageByName(
  read: (path: string) => Promise<Uint8Array | null>,
  list: () => string[],
  mapName: string,
): Promise<MapLanguage | null> {
  const want = baseName(mapName).toLowerCase();
  if (!want) return null;
  const base = want.replace(/\.w3[mx]$/i, "");
  const locale = currentLocale();
  const locales = locale === "zhCN" ? ["zhCN"] : [locale, "zhCN"];
  const names = new Set(locales.flatMap((lang) => [
    `${want}.${lang.toLowerCase()}.json`,
    `${base}.${lang.toLowerCase()}.json`,
  ]));
  let hit: string | undefined;
  try {
    hit = list().find((p) => names.has(baseName(p).toLowerCase()));
  } catch {
    return null;
  }
  if (!hit) return null;
  const lang = await readLanguageAt(read, hit);
  if (lang) console.info(`[i18n] map language found by name: ${hit}`);
  return lang;
}

/** The empty dictionary, exported so a caller can clear without importing the singleton. */
export const NO_MAP_LANGUAGE: MapLanguage = EMPTY;
