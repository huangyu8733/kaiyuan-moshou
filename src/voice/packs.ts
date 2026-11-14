// VOICE PACKS — the words that belong to ONE kind of map, or to ONE map, rather than to the game.
//
// The base grammar (parser.ts) is the COMMON pack: everything that is true of every Warcraft III
// map — select, move, attack, build, train, camera, chat, panels. On top of it:
//
//   · a KIND pack — "campaign" (a mission: objectives, cutscenes, saving) or "melee" (a game off
//     the skirmish list: scouting, expanding, army pushes);
//   · a MAP pack — keyed by the map's display name, so one custom map can teach Voice Control its
//     own words ("肉山", "神符", "兵线") without touching any other map.
//
// A pack adds NAMES, not code: every row is a `LexEntry` whose id already exists in the match's
// registries (or in the map's own defs), told a second way. So a map pack cannot run anything the
// base grammar could not — it only decides what a sentence MEANS, and a word no pack knows falls
// back to the base grammar unchanged.
//
// Precedence, low to high: base → kind → built-in map → the map's OWN file (`<map>.voice.json`,
// voice/mapVoice.ts). Whole-sentence phrases are checked from the most specific pack backwards,
// so a map's file may re-word even a built-in phrase; names from every pack are added to the
// lexicon, where a map's own spelling sits beside the game's.

import type { LexEntry, VoiceIntent } from "./parser";
import { mapVoicePack } from "./mapVoice";

/** What kind of map is being played. Decided once, when the match starts. */
export type VoiceMapKind = "campaign" | "melee" | "custom";

/**
 * One whole sentence this pack teaches, in the parser's own tokens — the same words `words()`
 * hands the grammar. It is DATA, not code: the intent it carries already exists in the match
 * (or is one of the console's own), so a pack can never make the game do something the grammar
 * could not. Matching is exact after filler words are dropped ("skip the cinematic" =
 * ["skip","cinematic"]).
 */
export interface VoicePhrase {
  words: readonly string[];
  intent: VoiceIntent;
  /** The phrase as the author spelled it, for the recogniser's prompt ("清野" may be a word the
   *  model has never been primed with). Optional: a built-in pack may omit it. */
  say?: string;
}

/** One pack's worth of extra ways to say things. */
export interface VoicePack {
  id: string;
  /** Extra spoken names. `id` must be a type the match already knows (a unit, a building, an
   *  ability…), or a def the map itself supplies (destructibles, map-placed units). */
  entries?: ReadonlyArray<LexEntry>;
  /** Whole sentences this pack understands, checked before the common grammar. */
  phrases?: ReadonlyArray<VoicePhrase>;
}

/** The common pack: the grammar itself. Listed (empty) so the order of the four layers is read
 *  in one place. */
export const BASE_PACK: VoicePack = { id: "base" };

/** 对战图：侦察、集火、推进、防守 — words for a skirmish map's own ideas. Each one is an
 *  order the common grammar already has, said the way a skirmish player says it. */
export const MELEE_PACK: VoicePack = {
  id: "melee",
  phrases: [
    { words: ["scout"], intent: { kind: "order", order: "move", target: { kind: "base", side: "enemy" } } },
    { words: ["focus", "fire"], intent: { kind: "order", order: "attack", target: { kind: "hero", side: "enemy" } } },
    { words: ["push"], intent: { kind: "order", order: "attackmove", target: { kind: "base", side: "enemy" } } },
    { words: ["defend"], intent: { kind: "order", order: "move", target: { kind: "base", side: "mine" } } },
  ],
};

/** 战役：任务、过场、对话 — words a mission needs and a skirmish never uses. The two orders
 *  behind them are the console's own: the ESC skip and the F9 quest log. */
