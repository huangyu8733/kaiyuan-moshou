// A CUSTOM MAP's own voice pack — read from a JSON file BESIDE the map.
//
// The common grammar knows what every Warcraft III map has in common: select, move, attack, train,
// build, camera, chat, panels. A custom map's own words ("肉山", "打野", "推线") live with the map,
// not in this program: a file next to the `.w3x` teaches Voice Control that one map, and travels
// with it — copy the two files together and the commands come along. The same mechanism the map's
// Chinese dictionary uses (i18n/mapLanguage.ts), and read through the same door.
//
// The file is `<map file name>.voice.json` in the map's folder, or `<base name>.voice.json`:
//
//   Maps\hhkj\DotA v6.83d.w3x.voice.json
//
// ONE file, EVERY language it speaks. This matters because a recogniser only ever hears the
// player's own language: the Chinese player's pack and the English player's pack are two blocks
// of the same file, so a map is distributed once and works for both.
//
//   { "format": 1, "default": "zhCN",
//     "languages": {
//       "zhCN": {
//         "names": {
//           "units":     { "n01X": ["肉山", "Roshan"] },
//           "buildings": { "n01Y": "生命之泉" },
//           "abilities": { "A00Y": ["沟壑"] },
//           "items":     { "I00A": ["跳刀", "闪烁匕首"] }
//         },
//         "commands": [
//           { "say": ["打野", "清野"], "do": { "order": "attackmove", "target": { "kind": "creeps" } } },
//           { "say": ["推线"],       "do": { "order": "attackmove", "target": { "kind": "region", "region": { "x": 0, "y": 0 } } } },
//           { "say": ["守家", "回防"], "do": { "order": "move", "target": { "kind": "base", "side": "mine" } } },
//           { "say": ["集火"],       "do": { "order": "attack", "target": { "kind": "hero", "side": "enemy" } } }
//         ]
//       },
//       "enUS": {
//         "commands": [
//           { "say": ["jungle"],        "do": { "order": "attackmove", "target": { "kind": "creeps" } } },
//           { "say": ["push the lane"], "do": { "order": "attackmove", "target": { "kind": "region", "region": { "x": 0, "y": 0 } } } },
//           { "say": ["defend"],        "do": { "order": "move", "target": { "kind": "base", "side": "mine" } } },
//           { "say": ["focus fire"],    "do": { "order": "attack", "target": { "kind": "hero", "side": "enemy" } } }
//         ]
//       }
//     } }
//
// A file with no `languages` block is one language: its `locale` (or the player's) names it.
//
// `names` is the map's own vocabulary: rawcode → the ways players say it. It adds NAMES only, so a
// name can never run anything the common grammar could not; it points at an id the match already
// knows (a unit/building/ability/item/upgrade), or at a `button` command id. A unit named here can
// also be the TARGET of a command ("attack 肉山"), because the target's rawcode is looked up in the
// same table.
//
// `commands` are whole sentences. Each `do` is a command the game already understands, so a map
// can re-word its own controls without adding a line of code:
//
//   { "order": "move"|"attack"|"attackmove"|"patrol"|"attackground"|"rally"|"smart", "target": … }
//   { "retreat": true, "target": … }            { "stop": true }   { "hold": true }   { "cancel": true }
//   { "harvest": true, "res": "gold"|"lumber", "target": … }
//   { "select": "army"|"idle"|"hero" }           { "group": 2, "mode": "recall"|"assign"|"add" }
//   { "camera": <target> }                       { "panel": "quests"|"menu"|"allies"|"chat", "open": true|false }
//   { "dialog": 2 }  (0-based; true = first available)   { "quest": true }   { "cinematic": true }
//   { "chat": "gg", "scope": "all"|"allies" }
//
// A target is:
//
//   { "kind": "screen"|"cursor"|"trees"|"army"|"mine" }
//   { "kind": "hero"|"base", "side": "mine"|"enemy"|"ally"|"any", "region": {...}, "pick": "nearest"|"next" }
//   { "kind": "unit", "id": "n01X", "side": "enemy" }   — or "name" instead of "id"
//   { "kind": "creeps", "tier": "green"|"orange"|"red" }
//   { "kind": "region", "region": { "x": -1|0|1|null, "y": -1|0|1|null } }
//   { "kind": "step", "dx": 0, "dy": 900, "scale": 1 }
//
// Malformed rows are skipped one by one with a console warning; a file that is not a voice pack at
// all answers null and the match plays with the common grammar alone. Nothing here can throw into
// a match.

import { currentLocale } from "../i18n";
import {
  words,
  type LexEntry,
  type OrderVerb,
  type Pick,
  type Region,
  type Side,
  type VoiceIntent,
  type VoiceTarget,
} from "./parser";
import type { VoicePack, VoicePhrase } from "./packs";

