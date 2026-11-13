// `war3mapSkin.txt` — a map's own layer over the game's interface: what a 1.31+ World Editor
// writes from its "Game Interface" dialog (docs/map-compatibility.md, Test of Balance). THREE
// sections, each laid over one of the install's tables:
//
//   [CustomSkin]  over UI\war3skins.txt — the SAME keys (`IdlePeon`, `SupplyIcon`,
//                 `InfoPanelIconArmorDivine`), for every race at once, above both the race's
//                 section and `[Default]`. Read by `skinValue` (data/war3skins.ts), which is the
//                 one lookup the FDF `DecorateFileNames` art, the console's own widgets and the
//                 music playlists all go through.
//   [FrameDef]    over the FrameDef STRING tables (GlobalStrings.fdf, InfoPanelStrings.fdf) —
//                 the same keys (`UPKEEP_NONE`, `COLON_FOOD`, `IDLE_PEON`), each value usually a
//                 `TRIGSTR_` into the map's war3map.wts. Read through `FdfLibrary.strings`
//                 (ui/fdf/library.ts), so every string the game's own frames and our HUD look up
//                 by key picks it up.
//   [Errors]      over the `[Errors]` block of Units\commandstrings.txt — the console's refusal
//                 lines (`Nolumber`, `Needemptytree`, `Alreadydoomed`). A custom map uses this to
//                 re-word an engine refusal for its own rules, so a key it names must win over
//                 the install's sentence, translated or not. Read by `CommandStrings.get`
//                 (data/commandStrings.ts), i.e. every error line the console flashes.
//
// Test of Balance uses it to turn the food counter into "Difficulty Level:", the upkeep label into
// Balanced / Average / Not Balanced, and the idle-worker button into "Traits (F8)" with a stat-up
// icon. Both DotA maps use [Errors] and [FrameDef].
//
// The layers belong to the MAP: `setMapSkinOverlay` puts them up at the map door and the scene
// that put them up takes them down, as `setMapMiscOverlay` does for war3mapMisc.txt.

import { mapErrorText, mapSkinText } from "../i18n/mapLanguage";

export const MAP_SKIN_FILE = "war3mapSkin.txt";

export interface MapSkin {
  /** [CustomSkin]: war3skins key → value (a texture path, usually). */
  skins: Map<string, string>;
  /** [FrameDef]: FrameDef string key → text, TRIGSTR_ already resolved. */
  strings: Map<string, string>;
  /** [Errors]: commandstrings.txt error key (LOWER CASE) → the map's own wording. */
  errors: Map<string, string>;
}

/** Parse the file. `resolve` turns a `TRIGSTR_nnn` into the map's own text (the same lookup a
 *  trigger's strings take); a value that is not one passes through. Keys are kept as written —
 *  both tables they override are looked up by exact key — except `[Errors]`, which is folded to
 *  lower case because that block's own casing is inconsistent and the engine matches it so.
 *  Unknown sections are ignored. */
export function parseMapSkin(src: string, resolve: (s: string) => string = (s) => s): MapSkin {
  const out: MapSkin = { skins: new Map(), strings: new Map(), errors: new Map() };
  let into: Map<string, string> | null = null;
  for (const raw of src.split(/\r?\n|\r/)) {
    const line = raw.trim();
    if (!line || line.startsWith("//")) continue;
    const head = /^\[(.+)\]$/.exec(line);
    if (head) {
      const name = head[1].trim().toLowerCase();
      into = name === "customskin" ? out.skins
        : name === "framedef" ? out.strings
        : name === "errors" ? out.errors
        : null;
      continue;
    }
    const eq = line.indexOf("=");
    if (!into || eq <= 0) continue;
    let value = line.slice(eq + 1).trim();
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    const key = line.slice(0, eq).trim();
    into.set(into === out.errors ? key.toLowerCase() : key, into === out.skins ? value : resolve(value));
  }
  return out;
}

let overlay: MapSkin | null = null;

/** Put a map's layer up (or `null` to take it down). */
export function setMapSkinOverlay(skin: MapSkin | null): void {
  overlay = skin && (skin.skins.size || skin.strings.size || skin.errors.size) ? skin : null;
}

/** The layer that is up now — so a scene can take down only the one IT put up. */
export function mapSkinOverlay(): MapSkin | null {
  return overlay;
}

/** The map's own value for a war3skins key, or undefined. */
export function mapSkinValue(key: string): string | undefined {
  return overlay?.skins.get(key);
}

/** The map's own text for a FrameDef string key, or undefined.
 *
 *  Passed through the map's dictionary on the way out, because a `[FrameDef]` value is a
 *  LITERAL the author typed — DotA writes `KEY_QUESTS=Map Info (|Cfffed312F9|R)` and
 *  `RESOURCES_COLUMN0=Gold`, not `TRIGSTR_…` — so the map's war3map.wts never carries them
 *  and Blizzard's own Chinese install cannot translate them either. They are the handful of
 *  words a player reads on the HUD that no other table owns: the top-left button bar's first
 *  button ("Map Info" beside 菜单 / 盟友 / 聊天), the gold and lumber tooltips, the stat-bonus
 *  lines. A `<map>.zhCN.json` sidecar translates them through its `skin` table. */
export function mapFrameString(key: string): string | undefined {
  const raw = overlay?.strings.get(key);
  return raw === undefined ? undefined : mapSkinText(key, raw);
}

/** The map's own wording for one of the engine's refusal lines (`Units\commandstrings.txt`
 *  [Errors] key), or undefined when it leaves that one alone.
 *
 *  This is the block a custom map uses to take an engine refusal over: DotA's three lines say
 *  "That tree already has eyes.", "You do not need a recipe for this item…" and "Cannot target
 *  this unit until after the item-silence effect is removed." under the stock keys
 *  `Needemptytree`, `Nolumber`, `Alreadydoomed` — so the install's own Chinese copy of those
 *  keys is not just untranslated, it says the WRONG thing ("木材不够。"). Read by
 *  `CommandStrings.get`, i.e. every refusal line the console flashes.
 *
 *  Lookup is case-insensitive: the keys are stored folded, and callers pass them either way. */
export function mapErrorString(key: string): string | undefined {
  const raw = overlay?.errors.get(key.toLowerCase());
  return raw === undefined ? undefined : mapErrorText(key, raw);
}

/**
 * A FrameDef string table with the map's layer on top. `FdfLibrary.strings` is one of these, so
 * the dozens of `strings.get(key)` call sites need no change: a key the running map rewrote reads
 * the map's text, and every other key (and every screen outside a match) reads the file's.
 */
export class OverlaidStrings extends Map<string, string> {
  override get(key: string): string | undefined {
    return mapFrameString(key) ?? super.get(key);
  }
  override has(key: string): boolean {
    return mapFrameString(key) !== undefined || super.has(key);
  }
}