export const CAMPAIGN_PACK: VoicePack = {
  id: "campaign",
  phrases: [
    { words: ["skip", "cinematic"], intent: { kind: "cinematic", skip: true } },
    { words: ["skip", "cutscene"], intent: { kind: "cinematic", skip: true } },
    { words: ["skip", "intro"], intent: { kind: "cinematic", skip: true } },
    { words: ["skip", "opening"], intent: { kind: "cinematic", skip: true } },
    { words: ["skip", "start"], intent: { kind: "cinematic", skip: true } },
    { words: ["skip", "prologue"], intent: { kind: "cinematic", skip: true } },
    // 只说“跳过”/“skip”：过场里其它命令本来就不收，这一句没有歧义。
    { words: ["skip"], intent: { kind: "cinematic", skip: true } },
    { words: ["objectives"], intent: { kind: "quest" } },
    { words: ["objective"], intent: { kind: "quest" } },
    // 任务列表 / 切换 / 进度。
    { words: ["quest", "list"], intent: { kind: "quest", mode: "list" } },
    { words: ["all", "quest"], intent: { kind: "quest", mode: "list" } },
    { words: ["next", "quest"], intent: { kind: "quest", mode: "next" } },
    { words: ["previous", "quest"], intent: { kind: "quest", mode: "previous" } },
    { words: ["quest", "progress"], intent: { kind: "quest", mode: "progress" } },
    { words: ["quest", "done"], intent: { kind: "quest", mode: "progress" } },
    { words: ["what", "left"], intent: { kind: "quest", mode: "progress" } },
    // 集合部队（“集合”本身是对建筑设集结点，不能抢）。
    { words: ["regroup"], intent: { kind: "regroup" } },
    // 选项：中文“第一个选项”落成 ["option","1"]，“选择第一个选项”还会多一个 select；
    // 英文 “first option” / “choose the first option” 同理。三种写法都收。
    { words: ["option", "1"], intent: { kind: "dialog", index: 0 } },
    { words: ["option", "2"], intent: { kind: "dialog", index: 1 } },
    { words: ["option", "3"], intent: { kind: "dialog", index: 2 } },
    { words: ["option", "4"], intent: { kind: "dialog", index: 3 } },
    { words: ["select", "option", "1"], intent: { kind: "dialog", index: 0 } },
    { words: ["select", "option", "2"], intent: { kind: "dialog", index: 1 } },
    { words: ["select", "option", "3"], intent: { kind: "dialog", index: 2 } },
    { words: ["select", "option", "4"], intent: { kind: "dialog", index: 3 } },
    { words: ["first", "option"], intent: { kind: "dialog", index: 0 } },
    { words: ["second", "option"], intent: { kind: "dialog", index: 1 } },
    { words: ["third", "option"], intent: { kind: "dialog", index: 2 } },
    { words: ["fourth", "option"], intent: { kind: "dialog", index: 3 } },
    { words: ["select", "first", "option"], intent: { kind: "dialog", index: 0 } },
    { words: ["select", "second", "option"], intent: { kind: "dialog", index: 1 } },
    { words: ["select", "third", "option"], intent: { kind: "dialog", index: 2 } },
    { words: ["select", "fourth", "option"], intent: { kind: "dialog", index: 3 } },
    { words: ["accept"], intent: { kind: "dialog" } },
    { words: ["decline"], intent: { kind: "dialog", choice: "decline" } },
    { words: ["leave"], intent: { kind: "dialog", choice: "decline" } },
    { words: ["continue"], intent: { kind: "dialog", choice: "continue" } },
  ],
};

/** The built-in DotA example. The SAME commands ship beside the map as
 *  `DotA v6.83d.w3x.voice.json` (voice/mapVoice.ts) — that file is the distributable copy a map
 *  author edits; this row is the fallback for an install that does not have it. */
const DOTA_PACK: VoicePack = {
  id: "map:dota",
  phrases: [
    // 打野：the camp-hunting attack-move the common grammar already performs for "creeps".
    { words: ["jungle"], intent: { kind: "order", order: "attackmove", target: { kind: "creeps" } } },
    // 清兵 / 推线：mid lane as a region — the same attack-move, aimed at the middle of the map.
    { words: ["clear", "creeps"], intent: { kind: "order", order: "attackmove", target: { kind: "region", region: { x: 0, y: 0 } } } },
    { words: ["push", "lane"], intent: { kind: "order", order: "attackmove", target: { kind: "region", region: { x: 0, y: 0 } } } },
    { words: ["focus", "fire"], intent: { kind: "order", order: "attack", target: { kind: "hero", side: "enemy" } } },
    { words: ["defend"], intent: { kind: "order", order: "move", target: { kind: "base", side: "mine" } } },
  ],
};