/** One map's compiled pack, plus what the console needs to explain it. */
export interface MapVoice {
  readonly format: number;
  /** The language block that was used ("zhCN", "enUS"…). */
  readonly locale: string;
  readonly pack: VoicePack;
}

const NAME_KINDS: Readonly<Record<string, LexEntry["kind"]>> = {
  units: "unit",
  buildings: "building",
  heroes: "hero",
  abilities: "ability",
  items: "item",
  upgrades: "upgrade",
  buttons: "button",
};

const ORDER_SET: ReadonlySet<string> = new Set<OrderVerb>(["move", "attack", "attackmove", "patrol", "attackground", "rally", "smart"]);
const SIDE_SET: ReadonlySet<string> = new Set<Side>(["mine", "enemy", "ally", "any"]);
const PICK_SET: ReadonlySet<string> = new Set<Pick>(["nearest", "next"]);
const TIER_SET = new Set(["green", "orange", "red"]);
const PANEL_SET = new Set(["quests", "menu", "allies", "chat"]);
const SELECT_SET = new Set(["army", "idle", "hero"]);
const GROUP_MODE_SET = new Set(["recall", "assign", "add"]);

const rec = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

/** One name's aliases: a string or an array of strings. Blank rows are dropped. */
function aliases(v: unknown): string[] {
  const one = text(v);
  if (one) return [one];
  if (!Array.isArray(v)) return [];
  return v.map(text).filter((s): s is string => !!s);
}

function sideOf(v: unknown): Side | undefined {
  const s = text(v);
  return s && SIDE_SET.has(s) ? (s as Side) : undefined;
}

function pickOf(v: unknown): Pick | undefined {
  const p = text(v);
  return p && PICK_SET.has(p) ? (p as Pick) : undefined;
}

function regionOf(v: unknown): Region | undefined {
  const r = rec(v);
  if (!r) return undefined;
  const axis = (x: unknown): -1 | 0 | 1 | null => (x === -1 || x === 0 || x === 1 ? x : null);
  return { x: axis(r.x), y: axis(r.y) };
}

/** One target the game already understands, or null for a row it cannot use. */
function targetOf(raw: unknown, names: ReadonlyMap<string, string>): VoiceTarget | null {
  const t = rec(raw);
  if (!t) return null;
  const kind = text(t.kind) ?? "";
  const side = sideOf(t.side);
  const pick = pickOf(t.pick);
  const region = regionOf(t.region);
  switch (kind) {
    case "screen": return { kind: "screen" };
    case "cursor": return { kind: "cursor" };
    case "trees": return { kind: "trees" };
    case "army": return { kind: "army" };
    case "mine": return { kind: "mine", region, pick };
    case "hero": return { kind: "hero", side: side ?? "any", region, pick };
    case "base": return { kind: "base", side: side ?? "any", region, pick };
    case "creeps": {
      const tier = text(t.tier);
      return { kind: "creeps", region, pick, tier: tier && TIER_SET.has(tier) ? (tier as "green" | "orange" | "red") : undefined };
    }
    case "region": return { kind: "region", region: region ?? { x: null, y: null } };
    case "unit":
    case "building": {
      const id = text(t.id) ?? "*";
      const phrase = text(t.name) ?? names.get(id) ?? id;
      const entry: LexEntry = { kind: kind === "building" ? "building" : "unit", id, phrase };
      return { kind: "unit", entry, side: side ?? "any", region, pick };
    }
    case "step": {
      const dx = Number(t.dx);
      const dy = Number(t.dy);
      const scale = t.scale === undefined ? 1 : Number(t.scale);
      if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(scale) || scale <= 0) return null;
      return { kind: "step", dx, dy, scale };
    }
    default: return null;
  }
}

/** One `do` block as an intent the common grammar already has. */
function intentOf(raw: unknown, names: ReadonlyMap<string, string>): VoiceIntent | null {
  const d = rec(raw);
  if (!d) return null;
  if (typeof d.order === "string") {
    const order = text(d.order);
    if (!order || !ORDER_SET.has(order)) return null;
    const target = d.target === undefined ? undefined : targetOf(d.target, names);
    if (d.target !== undefined && !target) return null;
    return { kind: "order", order: order as OrderVerb, target: target ?? undefined };
  }
  if (d.retreat === true) {
    const target = d.target === undefined ? undefined : targetOf(d.target, names);
    if (d.target !== undefined && !target) return null;
    return { kind: "retreat", target: target ?? undefined };
  }
  if (d.stop === true) return { kind: "stop" };
  if (d.hold === true) return { kind: "hold" };
  if (d.cancel === true) return { kind: "cancel" };
  if (d.quest === true) return { kind: "quest" };
  if (d.cinematic === true) return { kind: "cinematic", skip: true };
  if (d.harvest === true) {
    const res = text(d.res);
    const target = d.target === undefined ? undefined : targetOf(d.target, names);
    if (d.target !== undefined && !target) return null;
    return { kind: "harvest", res: res === "gold" || res === "lumber" ? res : undefined, target: target ?? undefined };
  }
  if (typeof d.select === "string") {
    const what = text(d.select);
    return what && SELECT_SET.has(what) ? { kind: "select", what: what as "army" | "idle" | "hero" } : null;
  }
  if (typeof d.group === "number") {
    const n = Math.trunc(d.group);
    const mode = text(d.mode) ?? "recall";
    if (!Number.isFinite(n) || n < 0 || n > 9 || !GROUP_MODE_SET.has(mode)) return null;
    return { kind: "group", n, mode: mode as "recall" | "assign" | "add" };
  }
  if (d.camera !== undefined) {
    const target = targetOf(d.camera, names);
    return target ? { kind: "camera", target } : null;
  }
  if (typeof d.panel === "string") {
    const panel = text(d.panel);
    if (!panel || !PANEL_SET.has(panel)) return null;
    const open = typeof d.open === "boolean" ? d.open : null;
    return { kind: "panel", panel: panel as "quests" | "menu" | "allies" | "chat", open };
  }
  if (d.dialog !== undefined) {
    if (d.dialog === true) return { kind: "dialog" };
    if (typeof d.dialog === "number" && Number.isInteger(d.dialog) && d.dialog >= 0) return { kind: "dialog", index: d.dialog };
    return null;
  }
  if (typeof d.chat === "string") {
    const scope = text(d.scope);
    if (scope && scope !== "all" && scope !== "allies") return null;
    return { kind: "chat", text: d.chat, scope: scope === "all" || scope === "allies" ? scope : null };
  }
  if (typeof d.pause === "boolean") return { kind: "pause", on: d.pause };
  return null;
}

/** The language block to read: the player's own, else the file's `default`, else the first. */
function pickLanguage(languages: Record<string, unknown>, fallback?: string): string | null {
  const keys = Object.keys(languages);
  if (!keys.length) return null;
  const want = currentLocale().toLowerCase();
  const own = keys.find((k) => k.toLowerCase() === want);
  if (own) return own;
  if (fallback) {
    const declared = keys.find((k) => k.toLowerCase() === fallback.toLowerCase());
    if (declared) return declared;
  }
  return keys[0];
}

/** `names` (rawcode → aliases) and the optional explicit `entries` list, as LexEntries. */
function namesOf(rawNames: unknown, rawEntries: unknown): { entries: LexEntry[]; names: Set<string>; byId: Map<string, string> } {
  const entries: LexEntry[] = [];
  const names = new Set<string>();
  const byId = new Map<string, string>();
  const add = (kind: LexEntry["kind"], id: string, phrase: string): void => {
    if (!id || !phrase) return;
    entries.push({ kind, id, phrase });
    names.add(phrase);
    names.add(phrase.replace(/\s+/g, ""));
    if (!byId.has(id)) byId.set(id, phrase);
  };
  const table = rec(rawNames);
  if (table) {
    for (const [field, kind] of Object.entries(NAME_KINDS)) {
      const block = rec(table[field]);
      if (!block) continue;
      for (const [id, value] of Object.entries(block)) for (const phrase of aliases(value)) add(kind, id, phrase);
    }
  }
  // A power-user form: the lexicon's own row, exactly as src/voice/parser.ts spells it.
  if (Array.isArray(rawEntries)) {
    for (const row of rawEntries) {
      const e = rec(row);
      if (!e) continue;
      const kind = text(e.kind);
      const id = text(e.id);
      const phrase = text(e.phrase);
      if (kind && id && phrase && (Object.values(NAME_KINDS) as string[]).includes(kind)) add(kind as LexEntry["kind"], id, phrase);
    }
  }
  return { entries, names, byId };
}

/** `commands` (say + do) as pack phrases, tokenised the same way the recogniser's sentence is. */
function commandsOf(raw: unknown, names: ReadonlySet<string>, byId: ReadonlyMap<string, string>): VoicePhrase[] {
  const out: VoicePhrase[] = [];
  if (!Array.isArray(raw)) return out;
  for (const item of raw) {
    const c = rec(item);
    if (!c) continue;
    const intent = intentOf(c.do, byId);
    if (!intent) {
      console.warn("[voice] map voice: skipped a command whose `do` is not a command this game knows");
      continue;
    }
    const says = typeof c.say === "string" ? [c.say] : Array.isArray(c.say) ? c.say : [];
    for (const say of says) {
      const line = text(say);
      if (!line) continue;
      const ws = words(line, names);
      if (ws.length) out.push({ words: ws, say: line, intent });
    }
  }
  return out;
}