/** 每章一个包，按键是章节标题的 `mapKey()`。官方战役的章节地图在 MPQ 里，不能像自定义
 *  地图那样在旁边放 `<map>.voice.json`，所以这里内置一章的真实词表；自定义战役章节仍可用
 *  sidecar（`mapVoice.ts`），后者优先级更高。 */
const NIGHTELF_X01: VoicePack = {
  id: "chapter:nightelfx01",
  entries: [
    { kind: "unit", id: "chapter:maiev", phrase: "玛维" },
    { kind: "unit", id: "chapter:maiev", phrase: "maiev" },
    { kind: "unit", id: "chapter:naisha", phrase: "娜萨" },
    { kind: "unit", id: "chapter:naisha", phrase: "naisha" },
    { kind: "unit", id: "chapter:gate", phrase: "大门" },
    { kind: "unit", id: "chapter:gate", phrase: "精灵之门" },
    { kind: "unit", id: "chapter:gate", phrase: "gate" },
    { kind: "unit", id: "chapter:naga", phrase: "纳迦" },
    { kind: "unit", id: "chapter:naga", phrase: "naga" },
    { kind: "unit", id: "chapter:village", phrase: "渔村" },
    { kind: "unit", id: "chapter:village", phrase: "fishing village" },
  ],
  phrases: [
    // Open the chapter's first gate: an ATTACK on the destructible, which is what a right-click
    // on it does. The id is a chapter placeholder — resolution falls back to the DEF's name.
    { words: ["open", "gate"], intent: { kind: "order", order: "attack", target: { kind: "unit", entry: { kind: "unit", id: "chapter:gate", phrase: "gate" }, side: "enemy" } } },
    { words: ["open", "大门"], intent: { kind: "order", order: "attack", target: { kind: "unit", entry: { kind: "unit", id: "chapter:gate", phrase: "大门" }, side: "enemy" } } },
    { words: ["open", "精灵之门"], intent: { kind: "order", order: "attack", target: { kind: "unit", entry: { kind: "unit", id: "chapter:gate", phrase: "精灵之门" }, side: "enemy" } } },
  ],
};

const CHAPTER_PACKS: Readonly<Record<string, VoicePack>> = {
  "rise-of-the-naga": NIGHTELF_X01,
  "纳迦的崛起": NIGHTELF_X01,
};

/** A chapter's own words, when the match is a campaign chapter. */
export function chapterPack(mapName: string): VoicePack | undefined {
  return CHAPTER_PACKS[mapKey(mapName)];
}

/** 每张地图一个包，按地图显示名查。A key is `mapKey()` of the map's name, e.g.
 *  "dota-ai-v6-90g-pt-br-v4-1". The two DotA names below are the files this install ships:
 *  `DotA v6.83d.w3x` and `DotA AI v6.90G PT-BR v4.1.w3x`. */
export const MAP_PACKS: Readonly<Record<string, VoicePack>> = {
  "dota-v6-83d": DOTA_PACK,
  "dota-ai-v6-90g-pt-br-v4-1": DOTA_PACK,
};

/** A map's name as a key: no colour codes, no punctuation, lower case — the same map under two
 *  spellings ("DotA AI v6.90g" / "dota-ai-v6-90g") lands on one pack. */
export function mapKey(name: string): string {
  return name
    .replace(/\|[cC][0-9a-fA-F]{8}|\|[rR]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The packs in force for a match: the common one, its kind's, then its own map's — and last the
 *  map's OWN file (`<map>.voice.json`), which wins over anything built in. */
export function voicePacks(kind: VoiceMapKind, mapName = ""): VoicePack[] {
  const packs: VoicePack[] = [BASE_PACK];
  if (kind === "campaign") {
    packs.push(CAMPAIGN_PACK);
    // 章节包在战役包之后、地图包之前：一章自己的名字压过通用战役说法。
    const chapter = chapterPack(mapName);
    if (chapter) packs.push(chapter);
  } else if (kind === "melee") packs.push(MELEE_PACK);
  const own = MAP_PACKS[mapKey(mapName)];
  if (own) packs.push(own);
  const sidecar = mapVoicePack();
  if (sidecar) packs.push(sidecar);
  return packs;
}