/**
 * One file as a MapVoice, or null when it is not one. The language block is chosen by the
 * player's own locale, so the same distributed file answers in Chinese to one player and in
 * English to the next.
 */
export function parseMapVoice(json: string): MapVoice | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json.replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
  const doc = rec(raw);
  if (!doc || typeof doc.format !== "number") return null;
  const languages = rec(doc.languages);
  let block: Record<string, unknown>;
  let locale: string;
  if (languages) {
    const picked = pickLanguage(languages, text(doc.default) ?? undefined);
    if (!picked) return null;
    const value = rec(languages[picked]);
    if (!value) return null;
    locale = picked;
    block = value;
  } else {
    // A one-language file: the document itself is the block.
    locale = text(doc.locale) ?? currentLocale();
    block = doc;
  }
  const { entries, names, byId } = namesOf(block.names, block.entries);
  const phrases = commandsOf(block.commands, names, byId);
  return { format: doc.format, locale, pack: { id: `map:${locale}`, entries, phrases } };
}

// --- reading the file beside a map ------------------------------------------------------------

const baseName = (path: string): string => path.split(/[\\/]/).pop() ?? path;

/** The two names a voice sidecar may have, beside the map that owns it. */
function candidates(mapPath: string): string[] {
  const cut = Math.max(mapPath.lastIndexOf("\\"), mapPath.lastIndexOf("/"));
  const dir = cut >= 0 ? mapPath.slice(0, cut + 1) : "";
  const file = cut >= 0 ? mapPath.slice(cut + 1) : mapPath;
  const base = file.replace(/\.w3[mx]$/i, "");
  return [`${dir}${file}.voice.json`, `${dir}${base}.voice.json`];
}

async function readVoiceAt(read: (path: string) => Promise<Uint8Array | null>, path: string): Promise<MapVoice | null> {
  let bytes: Uint8Array | null = null;
  try {
    bytes = await read(path);
  } catch {
    return null;
  }
  if (!bytes || !bytes.length) return null;
  const voice = parseMapVoice(new TextDecoder("utf-8").decode(bytes));
  if (!voice) {
    console.warn(`[voice] map voice file is not a valid voice pack: ${path}`);
    return null;
  }
  console.info(`[voice] map voice: ${path} (${voice.locale}, ${voice.pack.entries?.length ?? 0} name(s), ${voice.pack.phrases?.length ?? 0} command(s))`);
  return voice;
}

/** Load the voice pack beside a map. Null is the normal answer for a map that has none. */
export async function loadMapVoice(
  read: (path: string) => Promise<Uint8Array | null>,
  mapPath: string,
): Promise<MapVoice | null> {
  const tried: string[] = [];
  for (const path of candidates(mapPath)) {
    tried.push(path);
    const voice = await readVoiceAt(read, path);
    if (voice) return voice;
  }
  console.info(`[voice] no map voice file beside ${mapPath || "(no map path)"} — tried ${tried.join(", ")}`);
  return null;
}

/**
 * The same file found BY NAME, wherever the install spells its path — the mapLanguage.ts problem
 * (`Maps\hhkj` / `maps\hhkj`, or no path at all), answered the same way.
 */
export async function findMapVoiceByName(
  read: (path: string) => Promise<Uint8Array | null>,
  list: () => string[],
  mapName: string,
): Promise<MapVoice | null> {
  const name = baseName(mapName).toLowerCase();
  if (!name) return null;
  const base = name.replace(/\.w3[mx]$/i, "");
  const wanted = new Set([`${name}.voice.json`, `${base}.voice.json`]);
  let hit: string | undefined;
  try {
    hit = list().find((p) => wanted.has(baseName(p).toLowerCase()));
  } catch {
    return null;
  }
  if (!hit) return null;
  const voice = await readVoiceAt(read, hit);
  if (voice) console.info(`[voice] map voice found by name: ${hit}`);
  return voice;
}

// --- the pack for the current match ----------------------------------------------------------

let active: MapVoice | null = null;

/** Install (or clear) the current match's map voice. Cleared per match, so one map's words never
 *  answer for the next. */
export function setMapVoice(voice: MapVoice | null): void {
  active = voice;
}

/** The current match's map voice, for the console / diagnostics. */
export function mapVoice(): MapVoice | null {
  return active;
}

/** The pack voice/packs.ts appends after the match-kind and built-in map packs. */
export function mapVoicePack(): VoicePack | null {
  return active?.pack ?? null;
}
