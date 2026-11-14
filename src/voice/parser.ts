// Voice Control's MAPPING: what the recogniser heard → the commands a player could have clicked.
//
// Deterministic, and deliberately so. The recogniser is told which words it may hear
// (src/voice/model.ts), so what arrives here is already a sentence in a closed vocabulary —
// "train three footmen", "storm bolt the enemy hero", "group two" — and turning a closed
// vocabulary into commands is a small grammar, not a model. A grammar is instant on the slowest
// machine, never invents an action the player did not say, and does the same thing every time;
// a language model would cost seconds per command on the PCs this has to run on.
//
// Kept pure (no DOM, no game): the NAMES it can match are handed in as a lexicon built from
// the game's own tables (src/voice/vocabulary.ts), and what comes out is a list of intents for
// the match to carry out through the very paths a click takes (render/mapViewer.ts). So the
// grammar can be pinned headlessly (tools/voice-parser-test.cjs).
//
// THE SENTENCE SHAPE is the one a player says out loud:
//
//     [verb] [count] [name] [preposition] [target]      "train 3 footmen", "attack the hero"
//     [name] [target]                                   "storm bolt that", "blizzard here"
//     … and … / … then …                                 several commands in one breath
//
// A sentence with no verb is a BUTTON's name — any button on the command card can be pressed
// by saying what it is called, which is what makes a map's custom abilities speakable without
// a line of code for them.

import { pinyin } from "pinyin-pro";
import { t, type MessageKey } from "../i18n";
import type { VoicePack } from "./packs";

/** One name the player may say, and what it names. */
export interface LexEntry {
  /** What it is, for the intent that names it. */
  kind: "unit" | "building" | "ability" | "upgrade" | "item" | "button" | "hero";
  /** The game id (a unit type, an ability code, an upgrade id, an item id) or, for "button", the
   *  card's command id (`ability:AHtb`, `train:hfoo`, `move`…). */
  id: string;
  /** The phrase as the game spells it ("Storm Bolt", "Footman"). */
  phrase: string;
  /** A MISHEARING matched on purpose ("borough" for Burrow) — read, but never put in the
   *  recogniser's prompt, which would teach it the wrong spelling. */
  misheard?: boolean;
}

export type Side = "mine" | "enemy" | "ally" | "any";

/** A part of the MAP a target is looked for in — "a gold mine on the right side of the map",
 *  "the top left". Each axis is -1 (left / bottom), +1 (right / top), 0 (the middle third) or
 *  null (either). */
export interface Region {
  x: -1 | 0 | 1 | null;
  y: -1 | 0 | 1 | null;
}

/** Which of several matches: the nearest (the default), or "another"/"next" — the nearest one
 *  that is NOT the one the camera is already on, so saying it again walks through them. */
export type Pick = "nearest" | "next";

/** Where an order goes. */
export type VoiceTarget =
  | { kind: "screen" } // "here", "there", "this", "that" — the middle of the screen
  | { kind: "cursor" } // "the cursor", "the mouse" — only when the player says so
  | { kind: "unit"; entry: LexEntry; side: Side; region?: Region; pick?: Pick } // "the enemy footman"
  | { kind: "hero"; side: Side; region?: Region; pick?: Pick } // "the hero", "my hero", "their hero"
  | { kind: "base"; side: Side; region?: Region; pick?: Pick } // "home", "my base", "the enemy base"
  | { kind: "mine"; region?: Region; pick?: Pick } // "the gold mine", "another gold mine"
  | { kind: "trees" } // "the trees", "the forest"
  | { kind: "army" } // "my army"
  /** "the creep camp", "another camp", "a green camp" — `tier` is the minimap's own colour for
   *  the camp's combined level (game/minimapView.ts: green 1–9, orange 10–19, red 20+). */
  | { kind: "creeps"; region?: Region; pick?: Pick; tier?: "green" | "orange" | "red" }
  /** THE ENEMY FORCE — "attack the enemy", when there are too many kinds and numbers to name one.
   *  Aimed at the thickest knot of enemies the selected troops can see. */
  | { kind: "enemies"; region?: Region }
  /** An ITEM LYING ON THE GROUND — "pick up the potion". Not selectable, so it is never a target
   *  of an ordinary order: the pick intent walks the hero to it instead. */
  | { kind: "grounditem"; entry?: LexEntry; pick?: Pick }
  | { kind: "region"; region: Region } // "the top left", "the middle of the map"
  /** "move up", "go north west", "move left a bit": a WALK in a direction from where the units
   *  stand (screen up is north — the camera never turns), `scale` times the usual distance. */
  | { kind: "step"; dx: number; dy: number; scale: number };

/**
 * WHO an order is for, when the player names them instead of selecting them: "ALL PEASANTS on
 * gold", "select ONE WORKER FROM WOOD", "send two footmen there". `worker` is the race's
 * gatherers whatever the player calls them (a human saying "peon" means his peasants);
 * `count` is a number or "all", and `counted` says whether the player said it — "select peasant"
 * (said nothing, one) means an IDLE one, "select one peasant" any one. `from` keeps only those
 * gathering that resource.
 */
export interface Subject {
  entry?: LexEntry;
  worker: boolean;
  count: number | "all";
  counted: boolean;
  idle: boolean;
  from?: "gold" | "lumber";
  /** The NUMBER on a unit's voice label ("select fiend 4" — the "Fiend 4" floated over it while
   *  Voice Control is on, game/voiceLabels.ts). */
  index?: number;
}

export type OrderVerb = "move" | "attack" | "attackmove" | "patrol" | "attackground" | "rally" | "smart";

export type VoiceIntent =
  /** "Fall back", "retreat", "go home": the whole army ("-") walks home, or to the place said. */
  | { kind: "retreat"; target?: VoiceTarget }
  /** `source` is a rally's building TYPE ("the rally point of the barracks"), set on every one of
   *  ours without touching the selection. */
  | { kind: "order"; order: OrderVerb; target?: VoiceTarget; subject?: Subject; source?: LexEntry; queued?: boolean }
  | { kind: "stop" }
  | { kind: "hold" }
  | { kind: "cancel" }
  /** 取消生产队列里点名的那一项；`all` = 全部/整条队列。 */
  | { kind: "cancelqueued"; entry?: LexEntry; all?: boolean }
  /** 打开命令卡的建造页 / 英雄技能页。 */
  | { kind: "cardpage"; page: "build" | "learn" }
  | { kind: "harvest"; res?: "gold" | "lumber"; target?: VoiceTarget; subject?: Subject }
  | { kind: "train"; entry: LexEntry; count: number }
  | { kind: "build"; entry: LexEntry; target?: VoiceTarget }
  /** "Finish the altar": put a worker back on a building of ours whose construction halted
   *  (its builder walked off). No `entry` = the nearest such building; `all` = every one. */
  | { kind: "finish"; entry?: LexEntry; all: boolean }
  | { kind: "research"; entry: LexEntry }
  | { kind: "learn"; entry: LexEntry }
  | { kind: "press"; entry: LexEntry; target?: VoiceTarget }
  | { kind: "autocast"; entry: LexEntry; on: boolean }
  | { kind: "useitem"; entry?: LexEntry; slot?: number; target?: VoiceTarget }
  /** 商店购买：按名字或物品格；都没有时交给执行层挑最近一家有货的商店。 */
  | { kind: "buy"; entry?: LexEntry; slot?: number }
  /** 出售携带的物品：按名字或物品格；都没有时卖第一件能卖的。 */
  | { kind: "sell"; entry?: LexEntry; slot?: number }
  /** 在祭坛/酒馆复活阵亡英雄；`entry` 为空 = 最近（等级最高）的一位。 */
  | { kind: "revive"; entry?: LexEntry }
  /** 装载：把选中的部队送进运输单位（右键运输单位同一条路）。 */
  | { kind: "board"; target?: VoiceTarget }
  /** 卸载：让选中的运输单位/掩体把载员放下。 */
  | { kind: "unload" }
  /** 修理：派工人修点名的/最近的受损己方建筑。 */
  | { kind: "repair"; entry?: LexEntry; target?: VoiceTarget }
  /** 自动修理开关（语音开启后由语音层定时派工）。 */
  | { kind: "autorepair"; on: boolean }
  /** 结盟/共享：`status` 只读回盟友与共享状态；vision/control 开关共享。 */
  | { kind: "diplomacy"; action: "vision" | "control" | "status"; on: boolean; target?: VoiceTarget }
  /** 地图信号：在说的地方（缺省屏幕中央）打一个标记。 */
  | { kind: "ping"; target?: VoiceTarget }
  /** 从控制组里移出单位：没点名 = 当前选中里属于该组的那几个。 */
  | { kind: "ungroupone"; entry?: LexEntry; n?: number }
  /** 子组（Tab）：在选中部队里按类型切换焦点；`next` 为循环方向。 */
  | { kind: "subgroup"; index?: number; next?: boolean }
  /** 按类型集火：优先打点名的敌人类型。 */
  | { kind: "focus"; entry?: LexEntry; target?: VoiceTarget }
  /** 物品栏换位：两个格子从 0 起。 */
  | { kind: "swap"; from: number; to: number }
  /** Pick up an item from the ground: the named one, or with no name the nearest one in sight.
   *  `all` keeps picking every visible item until the bag is full or the player says stop. */
  | { kind: "pick"; entry?: LexEntry; pick?: Pick; all?: boolean }
  /** Hand an item from one of ours to another hero: "give the salve to the hero". */
  | { kind: "give"; entry?: LexEntry; slot?: number; target: VoiceTarget }
  /** Drop a carried item beside its carrier: "drop the salve". */
  | { kind: "drop"; entry?: LexEntry; slot?: number }
  /** Walk the selected troops to the nearest healing fountain / moon well. */
  | { kind: "heal" }
  | { kind: "select"; what: "army" | "idle" | "hero" | "subject" | "screen"; subject?: Subject; index?: number }
  | { kind: "group"; n: number; mode: "recall" | "assign" | "add" | "clear" }
  /** 取消编组：把选中的单位从所有控制组里移出。 */
  | { kind: "ungroup" }
  | { kind: "camera"; target: VoiceTarget }
  /** The console's four panels — F9 Quests, F10 Menu, F11 Allies, F12 the chat/message log.
   *  `open` null = toggle. */
  | { kind: "panel"; panel: "quests" | "menu" | "allies" | "chat"; open: boolean | null }
  | { kind: "pause"; on: boolean }
  /** 跳过过场 — the same press ESC makes while the interface is hidden. */
  | { kind: "cinematic"; skip: true }
  /** 朗读任务：默认当前目标；list 全部、next/previous 切换、progress 还差什么。 */
  | { kind: "quest"; mode?: "brief" | "list" | "next" | "previous" | "progress" }
  /** 脚本对话框：按下第 index 个按钮（0 起）；没有 `index` = 第一个可用的非退出按钮。
   *  `choice` 是不数编号的说法：拒绝、继续、关闭。 */
  | { kind: "dialog"; index?: number; choice?: "decline" | "continue" | "close" }
  /** 集合部队到英雄身边（- 键选全部，再向英雄移动）。 */
  | { kind: "regroup" }
  /** A chat line, or with no text the chat input opened. `scope` null = the player's default. */
  | { kind: "chat"; text: string; scope: "all" | "allies" | null };

/** Number words → value. "a"/"an" count as one ("train a footman"). */
const NUMBERS: Record<string, number> = {
  zero: 0, one: 1, won: 1, two: 2, to: 2, too: 2, three: 3, four: 4, for: 4, five: 5, six: 6,
  seven: 7, eight: 8, ate: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, a: 1, an: 1,
};
/** The digit forms a recogniser may print instead. */
for (let i = 0; i <= 12; i++) NUMBERS[String(i)] = i;

/** Words that carry nothing in a command ("please train the footman"). "the" is dropped
 *  everywhere; "a"/"an" are numbers until a count has been read. */
const FILLER = new Set(["please", "the", "now", "go", "ahead", "and", "then", "um", "uh", "some", "of", "with", "your", "you"]);

/** The words that make a TARGET out of the rest of the sentence. "Here" is the middle of the
 *  SCREEN — what the player is looking at — and the mouse only when they say the mouse: a player
 *  playing by voice may not have a hand on it at all. */
const SCREEN_WORDS = new Set(["here", "there", "this", "that", "it", "him", "her", "them", "screen"]);
const CURSOR_WORDS = new Set(["cursor", "mouse", "pointer"]);
/** "another gold mine", "the next one". */
const NEXT_WORDS = new Set(["another", "next", "other", "different", "second"]);
const NEAREST_WORDS = new Set(["nearest", "closest", "near", "close"]);
/** Compass and side words → an axis of `Region`. */
const REGION_WORDS: Record<string, Partial<Region>> = {
  left: { x: -1 }, west: { x: -1 }, western: { x: -1 },
  right: { x: 1 }, east: { x: 1 }, eastern: { x: 1 },
  top: { y: 1 }, north: { y: 1 }, northern: { y: 1 }, upper: { y: 1 },
  bottom: { y: -1 }, south: { y: -1 }, southern: { y: -1 }, lower: { y: -1 },
  middle: { x: 0, y: 0 }, center: { x: 0, y: 0 }, centre: { x: 0, y: 0 },
};
/** A DIRECTION said right after the verb, with no "to the" before it ("move up", "go north"):
 *  a walk from where the units are, not a part of the map ("move to the north" is a region). */
const DIRECTION_WORDS: Record<string, [number, number]> = {
  up: [0, 1], upward: [0, 1], upwards: [0, 1], north: [0, 1], northward: [0, 1], northwards: [0, 1], forward: [0, 1], forwards: [0, 1],
  down: [0, -1], downward: [0, -1], downwards: [0, -1], south: [0, -1], southward: [0, -1], southwards: [0, -1],
  left: [-1, 0], leftward: [-1, 0], leftwards: [-1, 0], west: [-1, 0], westward: [-1, 0], westwards: [-1, 0],
  right: [1, 0], rightward: [1, 0], rightwards: [1, 0], east: [1, 0], eastward: [1, 0], eastwards: [1, 0],
  northeast: [1, 1], northwest: [-1, 1], southeast: [1, -1], southwest: [-1, -1],
};

/** A direction at `at` ("up", "north east", "up and to the left", "left a bit"), or null. */
export function readDirection(ws: readonly string[], at: number): { dx: number; dy: number; scale: number; end: number } | null {
  let i = at;
  const first = DIRECTION_WORDS[ws[i] ?? ""];
  if (!first) return null;
  let [dx, dy] = first;
  i++;
  // A second direction on the other axis: "north east", "up and left", "up and to the right".
  let j = i;
  while (ws[j] === "and" || ws[j] === "to" || ws[j] === "the") j++;
  const second = DIRECTION_WORDS[ws[j] ?? ""];
  if (second && (second[0] === 0) !== (dx === 0)) {
    dx += second[0];
    dy += second[1];
    i = j + 1;
  }
  // "a bit", "a little", "slightly" — half; "a lot", "far", "more" — double.
  let scale = 1;
  // 中文常把动词再说一遍（“向左移一点”“向左移动一点”）：跳过残留的“移/走/跑/动”
  // 和重复的 move，否则距离词会被挡住，半步变成一直走到地图边。
  let s = i;
  while (ws[s] === "move" || ws[s] === "移" || ws[s] === "走" || ws[s] === "跑" || ws[s] === "行" || ws[s] === "动") s++;
  const rest = ws.slice(s).join(" ");
  if (/^(a )?(bit|little|tad|touch)\b|^slightly\b/.test(rest)) scale = 0.5;
  else if (/^(a lot|far|much|more|further|way)\b/.test(rest)) scale = 2;
  return { dx, dy, scale, end: s };
}

const ENEMY_WORDS = new Set(["enemy", "enemies", "their", "hostile", "opponent", "opponents", "his"]);
const MINE_WORDS = new Set(["my", "our", "mine"]);
const ALLY_WORDS = new Set(["ally", "allied", "friendly"]);
const PREPOSITIONS = new Set(["on", "at", "to", "into", "onto", "toward", "towards", "near", "in"]);
/** The race's gatherers, by any race's word for them: a human who says "peon" means his
 *  peasants. (The undead's Ghoul gathers too, but is a soldier first and is named as one.) */
const WORKER_WORDS = new Set(["worker", "workers", "peasant", "peasants", "peon", "peons", "acolyte", "acolytes",
  "wisp", "wisps", "harvester", "harvesters", "gatherer", "gatherers", "builder", "builders", "slave", "slaves"]);
const ALL_WORDS = new Set(["all", "every", "each", "everyone", "everybody"]);
/** Words between a subject and the resource it is working ("one worker FROM wood", "peasants
 *  THAT ARE MINING gold"). */
const FROM_WORDS = new Set(["from", "on", "at", "in", "that", "are", "is", "who", "which", "currently",
  "gathering", "mining", "chopping", "harvesting", "working", "cutting", "collecting"]);
const GOLD_WORDS = new Set(["gold", "mine", "mines"]);
const LUMBER_WORDS = new Set(["wood", "lumber", "tree", "trees", "forest"]);
/** A count must not swallow a preposition the recogniser spelled as a number ("send TO gold"). */
const NOT_COUNTS = new Set(["to", "too", "for", "won", "ate"]);

/** Verb synonyms. The left word is what the player says; the right is what it means. Two-word
 *  verbs are matched first ("attack move" before "attack"). */
const VERBS2: Array<[string, string]> = [
  ["attack move", "attackmove"], ["a move", "attackmove"], ["attack ground", "attackground"],
  ["hold position", "hold"], ["set rally", "rally"], ["rally point", "rally"], ["control group", "group"],
  ["make group", "assign"], ["set group", "assign"], ["assign group", "assign"], ["bind group", "assign"],
  ["add to", "add"], ["turn on", "auto-on"], ["turn off", "auto-off"], ["never mind", "cancel"],
  ["look at", "camera"], ["go to", "move"], ["chop wood", "lumber"], ["cut wood", "lumber"],
  ["get gold", "gold"], ["get lumber", "lumber"], ["get wood", "lumber"], ["idle worker", "idle"],
  ["select army", "army"], ["rally point", "rally"],
  ["fall back", "retreat"], ["pull back", "retreat"], ["go home", "retreat"], ["run home", "retreat"],
  ["back off", "retreat"], ["head home", "retreat"], ["come home", "retreat"], ["get out", "retreat"],
  ["go back", "retreat"], ["get back", "retreat"], ["move back", "retreat"], ["run back", "retreat"],
  ["head back", "retreat"], ["come back", "retreat"], ["pull out", "retreat"], ["run away", "retreat"],
  ["back up", "retreat"], ["fall out", "retreat"],
  ["town portal", "teleport"], ["port out", "teleport"], ["port home", "teleport"], ["port back", "teleport"],
  ["go collect", "harvest"], ["go gather", "harvest"], ["go harvest", "harvest"], ["go mine", "harvest"],
  // Ground items. Two words first, because "pick" and "grab" alone already mean SELECT.
  ["pick up", "pickitem"], ["pickup", "pickitem"], ["pick item", "pickitem"], ["grab item", "pickitem"],
  ["grab that", "pickitem"], ["grab it", "pickitem"], ["grab this", "pickitem"], ["grab the", "pickitem"],
  ["take item", "pickitem"], ["take that", "pickitem"], ["take it", "pickitem"], ["take this", "pickitem"], ["take the", "pickitem"],
  ["get item", "pickitem"], ["get the", "pickitem"], ["collect item", "pickitem"], ["loot item", "pickitem"],
  // 战役互动：和某人说话 = 跟着/走到那个人身边，由地图自己的触发器弹对话。
  ["talk to", "talkto"], ["speak to", "talkto"],
  ["loot everything", "lootall"], ["loot all", "lootall"], ["pick up all", "pickitem"],
  ["go heal", "heal"], ["heal up", "heal"],
  // 语音自动修理：“auto repair”, “auto repair off”.
  ["auto repair", "auto-repair"], ["auto-repair", "auto-repair"],
  // 联盟共享。
  ["share vision", "sharevision"], ["share control", "sharecontrol"], ["share units", "sharecontrol"],
  ["ally status", "diplomacy"], ["alliance status", "diplomacy"],
  ["remove from group", "ungroupone"], ["take out of group", "ungroupone"],
  ["next subgroup", "subgroupnext"], ["previous subgroup", "subgroupprev"], ["next sub group", "subgroupnext"],
  ["focus fire", "focus"], ["next idle", "selectidle"], ["next worker", "selectidle"], ["next idle worker", "selectidle"],
  ["rally army", "regroup"], ["gather army", "regroup"], ["regroup army", "regroup"],
  ["build menu", "buildmenu"], ["open build", "buildmenu"], ["skill menu", "learnmenu"], ["learn menu", "learnmenu"],
  ["clear queue", "cancelall"], ["cancel all", "cancelall"],
];
const VERBS1: Record<string, string> = {
  move: "move", walk: "move", run: "move", retreat: "retreat", withdraw: "retreat", come: "move",
  attack: "attack", hit: "attack", kill: "attack", fight: "attack", charge: "attack",
  amove: "attackmove", patrol: "patrol", rally: "rally", follow: "follow", escort: "follow", accompany: "follow",
  head: "move", march: "move", step: "move",
  // "put all peasants on gold", "send two footmen there", "put the rally point of the barracks
  // on my hero", "put a farm here": one verb whose meaning is read off the rest of the clause.
  put: "put", send: "put", set: "put", assign: "put", order: "put", tell: "put", have: "put",
  stop: "stop", halt: "stop", hold: "hold", cancel: "cancel", escape: "cancel", back: "cancel",
  gather: "harvest", harvest: "harvest", mine: "harvest", collect: "harvest", chop: "lumber",
  gathering: "harvest", harvesting: "harvest", collecting: "harvest", mining: "harvest",
  // The Scroll of Town Portal is "tp" to everyone who has played: "tp out", "teleport home".
  teleport: "teleport", tp: "teleport", tpe: "teleport", portal: "teleport",
  train: "train", make: "train", recruit: "train", hire: "train", produce: "train", summon: "train", create: "train",
  build: "build", construct: "build", place: "build",
  research: "research", upgrade: "research", improve: "research",
  finish: "finish", complete: "finish", resume: "finish", continue: "finish",
  learn: "learn", skill: "learn",
  cast: "press", use: "press", press: "press", click: "press", activate: "press", do: "press",
  autocast: "autocast",
  select: "select", choose: "select", pick: "select", grab: "select",
  pickup: "pickitem", loot: "lootall",
  find: "camera", locate: "camera",
  protect: "follow", regroup: "regroup",
  give: "giveitem", heal: "heal",
  // 商店买卖：“buy a healing salve”, “sell the potion”.
  buy: "buy", purchase: "buy",
  sell: "sell", vend: "sell",
  revive: "revive", resurrect: "revive", raise: "revive",
  // 运输：装载 / 卸载。
  board: "board", load: "board", embark: "board",
  unload: "unload", disembark: "unload",
  // 修理。
  repair: "repair", fix: "repair", mend: "repair",
  // 中文表把“自动修理”拆成整词，这里接住它。
  "auto-repair": "auto-repair",
  // 共享视野 / 共享控制，以及只读的盟友状态。
  sharevision: "sharevision", sharecontrol: "sharecontrol", diplomacy: "diplomacy",
  // 地图信号 / 移出编队。
  ping: "ping", mark: "ping", signal: "ping", remove: "ungroupone", ungroupone: "ungroupone",
  cancelall: "cancelall",
  // 子组 / 集火 / 物品换位。
  "subgroupnext": "subgroupnext", "subgroupprev": "subgroupprev", subgroup: "subgroup",
  selectnext: "selectidle", selectidle: "selectidle", focus: "focus", swap: "swap", exchange: "swap",
  // 命令卡页面。
  buildmenu: "buildmenu", learnmenu: "learnmenu",
  drop: "drop", discard: "drop", toss: "drop",
  ungroup: "ungroup",
  // The Chinese table emits these as whole tokens (“开启自动施放”/“关闭自动施放”).
  "auto-on": "auto-on", "auto-off": "auto-off",
  group: "group", camera: "camera", view: "camera", show: "camera", jump: "camera", pan: "camera", scroll: "camera",
  everyone: "army", everybody: "army", army: "army", idle: "idle",
};

/** What the recogniser writes for a word it has rarely heard spoken, put back before anything
 *  reads it — matched on the CLEANED text (lower case, no punctuation, single spaces), so
 *  "T.P." arrives as "t p". "Acolyte" is the standing case: Whisper hears "a collide",
 *  "accolade", "acolite"; "tp" comes out "teepee"; "Priestess of the Moon" "priest is of the
 *  moon". */
const MISHEARD: Array<[RegExp, string]> = [
  [/\b(a collides|accolades|acolites|a colites|a collites|acolights)\b/g, "acolytes"],
  [/\b(a collide|accolade|acolite|a colite|a collite|acolight|a coli?ght|ecolite|acolyt)\b/g, "acolyte"],
  [/\b(t p|tee pee|teepee|tepee|tea pee|tipi|t pee|tee p)\b/g, "tp"],
  [/\bfallback\b/g, "fall back"],
  [/\b(priest is|priestess is|priests of|priest of|pristess|priestesses) (of )?(the )?moon\b/g, "priestess of the moon"],
  [/\bpriestess of (the )?(moon|mood|mon|moan|mun)\b/g, "priestess of the moon"],
];

/** A Chinese character — what makes an utterance take the Chinese path. */
const CJK = /[\u3400-\u9fff]/;
/** Anything that is not plain ASCII (a Chinese name, above all). Such a key is matched EXACTLY:
 *  editing a word by one letter is a near miss, editing a Chinese name by one character is a
 *  different name. */
const NON_ASCII = /[^\x00-\x7F]/;

/**
 * Chinese → the English tokens this grammar is written in.
 *
 * THE GRAMMAR DOES NOT CHANGE, only the words arriving at it: both languages are SVO for the
 * sentences a player says ("train three footmen" / "训练三个步兵"), so a table of what each
 * Chinese word MEANS turns one sentence into the other before any clause is read. That is also
 * why the unit and building names stay Chinese: they are names, matched against the lexicon the
 * map handed in, and only the words AROUND them are translated.
 *
 * Longer phrases win over shorter ones ("攻击移动" before "攻击", "取消勾选" before "取消"), and
 * an entry here must never be a unit or building's name — a name is matched whole, as itself.
 */
const ZH: Array<[string, readonly string[]]> = [
  // Joins and the words that carry nothing.
  ["然后", ["then"]], ["接着", ["then"]], ["再", ["then"]], ["和", ["and"]],
  ["麻烦", ["please"]], ["帮我", ["please"]], ["请", ["please"]],
  ["一下", ["now"]], ["的", ["the"]], ["了", ["the"]], ["把", ["the"]], ["将", ["the"]],
  ["到", ["to"]], ["在", ["at"]], ["从", ["from"]],
  // Dropped outright: a measure word and the "de" of "打得好" carry nothing the grammar uses.
  ["个", []], ["只", []], ["得", []],
  // Numbers. A control group can be said either way round: "编队二", "第二队".
  ["第一队", ["group", "1"]], ["第二队", ["group", "2"]], ["第三队", ["group", "3"]], ["第四队", ["group", "4"]],
  ["第五队", ["group", "5"]], ["第六队", ["group", "6"]], ["第七队", ["group", "7"]], ["第八队", ["group", "8"]],
  ["第十一", ["11"]], ["第十二", ["12"]], ["第十", ["10"]],
  ["第一", ["1"]], ["第二", ["2"]], ["第三", ["3"]], ["第四", ["4"]],
  ["第五", ["5"]], ["第六", ["6"]], ["第七", ["7"]], ["第八", ["8"]], ["第九", ["9"]],
  ["十一", ["11"]], ["十二", ["12"]], ["十", ["10"]],
  ["零", ["0"]], ["一", ["1"]], ["二", ["2"]], ["两", ["2"]], ["三", ["3"]], ["四", ["4"]],
  ["五", ["5"]], ["六", ["6"]], ["七", ["7"]], ["八", ["8"]], ["九", ["9"]],
  // Verbs.
  ["攻击移动", ["attack", "move"]], ["攻击并移动", ["attack", "move"]], ["攻击地面", ["attack", "ground"]],
  ["训练", ["train"]], ["生产", ["train"]], ["制造", ["train"]], ["招募", ["train"]], ["雇佣", ["train"]],
  ["建造", ["build"]], ["修建", ["build"]], ["盖", ["build"]], ["放置", ["build"]],
  ["移动", ["move"]], ["走到", ["move"]], ["走向", ["move"]], ["前往", ["move"]], ["去", ["move"]], ["跑", ["move"]],
  // Direction first, as Chinese says it ("向上移动"), ahead of the verb the grammar wants.
  ["向东北", ["move", "northeast"]], ["向西北", ["move", "northwest"]], ["向东南", ["move", "southeast"]], ["向西南", ["move", "southwest"]],
  ["往东北", ["move", "northeast"]], ["往西北", ["move", "northwest"]], ["往东南", ["move", "southeast"]], ["往西南", ["move", "southwest"]],
  ["朝东北", ["move", "northeast"]], ["朝西北", ["move", "northwest"]], ["朝东南", ["move", "southeast"]], ["朝西南", ["move", "southwest"]],
  // 口语的斜方向（“向右上”），和“东北”是同一组八方向。
  ["向右上", ["move", "northeast"]], ["向左上", ["move", "northwest"]], ["向右下", ["move", "southeast"]], ["向左下", ["move", "southwest"]],
  ["往右上", ["move", "northeast"]], ["往左上", ["move", "northwest"]], ["往右下", ["move", "southeast"]], ["往左下", ["move", "southwest"]],
  ["朝右上", ["move", "northeast"]], ["朝左上", ["move", "northwest"]], ["朝右下", ["move", "southeast"]], ["朝左下", ["move", "southwest"]],
  ["向前右", ["move", "northeast"]], ["向前左", ["move", "northwest"]], ["向后右", ["move", "southeast"]], ["向后左", ["move", "southwest"]],
  ["向上", ["move", "up"]], ["向下", ["move", "down"]], ["向左", ["move", "left"]], ["向右", ["move", "right"]],
  ["往上", ["move", "up"]], ["往下", ["move", "down"]], ["往左", ["move", "left"]], ["往右", ["move", "right"]],
  ["朝上", ["move", "up"]], ["朝下", ["move", "down"]], ["朝左", ["move", "left"]], ["朝右", ["move","right"]],
  ["向前", ["move", "up"]], ["向后", ["move", "down"]], ["前进", ["move", "up"]],
  ["往前", ["move", "up"]], ["往后", ["move", "down"]],
  ["上移", ["move", "up"]], ["下移", ["move", "down"]], ["左移", ["move", "left"]], ["右移", ["move", "right"]],
  // 走多远：一点 / 稍微 = 半步，远一点 / 大步 = 一步半（readDirection 的 scale）。
  ["一点", ["a", "bit"]], ["一点儿", ["a", "bit"]], ["稍微", ["slightly"]], ["轻一点", ["a", "bit"]],
  ["远一点", ["far"]], ["远", ["far"]], ["大步", ["far"]], ["走远点", ["far"]],
  ["全体进攻", ["attack", "move"]], ["全体攻击", ["attack", "move"]], ["全部进攻", ["attack", "move"]],
  ["全军进攻", ["attack", "move"]], ["全军出击", ["attack", "move"]], ["全军攻击", ["attack", "move"]],
  ["退后", ["retreat"]],
  ["攻击", ["attack"]], ["打", ["attack"]], ["进攻", ["attack"]], ["冲锋", ["attack"]],
  ["巡逻", ["patrol"]], ["跟随", ["follow"]], ["跟着", ["follow"]], ["跟", ["follow"]],
  ["停止", ["stop"]], ["站住", ["stop"]], ["保持", ["hold"]], ["原地", ["hold"]],
  ["取消勾选", ["uncheck"]], ["取消", ["cancel"]], ["算了", ["cancel"]], ["返回", ["back"]],
  ["撤退", ["retreat"]], ["后退", ["retreat"]], ["撤", ["retreat"]], ["回家", ["retreat"]],
  ["回城", ["teleport"]], ["传送", ["teleport"]],
  // 地上的物品：拾取 / 捡起来。长词在前，避免“捡”先吃掉“捡起来”。
  ["捡起来", ["pick", "up"]], ["捡起", ["pick", "up"]], ["捡", ["pick", "up"]],
  ["拾取", ["pick", "up"]], ["拾起", ["pick", "up"]], ["拿起来", ["pick", "up"]],
  ["拿起", ["pick", "up"]], ["拿走", ["pick", "up"]], ["获取", ["pick", "up"]],
  ["捡物品", ["pick", "up", "item"]], ["捡道具", ["pick", "up", "item"]],
  ["研究", ["research"]], ["升级", ["research"]], ["学习", ["learn"]], ["学", ["learn"]],
  ["自动施放", ["autocast"]], ["自动释放", ["autocast"]], ["开启", ["check"]], ["启用", ["check"]], ["禁用", ["uncheck"]],
  ["勾选", ["check"]], ["悬停", ["hover"]], ["指向", ["point"]], ["指到", ["point"]],
  ["施放", ["press"]], ["释放", ["press"]], ["使用", ["press"]], ["用", ["press"]],
  ["点击", ["click"]], ["点开", ["click"]], ["点", ["click"]], ["按", ["press"]], ["进入", ["click"]],
  ["选择", ["select"]], ["选中", ["select"]], ["选取", ["select"]], ["全选", ["select", "army"]], ["全军", ["select", "army"]],
  ["编队", ["group"]], ["编为", ["assign"]], ["加入", ["add"]], ["队", ["group"]],
  ["视角", ["camera"]], ["镜头", ["camera"]], ["视野", ["camera"]], ["查看", ["view"]], ["看", ["camera"]],
  ["采集", ["harvest"]], ["采金", ["harvest", "gold"]], ["采矿", ["harvest", "gold"]],
  ["采木", ["harvest", "lumber"]], ["砍树", ["lumber"]], ["伐木", ["lumber"]],
  ["说", ["say"]], ["告诉", ["tell"]], ["喊", ["say"]], ["打字", ["type"]], ["输入", ["type"]], ["发消息", ["send", "message"]],
  ["打开", ["open"]], ["关闭", ["close"]], ["关掉", ["close"]], ["退出", ["exit"]], ["暂停", ["pause"]],
  // 暂停后怎么说“继续”：单独一个“继续”在战役里是对话选项，不能抢。
  ["继续游戏", ["resume", "game"]], ["恢复游戏", ["resume", "game"]], ["继续对局", ["resume", "game"]],
  ["恢复对局", ["resume", "game"]], ["取消暂停", ["unpause"]], ["解除暂停", ["unpause"]], ["结束暂停", ["unpause"]],
  ["设置", ["set"]], ["调整", ["set"]], ["改成", ["set"]], ["换成", ["set"]], ["变为", ["set"]], ["变成", ["set"]],
  ["完成", ["finish"]], ["继续建造", ["finish"]], ["集合点", ["rally"]], ["集结点", ["rally"]],
  ["设集结点", ["rally"]], ["设置集结点", ["rally"]], ["集合", ["regroup"]],
  // 战役、对战与自定义地图的说法（voice/packs.ts 的短语靠这些词进入基础文法）。
  ["跳过过场", ["skip", "cinematic"]], ["跳过动画", ["skip", "cutscene"]], ["跳过剧情", ["skip", "intro"]],
  ["跳过", ["skip"]], ["略过", ["skip"]], ["快进", ["skip"]],
  ["过场动画", ["cinematic"]], ["过场", ["cinematic"]], ["动画", ["cinematic"]], ["剧情", ["cinematic"]], ["影片", ["cinematic"]],
  // 开场/片头/开始场景等说法（玩家不一定说“过场”）。
  ["开场动画", ["cinematic"]], ["开始动画", ["cinematic"]], ["开始场景", ["cinematic"]],
  ["开场", ["cinematic"]], ["片头", ["cinematic"]], ["序幕", ["cinematic"]], ["开头", ["cinematic"]],
  ["跳过开始", ["skip", "cinematic"]], ["跳过开始场景", ["skip", "cinematic"]], ["跳过开始动画", ["skip", "cinematic"]],
  ["跳开场", ["skip", "cinematic"]], ["跳片头", ["skip", "cinematic"]],
  ["任务目标", ["objective"]], ["当前任务", ["objective"]], ["现在要做什么", ["objective"]],
  ["要做什么", ["objective"]], ["该做什么", ["objective"]], ["下一步", ["objective"]],
  ["第一个选项", ["option", "1"]], ["第二个选项", ["option", "2"]], ["第三个选项", ["option", "3"]],
  ["第四个选项", ["option", "4"]],
  ["选项一", ["option", "1"]], ["选项二", ["option", "2"]], ["选项三", ["option", "3"]], ["选项四", ["option", "4"]],
  ["拒绝", ["decline"]], ["离开", ["leave"]], ["继续", ["continue"]],
  ["还有哪些任务", ["quest", "list"]], ["任务列表", ["quest", "list"]], ["所有任务", ["all", "quest"]], ["全部任务", ["all", "quest"]],
  ["下一个任务", ["next", "quest"]], ["下个任务", ["next", "quest"]],
  ["上一个任务", ["previous", "quest"]], ["上个任务", ["previous", "quest"]],
  ["任务完成了吗", ["quest", "done"]], ["任务进度", ["quest", "progress"]], ["还差什么", ["what", "left"]],
  ["集合部队", ["regroup"]], ["部队集合", ["regroup"]], ["集结部队", ["regroup"]], ["归队", ["regroup"]],
  ["向英雄靠拢", ["regroup"]], ["靠拢英雄", ["regroup"]], ["集合到英雄", ["regroup"]],
  ["到英雄那里", ["regroup"]], ["来英雄这里", ["regroup"]], ["全军靠拢", ["regroup"]],
  ["找到", ["find"]], ["寻找", ["find"]], ["查找", ["find"]],
  ["和", ["talk", "to"]], ["与", ["talk", "to"]], ["说话", ["speak"]], ["交谈", ["talk"]],
  ["护送", ["escort"]], ["保护", ["protect"]],
  ["把", ["give"]], ["给", ["to"]],
  ["去治疗", ["heal"]], ["治疗", ["heal"]], ["回血", ["heal"]], ["回泉水", ["heal"]], ["喝井水", ["heal"]],
  ["丢弃", ["drop"]], ["扔掉", ["drop"]], ["丢下", ["drop"]],
  // 商店买卖：“买治疗药水”“卖物品一”。
  ["购买", ["buy"]], ["买入", ["buy"]], ["买", ["buy"]],
  ["出售", ["sell"]], ["卖掉", ["sell"]], ["卖出", ["sell"]], ["卖", ["sell"]],
  // 英雄复活。
  ["复活英雄", ["revive"]], ["召回英雄", ["revive"]], ["复活", ["revive"]], ["重生", ["revive"]],
  // 运输装载 / 卸载。
  ["装载", ["board"]], ["上船", ["board"]], ["登船", ["board"]], ["进入运输", ["board"]],
  ["卸载", ["unload"]], ["下船", ["unload"]], ["卸下", ["unload"]], ["放下载员", ["unload"]],
  // 修理 / 自动修理。
  ["开启自动修理", ["auto-repair", "on"]], ["打开自动修理", ["auto-repair", "on"]],
  ["关闭自动修理", ["auto-repair", "off"]], ["停止自动修理", ["auto-repair", "off"]],
  ["自动修理", ["auto-repair"]], ["修理", ["repair"]], ["维修", ["repair"]], ["修复", ["repair"]],
  // 联盟共享。
  ["共享视野", ["sharevision"]], ["取消共享视野", ["sharevision", "off"]], ["关闭共享视野", ["sharevision", "off"]],
  ["共享控制", ["sharecontrol"]], ["共享单位", ["sharecontrol"]], ["取消共享控制", ["sharecontrol", "off"]], ["关闭共享控制", ["sharecontrol", "off"]],
  ["结盟", ["diplomacy"]], ["同盟", ["diplomacy"]], ["盟友状态", ["diplomacy"]],
  // 地图信号 / 移出编队 / 排队（Shift 命令队列）。
  ["信号", ["ping"]], ["标记这里", ["ping", "here"]], ["在这里标记", ["ping", "here"]],
  ["移出编队", ["ungroupone"]], ["移出队伍", ["ungroupone"]], ["移出", ["ungroupone"]],
  ["排队", ["queued"]], ["命令排队", ["queued"]],
  // 子组 / 集火 / 物品换位。
  ["下一组", ["subgroupnext"]], ["上一个子组", ["subgroupprev"]], ["子组", ["subgroup"]],
  ["下一个空闲农民", ["selectidle"]], ["下一个农民", ["selectidle"]], ["找个空闲农民", ["selectidle"]],
  ["集火", ["focus", "fire"]], ["集中火力", ["focus"]], ["先打", ["focus"]], ["优先攻击", ["focus"]],
  ["交换", ["swap"]], ["换位", ["swap"]], ["换到", ["swap"]],
  // 命令卡页面。
  ["建造菜单", ["buildmenu"]], ["打开建造菜单", ["buildmenu"]], ["技能菜单", ["learnmenu"]], ["技能页", ["learnmenu"]],
  ["清空队列", ["cancelall"]], ["取消所有训练", ["cancelall"]], ["取消全部训练", ["cancelall"]], ["取消所有生产", ["cancelall"]],
  ["取消编组", ["ungroup"]], ["解除编组", ["ungroup"]], ["清除编组", ["ungroup"]], ["取消所有编队", ["ungroup"]],
  ["开启自动施放", ["auto-on"]], ["关闭自动施放", ["auto-off"]],
  ["開啟自動施放", ["auto-on"]], ["關閉自動施放", ["auto-off"]], ["取消編組", ["ungroup"]], ["解除編組", ["ungroup"]],
  ["搜刮", ["loot"]], ["捡起所有物品", ["pick", "up", "all", "items"]],
  ["接受", ["accept"]], ["同意", ["accept"]],
  ["侦察", ["scout"]], ["集火", ["focus", "fire"]], ["推进", ["push"]], ["回防", ["defend"]], ["防守", ["defend"]],
  ["打野", ["jungle"]], ["清兵", ["clear", "creeps"]], ["推线", ["push", "lane"]], ["守家", ["defend"]],
  // Quantities.
  ["所有", ["all"]], ["全部", ["all"]], ["全体", ["all"]], ["每个", ["all"]], ["各个", ["all"]],
  ["所有人", ["everyone"]], ["大家", ["everyone"]], ["对", ["to"]], ["给", ["to"]],
  ["空闲", ["idle"]], ["闲置", ["idle"]], ["最近", ["nearest"]], ["附近", ["near"]],
  ["另一个", ["next"]], ["下一个", ["next"]], ["其他", ["other"]],
  // What a command is pointed at.
  ["英雄", ["hero"]], ["主基地", ["base"]], ["基地", ["base"]], ["老家", ["base"]], ["主城", ["base"]],
  ["金矿", ["gold", "mine"]], ["金币", ["gold"]], ["金子", ["gold"]], ["金", ["gold"]],
  ["木材", ["lumber"]], ["木头", ["lumber"]], ["树木", ["tree"]], ["树", ["tree"]], ["森林", ["forest"]],
  ["野怪", ["creeps"]], ["怪物", ["creeps"]], ["营地", ["camp"]], ["中立", ["neutral"]],
  ["部队", ["army"]], ["军队", ["army"]], ["物品", ["item"]], ["道具", ["item"]], ["格子", ["slot"]], ["槽", ["slot"]],
  ["屏幕", ["screen"]], ["这里", ["here"]], ["这儿", ["here"]], ["那里", ["there"]], ["那儿", ["there"]],
  ["中间", ["middle"]], ["中央", ["center"]],
  ["鼠标", ["cursor"]], ["光标", ["cursor"]], ["指针", ["cursor"]],
  ["敌人", ["enemy"]], ["敌方", ["enemy"]], ["对方", ["enemy"]], ["对手", ["enemy"]],
  ["我的", ["my"]], ["我们", ["our"]], ["我方", ["my"]], ["盟友", ["ally"]], ["友军", ["ally"]],
  ["左边", ["left"]], ["左侧", ["left"]], ["右边", ["right"]], ["右侧", ["right"]],
  ["上面", ["top"]], ["上方", ["top"]], ["下面", ["bottom"]], ["下方", ["bottom"]],
  ["西边", ["west"]], ["东边", ["east"]], ["北边", ["north"]], ["南边", ["south"]],
  ["左上", ["northwest"]], ["右上", ["northeast"]], ["左下", ["southwest"]], ["右下", ["southeast"]],
  ["东北", ["northeast"]], ["西北", ["northwest"]], ["东南", ["southeast"]], ["西南", ["southwest"]],
  ["上", ["up"]], ["下", ["down"]], ["左", ["left"]], ["右", ["right"]], ["前", ["up"]], ["后", ["down"]],
  ["绿色", ["green"]], ["橙色", ["orange"]], ["黄色", ["yellow"]], ["红色", ["red"]],
  // The console's panels, and the menus' own words.
  ["任务", ["quests"]], ["菜单", ["menu"]], ["盟友列表", ["allies"]], ["聊天记录", ["chat"]], ["消息记录", ["chat"]], ["聊天", ["chat"]],
  ["种族", ["race"]], ["玩家", ["player"]], ["队伍", ["team"]], ["颜色", ["color"]], ["地图", ["map"]],
  ["人类", ["human"]], ["兽族", ["orc"]], ["亡灵", ["undead"]], ["不死族", ["undead"]],
  ["暗夜精灵", ["night", "elf"]], ["随机", ["random"]],
  ["简单", ["easy"]], ["普通", ["normal"]], ["困难", ["hard"]], ["疯狂", ["insane"]],
  ["红", ["red"]], ["蓝", ["blue"]], ["绿", ["green"]], ["黄", ["yellow"]], ["橙", ["orange"]],
  ["紫", ["purple"]], ["白", ["white"]], ["黑", ["black"]],
  // 繁体：Whisper 的中文有时写成繁体（同一个模型的训练数据里两种都有），而游戏的界面是简体。
  ["訓練", ["train"]], ["生產", ["train"]], ["製造", ["train"]], ["招募", ["train"]], ["僱用", ["train"]],
  ["建造", ["build"]], ["修建", ["build"]], ["移動", ["move"]], ["攻擊", ["attack"]],
  ["攻擊移動", ["attack", "move"]], ["攻擊地面", ["attack", "ground"]], ["巡邏", ["patrol"]],
  ["跟隨", ["follow"]], ["停止", ["stop"]], ["保持", ["hold"]], ["取消", ["cancel"]], ["返回", ["back"]],
  ["撤退", ["retreat"]], ["回城", ["teleport"]], ["傳送", ["teleport"]], ["研究", ["research"]],
  ["升級", ["research"]], ["學習", ["learn"]], ["施放", ["press"]], ["使用", ["press"]], ["釋放", ["press"]],
  ["選擇", ["select"]], ["選中", ["select"]], ["選取", ["select"]], ["編隊", ["group"]], ["加入", ["add"]],
  ["鏡頭", ["camera"]], ["視野", ["camera"]], ["查看", ["camera"]], ["採集", ["harvest"]],
  ["採金", ["harvest", "gold"]], ["採礦", ["harvest", "gold"]], ["伐木", ["lumber"]], ["砍樹", ["lumber"]],
  ["說", ["say"]], ["告訴", ["tell"]], ["打字", ["type"]], ["輸入", ["type"]], ["開啟", ["check"]],
  ["關閉", ["close"]], ["關掉", ["close"]], ["退出", ["exit"]], ["暫停", ["pause"]], ["設置", ["set"]],
  ["完成", ["finish"]], ["所有", ["all"]], ["全部", ["all"]], ["空閒", ["idle"]], ["閒置", ["idle"]],
  ["英雄", ["hero"]], ["基地", ["base"]], ["金礦", ["gold", "mine"]], ["金幣", ["gold"]], ["木材", ["lumber"]],
  ["木頭", ["lumber"]], ["樹木", ["tree"]], ["樹", ["tree"]], ["森林", ["forest"]], ["野怪", ["creeps"]],
  ["怪物", ["creeps"]], ["營地", ["camp"]], ["部隊", ["army"]], ["軍隊", ["army"]], ["物品", ["item"]],
  ["道具", ["item"]], ["這裡", ["here"]], ["那裡", ["there"]], ["中間", ["middle"]],
  ["滑鼠", ["cursor"]], ["遊標", ["cursor"]], ["敵人", ["enemy"]], ["敵方", ["enemy"]], ["盟友", ["ally"]],
  ["繼續遊戲", ["resume", "game"]], ["恢復遊戲", ["resume", "game"]], ["繼續對局", ["resume", "game"]],
  ["恢復對局", ["resume", "game"]], ["取消暫停", ["unpause"]], ["解除暫停", ["unpause"]], ["結束暫停", ["unpause"]],
  ["左邊", ["left"]], ["右邊", ["right"]], ["上面", ["top"]], ["下面", ["bottom"]], ["上", ["up"]], ["下", ["down"]],
  ["點擊", ["click"]], ["點開", ["click"]], ["按", ["press"]], ["進入", ["click"]], ["種族", ["race"]],
  ["隊友", ["ally"]], ["隊伍", ["team"]], ["顏色", ["color"]], ["地圖", ["map"]], ["人類", ["human"]],
  ["獸族", ["orc"]], ["不死族", ["undead"]], ["隨機", ["random"]],
  // 常见同音误听（讯练→训练、工击→攻击…）：Whisper 的中文错字大多错在这里。
  ["訊練", ["train"]], ["尋練", ["train"]], ["巡練", ["train"]], ["訊连", ["train"]],
  ["見造", ["build"]], ["箭造", ["build"]], ["建照", ["build"]],
  ["工擊", ["attack"]], ["公擊", ["attack"]], ["工击", ["attack"]], ["公击", ["attack"]],
  ["宣中", ["select"]], ["選種", ["select"]], ["选种", ["select"]],
  ["所以", ["all"]], ["才集", ["harvest"]], ["才金", ["harvest", "gold"]], ["財金", ["harvest", "gold"]],
  ["這理", ["here"]], ["哲理", ["here"]], ["這兒", ["here"]], ["應雄", ["hero"]], ["英熊", ["hero"]],
  ["金框", ["gold", "mine"]], ["金況", ["gold", "mine"]], ["回成", ["teleport"]], ["傳宋", ["teleport"]],
  ["個", []], ["只", []], ["兩", ["2"]], ["隊", ["group"]],
  // 战役 / 对战 / 地图说法的繁体写法。
  ["跳過過場", ["skip", "cinematic"]], ["跳過", ["skip"]], ["過場", ["cinematic"]], ["劇情", ["cinematic"]],
  ["任務目標", ["objective"]], ["現在要做什麼", ["objective"]], ["該做什麼", ["objective"]],
  ["第一個選項", ["option", "1"]], ["第二個選項", ["option", "2"]], ["第三個選項", ["option", "3"]],
  ["選項一", ["option", "1"]], ["選項二", ["option", "2"]], ["選項三", ["option", "3"]],
  ["偵察", ["scout"]], ["推進", ["push"]], ["推線", ["push", "lane"]], ["回防", ["defend"]], ["防守", ["defend"]],
  // 商店买卖的繁体写法。
  ["購買", ["buy"]], ["買", ["buy"]], ["賣出", ["sell"]], ["賣掉", ["sell"]], ["賣", ["sell"]],
  ["復活英雄", ["revive"]], ["復活", ["revive"]],
  ["裝載", ["board"]], ["上船", ["board"]], ["卸載", ["unload"]], ["下船", ["unload"]],
  ["自動修理", ["auto-repair"]], ["關閉自動修理", ["auto-repair", "off"]], ["修理", ["repair"]], ["維修", ["repair"]],
  ["共享視野", ["sharevision"]], ["共享控制", ["sharecontrol"]], ["結盟", ["diplomacy"]],
  ["信號", ["ping"]], ["移出編隊", ["ungroupone"]], ["排隊", ["queued"]],
  ["下一組", ["subgroupnext"]], ["下一個空閒農民", ["selectidle"]], ["集中火力", ["focus"]], ["交換", ["swap"]],
  ["建造選單", ["buildmenu"]], ["技能選單", ["learnmenu"]], ["清空隊列", ["cancelall"]],
  ["第一隊", ["group", "1"]], ["第二隊", ["group", "2"]], ["第三隊", ["group", "3"]], ["第四隊", ["group", "4"]],
];

/** The words a race's gatherers are called in Chinese — names the map supplies, but the ones a
 *  player says most, and what makes "所有农民采金" a subject rather than four stray characters. */
export const ZH_WORKER_WORDS = ["农民", "工人", "苦工", "侍僧", "小精灵", "奴隶", "采集者", "伐木工",
  "農民", "苦工", "侍僧", "小精靈", "奴隸", "採集者", "伐木工"];
// …and the grammar's own worker check (declared above, before the table could be).
for (const w of ZH_WORKER_WORDS) WORKER_WORDS.add(w);

const ZH_MAP = new Map(ZH);
/** The longest phrase a Chinese sentence may open a token with (a lex name can be longer). */
const ZH_MAX = Math.max(...ZH.map(([p]) => p.length), ...ZH_WORKER_WORDS.map((p) => p.length));

/** The Chinese words that make a name — one opaque token each, never translated. */
const ZH_NAMES = new Set(ZH_WORKER_WORDS);

/**
 * 命令词的无调拼音索引：识别器常把“拾取”写成“时区”“失去”，三者声母韵母相同，只有声调不同，
 * 去掉声调就是同一个音。精确匹配失败后按这个音再试一次，只在“一音一词”时使用——同一个音对应
 * 两条不同命令就放弃，绝不猜。名字不参与拼音回退（名字错配会下错命令，比不识别更糟）。
 */
const PINYIN_CACHE = new Map<string, string>();
const ZH_BY_PINYIN = new Map<string, readonly string[] | null>();
let ZH_PINYIN_MAX = 2;

/** 一段汉字的无调拼音，如“拾取”→“shiqu”。 */
function pinyinKey(zh: string): string {
  let p = PINYIN_CACHE.get(zh);
  if (p === undefined) {
    p = pinyin(zh, { toneType: "none", type: "array" }).join("");
    PINYIN_CACHE.set(zh, p);
  }
  return p;
}

for (const [phrase, tokens] of ZH) {
  // 虚词（“个”“只”）不参与：吞掉它们没有意义，还可能把名字里的字吃掉。
  if (!tokens.length) continue;
  const p = pinyinKey(phrase);
  if (!p) continue;
  const known = ZH_BY_PINYIN.get(p);
  if (known === undefined) ZH_BY_PINYIN.set(p, tokens);
  else if (known && known.join(" ") !== tokens.join(" ")) ZH_BY_PINYIN.set(p, null);
  if (phrase.length > ZH_PINYIN_MAX) ZH_PINYIN_MAX = phrase.length;
}

/** 名字的拼音索引：一个词库一个（Lexicon 换牌时集合也换，WeakMap 自动回收旧的）。 */
interface NameSound {
  /** 无调拼音 → 名字；同一个音对应多个名字时记 null，宁可不认。 */
  readonly exact: ReadonlyMap<string, string | null>;
  readonly list: ReadonlyArray<{ name: string; py: string }>;
  readonly maxLen: number;
}

const NAME_SOUNDS = new WeakMap<ReadonlySet<string>, NameSound>();

function nameSound(names: ReadonlySet<string>): NameSound {
  let idx = NAME_SOUNDS.get(names);
  if (idx) return idx;
  const exact = new Map<string, string | null>();
  const list: Array<{ name: string; py: string }> = [];
  let maxLen = 2;
  for (const name of names) {
    if (/[^\u3400-\u9fff]/.test(name)) continue;
    const py = pinyinKey(name);
    if (!py) continue;
    list.push({ name, py });
    const known = exact.get(py);
    if (known === undefined) exact.set(py, name);
    else if (known !== name) exact.set(py, null);
    if (name.length > maxLen) maxLen = name.length;
  }
  idx = { exact, list, maxLen };
  NAME_SOUNDS.set(names, idx);
  return idx;
}

/** 输入窗口和词库名字的拼音完全一样（同音字：“不兵”→“步兵”）。 */
function pinyinNameExact(s: string, i: number, names?: ReadonlySet<string>): { name: string; len: number } | null {
  if (!names || !names.size) return null;
  const idx = nameSound(names);
  for (let len = Math.min(idx.maxLen, s.length - i); len >= 2; len--) {
    const slice = s.slice(i, i + len);
    if (/[^\u3400-\u9fff]/.test(slice)) continue;
    const name = idx.exact.get(pinyinKey(slice));
    if (name) return { name, len };
  }
  return null;
}

/** 拼音只差一两个字母（少一个元音、多一个鼻音）时，找唯一最近的名字；并列就不猜。 */
function pinyinNameFuzzy(s: string, i: number, names?: ReadonlySet<string>): { name: string; len: number } | null {
  if (!names || !names.size) return null;
  const idx = nameSound(names);
  let best: { name: string; len: number; d: number } | null = null;
  let tie = false;
  for (let len = Math.min(idx.maxLen, s.length - i); len >= 2; len--) {
    const slice = s.slice(i, i + len);
    if (/[^\u3400-\u9fff]/.test(slice)) continue;
    const py = pinyinKey(slice);
    const k = py.length >= 10 ? 2 : py.length >= 4 ? 1 : 0;
    if (!k) continue;
    for (const e of idx.list) {
      if (Math.abs(e.py.length - py.length) > k) continue;
      const d = distance(py, e.py, k);
      if (d > k) continue;
      if (!best || d < best.d || (d === best.d && len > best.len)) {
        best = { name: e.name, len, d };
        tie = false;
      } else if (d === best.d && len === best.len && e.name !== best.name) {
        tie = true;
      }
    }
  }
  return best && !tie ? { name: best.name, len: best.len } : null;
}

/** How alike two keys are, 0..1 — the fallback's score (`Lexicon.best`). Same length only: a name
 *  with a character more or less is a different name, and `repairNames` already restores those. */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || a.length !== b.length) return 0;
  return 1 - substitutions(a, b, a.length) / a.length;
}

/** How many characters two equally long strings differ by, stopping past `max`. */
function substitutions(a: string, b: string, max: number): number {
  if (a.length !== b.length) return max + 1;
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && ++d > max) return d;
  return d;
}

/**
 * Put the lexicon's spelling back where the recogniser dropped ONE character of a name — "不兵"
 * for "步兵", "金框" for "金矿". A Chinese name has no "close enough": matched exactly, a single
 * wrong character is a name nothing answers to, and the whole command is lost. Only a same-length
 * window one character off is repaired, and only when exactly one name in the lexicon is that
 * close (otherwise "农民" and "农夫" would swap places).
 */
function repairNames(s: string, names?: ReadonlySet<string>): string {
  if (!names || !names.size) return s;
  // THREE characters and up: a two-character name one character off is a coin toss ("成兵" is
  // not "步兵", and "营地" is a camp, not a barracks), so short names are matched exactly.
  const list = [...names].filter((n) => n.length >= 3).sort((a, b) => b.length - a.length);
  let out = s;
  for (const name of list) {
    const len = name.length;
    for (let i = 0; i + len <= out.length; i++) {
      const win = out.slice(i, i + len);
      if (win === name || !CJK.test(win)) continue;
      // A window that is ITSELF a command word is never a name: "营地" (camp) is one character
      // off "兵营" (a barracks), and repairing it turned every "攻击红色营地" into an attack on a
      // barracks.
      if (ZH_MAP.has(win) || ZH_NAMES.has(win)) continue;
      if (substitutions(win, name, 1) > 1) continue;
      let clash = false;
      for (const other of list) {
        if (other !== name && other.length === len && substitutions(win, other, 1) <= 1) { clash = true; break; }
      }
      if (clash) continue;
      out = out.slice(0, i) + name + out.slice(i + len);
      i += len - 1;
    }
  }
  return out;
}

/**
 * A Chinese sentence as tokens: each is either an English word the grammar knows (from `ZH`) or
 * a NAME, kept whole and in Chinese ("步兵", "山丘之王"). `names` are the lexicon's own phrases,
 * so a name that contains a command word ("传送权杖") is read as the name.
 *
 * There are no spaces to split on, so every position is read by longest match: a name first, then
 * the command words, then a single character (which only a lexicon name can use). Latin runs —
 * "tp", "gg", "3" — pass through as words. When nothing matches exactly, a run of two or more
 * Chinese characters is tried again by its TONE-FREE pinyin, so a recogniser that writes “时区”
 * or “失去” for “拾取” still lands on the command (only when that sound names one command). A
 * lexicon NAME gets the same treatment in two steps: a name whose pinyin is exactly the same, then
 * a unique name one or two letters away (a dropped vowel, an extra nasal).
 */
function zhWords(text: string, names?: ReadonlySet<string>): string[] {
  const s = repairNames(text
    .replace(/\|c[0-9a-f]{8}|\|r|\|n/gi, " ")
    .replace(/[，。！？、；：""''（）【】《》…—～·,.;:!?"'()[\]<>]/g, " "), names);
  const max = Math.max(ZH_MAX, ...[...(names ?? [])].map((n) => n.length));
  const out: string[] = [];
  for (let i = 0; i < s.length; ) {
    const at = s[i];
    if (/\s/.test(at)) { i++; continue; }
    if (!CJK.test(at)) {
      let j = i;
      while (j < s.length && !CJK.test(s[j]) && !/\s/.test(s[j])) j++;
      const w = s.slice(i, j).toLowerCase().replace(/[^a-z0-9']/g, "");
      if (w) out.push(w);
      i = j;
      continue;
    }
    let hit = false;
    // A one-character command is held back until the sound test has had its turn: “十取” would
    // otherwise be read as “十” (10) and lose the “拾取” hiding in its two characters.
    let oneChar: readonly string[] | null = null;
    for (let len = Math.min(max, s.length - i); len > 0; len--) {
      const slice = s.slice(i, i + len);
      if (names?.has(slice) || ZH_NAMES.has(slice)) {
        out.push(slice);
        i += len;
        hit = true;
        break;
      }
      const cmd = ZH_MAP.get(slice);
      if (!cmd) continue;
      if (len === 1) { oneChar = cmd; break; }
      out.push(...cmd);
      i += len;
      hit = true;
      break;
    }
    if (!hit) {
      // 先按拼音认名字：同音字（“不兵”→“步兵”）比模糊拼音可靠。
      const named = pinyinNameExact(s, i, names);
      if (named) {
        out.push(named.name);
        i += named.len;
        hit = true;
      }
    }
    if (!hit) {
      // 再按“无调拼音”认命令词（“时区/失去”→“拾取”）。只试命令词、至少两个字、
      // 且这个音只对应一条命令；名字仍只认精确写法。
      for (let len = Math.min(ZH_PINYIN_MAX, s.length - i); len >= 2; len--) {
        const slice = s.slice(i, i + len);
        if (/[^\u3400-\u9fff]/.test(slice)) continue;
        const cmd = ZH_BY_PINYIN.get(pinyinKey(slice));
        if (!cmd) continue;
        out.push(...cmd);
        i += len;
        hit = true;
        break;
      }
    }
    if (!hit) {
      // 最后才放宽到编辑距离：拼音差一两个字母（少一个元音）时，认唯一最近的名字。
      const named = pinyinNameFuzzy(s, i, names);
      if (named) {
        out.push(named.name);
        i += named.len;
        hit = true;
      }
    }
    if (!hit && oneChar) {
      out.push(...oneChar);
      i++;
      hit = true;
    }
    if (!hit) {
      out.push(at); // a character of a name the lexicon knows and this did not
      i++;
    }
  }
  return out;
}

/** A lexicon phrase's tokens. Chinese names are ONE token, whatever they contain — a name is
 *  matched as itself, never through the command table. */
function phraseWords(phrase: string): string[] {
  if (!CJK.test(phrase)) return words(phrase);
  return [phrase.replace(/\s+/g, "")];
}


/**
 * A sentence as tokens: Chinese through the table above (`zhWords`), English lower-cased, its
 * WC3 markup and punctuation stripped, the known mishearings put back, split on spaces.
 */
export function words(text: string, names?: ReadonlySet<string>): string[] {
  if (CJK.test(text)) return zhWords(text, names);
  let t = ` ${text
    .toLowerCase()
    .replace(/\|c[0-9a-f]{8}|\|r|\|n/gi, " ")
    .replace(/[-_]/g, " ")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/'/g, "")
    .replace(/\s+/g, " ")} `;
  for (const [re, to] of MISHEARD) t = t.replace(re, to);
  // "up and to the left" is ONE direction; the clause splitter would read the "and" as a second
  // command.
  t = t.replace(/\b(up|upward|upwards|down|downward|downwards|north|south|forward|forwards) and (to the )?(left|right|east|west)\b/g, "$1 $3");
  return t.split(/\s+/).filter(Boolean);
}

/** One word's DICTIONARY form, so "footmen" says "footman" and "wolves" "wolf". Applied to both
 *  sides of every comparison, so it only has to be consistent, not correct English. A Chinese
 *  word is never inflected — it is a name or a token from the table, and is left alone. */
export function stem(w: string): string {
  if (NON_ASCII.test(w)) return w;
  if (w.length <= 3) return w;
  if (w.endsWith("men")) return w.slice(0, -3) + "man";
  if (w.endsWith("ves")) return w.slice(0, -3) + "f";
  if (w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.endsWith("ches") || w.endsWith("shes") || w.endsWith("xes") || w.endsWith("sses")) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us")) return w.slice(0, -1);
  return w;
}

/** A phrase's comparison key: its words stemmed and run together ("Blade Master" and
 *  "blademasters" both read `blademaster`), so a recogniser's word split never matters. */
export function key(ws: readonly string[]): string {
  return ws.map(stem).join("");
}

/**
 * A word as it SOUNDS, roughly: the consonant skeleton after the first letter, doubled letters
 * single, the common same-sound spellings folded ("ph"/"f", "ck"/"k", "z"/"s", "c" before e/i
 * as "s"). A free-text recogniser's misses are mostly spellings of the right sound — "alter" for
 * Altar, "rifle men" for Riflemen, "goul" for Ghoul — and two keys that sound alike are a match
 * the edit distance alone would refuse for a short name.
 */
export function sound(k: string): string {
  if (NON_ASCII.test(k)) return k; // a Chinese name has no spelling to fold
  const s = k
    .replace(/ph/g, "f").replace(/ck/g, "k").replace(/gh/g, "g").replace(/z/g, "s")
    .replace(/c([eiy])/g, "s$1").replace(/c/g, "k").replace(/q/g, "k").replace(/x/g, "ks");
  const head = s[0] ?? "";
  return (head + s.slice(1).replace(/[aeiouyhw]/g, "")).replace(/(.)\1+/g, "$1");
}

/** Levenshtein distance, capped (the caller only ever asks "within k?"). */
function distance(a: string, b: string, cap: number): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > cap) return cap + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** The lexicon, indexed once per vocabulary (a match changes it when the card changes). */
export class Lexicon {
  readonly entries: ReadonlyArray<{ entry: LexEntry; key: string; len: number }>;
  /** The Chinese names, exactly as the map spells them — handed to the tokenizer so a name that
   *  contains a command word is read as the name. */
  readonly cjkNames: ReadonlySet<string>;
  /** The longest phrase, in tokens, that a match may span. */
  private readonly span: number;
  constructor(entries: readonly LexEntry[]) {
    const seen = new Set<string>();
    const out: Array<{ entry: LexEntry; key: string; len: number }> = [];
    let longest = 1;
    for (const e of entries) {
      const ws = phraseWords(e.phrase);
      if (!ws.length) continue;
      const k = key(ws);
      const dedupe = `${e.kind}|${e.id}|${k}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      out.push({ entry: e, key: k, len: ws.length });
      if (ws.length > longest) longest = ws.length;
    }
    this.entries = out;
    this.cjkNames = new Set(out.filter((e) => CJK.test(e.key)).map((e) => e.key));
    this.span = Math.min(16, Math.max(5, longest + 2));
  }

  /**
   * The best entry spelled by the words starting at `at` — trying every span up to two words
   * longer than the longest name (a recogniser may split "blademaster" into "blade master"),
   * preferring an EXACT key over a near one and a longer span over a shorter, so "storm bolt"
   * never stops at "storm". `kinds` narrows the search ("train" only wants units).
   *
   * A Chinese key is matched EXACTLY: "近战兵" and "远程兵" are two names, not one word with a
   * typo, and one edit of a three-character name is a different unit.
   */
  match(ws: readonly string[], at: number, kinds?: ReadonlyArray<LexEntry["kind"]>): { entry: LexEntry; end: number } | null {
    let best: { entry: LexEntry; end: number; score: number } | null = null;
    for (let end = Math.min(ws.length, at + this.span); end > at; end--) {
      const k = key(ws.slice(at, end));
      for (const e of this.entries) {
        if (kinds && !kinds.includes(e.entry.kind)) continue;
        let d: number;
        if (NON_ASCII.test(k) || NON_ASCII.test(e.key)) {
          if (k !== e.key) continue;
          d = 0;
        } else {
          // A near miss is allowed one edit per five letters — enough for "riflemen"/"rifleman"
          // that survived stemming and for a plural the recogniser spelled oddly, not enough to
          // turn "farm" into "arm".
          const cap = e.key.length >= 6 ? Math.floor(e.key.length / 5) : 0;
          d = k === e.key ? 0 : distance(k, e.key, cap);
          // …or the same SOUND (a free-text recogniser spells the right sound wrongly), from four
          // letters up — under that a skeleton is too short to mean anything ("orc" and "ark").
          if (d > cap && e.key.length >= 4 && sound(k) === sound(e.key)) d = cap + 1;
          else if (d > cap) continue;
        }
        const score = (end - at) * 10 - d * 15;
        if (!best || score > best.score) best = { entry: e.entry, end, score };
      }
    }
    return best ? { entry: best.entry, end: best.end } : null;
  }

  /**
   * The names this utterance could be, best spelling first — the player's own tolerance, in
   * code: "建造农厂" is 农场 with one character wrong, and a command that needs every syllable
   * perfect is a command nobody says twice. A TIE is reported as every name in it ("农厂" is both
   * 农民 and 农场 one character off), and the caller reads the clause again with each, keeping the
   * one whose VERB fits — "建造" only takes a building, so the tie resolves itself.
   */
  near(ws: readonly string[]): Array<{ entry: LexEntry; at: number; end: number; score: number }> {
    let best = 0;
    const at = new Map<string, { entry: LexEntry; at: number; end: number; score: number }>();
    for (let i = 0; i < ws.length; i++) {
      for (let end = Math.min(ws.length, i + this.span); end > i; end--) {
        const k = key(ws.slice(i, end));
        for (const e of this.entries) {
          const score = similarity(k, e.key);
          if (score < 0.5) continue;
          const had = at.get(e.entry.id);
          if (had && had.score >= score) continue;
          at.set(e.entry.id, { entry: e.entry, at: i, end, score });
          if (score > best) best = score;
        }
      }
    }
    if (best >= 1) return [];
    return [...at.values()].filter((c) => c.score === best).slice(0, 5);
  }
}

/** What `parse` needs besides the words. */
export interface ParseContext {
  lexicon: Lexicon;
  /** The packs in force for this match (voice/packs.ts), most general first. Their whole-sentence
   *  phrases are read before the common grammar. */
  packs?: readonly VoicePack[];
}

/** A pack's own sentence, if this clause is exactly one: filler words ("please", "the") are
 *  dropped on both sides, so "skip the cinematic" reaches ["skip","cinematic"]. */
function packIntent(ws: readonly string[], ctx: ParseContext): VoiceIntent | null {
  if (!ctx.packs?.length) return null;
  const norm = (a: readonly string[]): string => a.filter((w) => !FILLER.has(w)).join(" ");
  const said = norm(ws);
  if (!said) return null;
  // Most specific last: a map's own file overrides a built-in map pack, which overrides the
  // kind's, which overrides the common grammar's own words.
  for (let i = ctx.packs.length - 1; i >= 0; i--) {
    for (const p of ctx.packs[i].phrases ?? []) if (norm(p.words) === said) return p.intent;
  }
  return null;
}

/**
 * The words `parse` itself knows — the verbs, numbers, targets — for the recogniser's grammar.
 * The lexicon's own names are added beside them (src/voice/vocabulary.ts).
 */
export function grammarWords(): string[] {
  const out = new Set<string>();
  for (const [p] of VERBS2) for (const w of p.split(" ")) out.add(w);
  for (const w of Object.keys(VERBS1)) out.add(w);
  for (const w of Object.keys(NUMBERS)) if (!/^\d+$/.test(w)) out.add(w);
  for (const s of [SCREEN_WORDS, CURSOR_WORDS, NEXT_WORDS, NEAREST_WORDS, ENEMY_WORDS, MINE_WORDS, ALLY_WORDS, PREPOSITIONS, FILLER]) for (const w of s) out.add(w);
  for (const w of Object.keys(REGION_WORDS)) out.add(w);
  for (const w of ["side", "map", "corner", "camera", "move", "take", "put", "look", "one", "pan", "place", "fall", "back",
    "retreat", "home", "green", "orange", "yellow", "red", "goblin", "tavern"]) out.add(w);
  for (const set of [WORKER_WORDS, ALL_WORDS, FROM_WORDS, GOLD_WORDS, LUMBER_WORDS]) for (const w of set) out.add(w);
  for (const w of ["finish", "complete", "resume", "continue", "construction", "building", "buildings", "item", "items",
    "idle", "rally", "point", "creep", "creeps", "camp", "camps", "neutral", "tower", "shop", "farm",
    "supply", "house", "hall", "altar", "barracks", "tavern", "fountain", "merchant", "laboratory", "marketplace"]) out.add(w);
  for (const w of ["hero", "heroes", "base", "home", "town", "hall", "gold", "lumber", "wood", "trees", "forest", "position",
    "point", "ground", "item", "slot", "off", "worker", "workers", "units", "all", "every", "unit", "group", "add"]) out.add(w);
  // The packs' own words (voice/packs.ts): the campaign's cutscene / objective / option, the
  // skirmish's scout / push / defend, and a custom map's jungle / lane.
  for (const w of ["skip", "cinematic", "cutscene", "intro", "objective", "objectives", "option", "accept",
    "scout", "push", "defend", "focus", "fire", "jungle", "clear", "lane"]) out.add(w);
  return [...out];
}

/** Parse what was heard. An empty list means nothing in it was a command. */
export function parse(text: string, ctx: ParseContext): VoiceIntent[] {
  const ws = words(text, ctx.lexicon.cjkNames);
  // A chat line is ONE thing however many "and"s it has: they are the message's own.
  const chat = parseChat(ws, text);
  if (chat) return [chat];
  const out: VoiceIntent[] = [];
  // Split on the joins a player uses between two commands. A clause with no verb of its own
  // inherits the previous one ("select footmen and riflemen").
  const clauses: string[][] = [[]];
  for (let k = 0; k < ws.length; k++) {
    const w = ws[k];
    const next = ws[k + 1] ?? "";
    // “交换物品一和三”：换物品时的 and 后面跟数字，是同一命令的第二个格子，不是新命令。
    const swapping = clauses[clauses.length - 1].some((x) => x === "swap" || x === "exchange");
    if ((w === "and" || w === "then") && !(swapping && NUMBERS[next] !== undefined)) clauses.push([]);
    else clauses[clauses.length - 1].push(w);
  }
  let lastVerb: string | null = null;
  for (const c of clauses) {
    if (!c.length) continue;
    // 中文常把目标放在动词前（“对敌人英雄使用风暴之锤”“给英雄使用治疗药膏”）。把
    // “使用/施放 + 技能/物品”这一段挪回句首，文法仍旧按动词在前的写法读。
    if (c[0] === "to") {
      const press = c.indexOf("press");
      if (press > 1) c.push(...c.splice(0, press));
    }
    let r = parseClause(c, ctx, lastVerb);
    if (!r) {
      // Nothing in this clause fitted the grammar. Put the closest names' own spelling back where
      // they were heard and read the clause again; the verb decides which spelling it was
      // ("建造农厂" only builds a farm, never a peasant).
      const head = readVerb(c);
      const wish: Partial<Record<string, LexEntry["kind"]>> = { build: "building", train: "unit", learn: "ability", use: "item" };
      const want = head ? wish[head[0]] : undefined;
      const near = ctx.lexicon.near(c);
      if (want) near.sort((a, b) => Number(a.entry.kind !== want) - Number(b.entry.kind !== want));
      for (const cand of near) {
        const fixed = [...c.slice(0, cand.at), ...phraseWords(cand.entry.phrase), ...c.slice(cand.end)];
        r = parseClause(fixed, ctx, lastVerb);
        if (r) break;
      }
    }
    if (r) {
      out.push(r.intent);
      lastVerb = r.verb;
    }
  }
  return out;
}

/** Read the verb at the head of a clause: [meaning, words consumed]. */
function readVerb(ws: readonly string[]): [string, number] | null {
  if (ws.length >= 2) {
    const two = `${ws[0]} ${ws[1]}`;
    for (const [p, v] of VERBS2) if (p === two) return [v, 2];
  }
  const v = VERBS1[ws[0]];
  return v ? [v, 1] : null;
}

/** The count at `at`, if there is one: [value, next index]. */
function readCount(ws: readonly string[], at: number): [number, number] {
  const n = NUMBERS[ws[at] ?? ""];
  return n === undefined ? [1, at] : [n, at + 1];
}

/** The region and the pick a target phrase carries anywhere in it ("another gold mine on the
 *  right side of the map": pick next, region x +1). */
function readModifiers(ws: readonly string[], from: number): { region?: Region; pick?: Pick } {
  let region: Region | undefined;
  let pick: Pick | undefined;
  for (let i = from; i < ws.length; i++) {
    const r = REGION_WORDS[ws[i]];
    if (r) {
      region ??= { x: null, y: null };
      if (r.x !== undefined && !(r.x === 0 && region.x !== null)) region.x = r.x;
      if (r.y !== undefined && !(r.y === 0 && region.y !== null)) region.y = r.y;
    }
    if (NEXT_WORDS.has(ws[i])) pick = "next";
    else if (NEAREST_WORDS.has(ws[i]) && !pick) pick = "nearest";
  }
  return { region, pick };
}

/** Read a target phrase out of `ws` from `at` on. Prepositions, "the" and the modifier words
 *  are skipped, and the modifiers are read off the whole rest of the clause. */
export function readTarget(ws: readonly string[], at: number, lex: Lexicon): VoiceTarget | undefined {
  let i = at;
  let side: Side = "any";
  const mods = readModifiers(ws, at);
  const skippable = (w: string): boolean =>
    PREPOSITIONS.has(w) || FILLER.has(w) || w === "a" || w === "an" || NEXT_WORDS.has(w) || NEAREST_WORDS.has(w) ||
    ALL_WORDS.has(w) || w === "camera" || w === "back" || w === "over" || w === "up" || w === "view";
  // A camp's COLOUR on the minimap ("a green camp", "the red creeps"), said before the camp.
  const tierAt = (j: number): "green" | "orange" | "red" | undefined =>
    ws[j] === "green" || ws[j] === "easy" ? "green" : ws[j] === "orange" || ws[j] === "yellow" || ws[j] === "medium" ? "orange" : ws[j] === "red" || ws[j] === "hard" ? "red" : undefined;
  while (i < ws.length && skippable(ws[i])) i++;
  if (i >= ws.length) return undefined;
  if (CURSOR_WORDS.has(ws[i])) return { kind: "cursor" };
  if (SCREEN_WORDS.has(ws[i])) return { kind: "screen" };
  if (ENEMY_WORDS.has(ws[i])) { side = "enemy"; i++; }
  else if (MINE_WORDS.has(ws[i]) && ws[i] !== "mine") { side = "mine"; i++; }
  else if (ALLY_WORDS.has(ws[i])) { side = "ally"; i++; }
  while (i < ws.length && skippable(ws[i])) i++;
  const w = ws[i];
  // "the enemy" with nothing after it is the enemy FORCE, not their base: "attack the enemy"
  // must not send the army to a town hall across the map.
  if (w === undefined) return side === "enemy" ? { kind: "enemies", ...mods } : undefined;
  const s = stem(w);
  // "the enemy units/troops/forces" — again the force, not one named kind of unit.
  if (side === "enemy" && (s === "unit" || s === "troop" || s === "force" || s === "army")) return { kind: "enemies", ...mods };
  if (s === "hero") return { kind: "hero", side, ...mods };
  if (s === "base" || s === "home" || (s === "town" && ws[i + 1] === "hall")) return { kind: "base", side: side === "any" ? "mine" : side, ...mods };
  if ((s === "gold" && (ws[i + 1] === "mine" || ws[i + 1] === undefined)) || (s === "mine" && side === "any")) return { kind: "mine", ...mods };
  if (s === "tree" || s === "forest" || s === "wood" || s === "lumber") return { kind: "trees" };
  if (s === "army") return { kind: "army" };
  {
    // "a green camp", "the red creeps", "an orange creep camp"
    const tier = tierAt(i);
    const next = stem(ws[i + 1] ?? "");
    if (tier && (next === "camp" || next === "creep")) return { kind: "creeps", tier, ...mods };
  }
  if (s === "creep" || s === "camp" || (s === "neutral" && stem(ws[i + 1] ?? "") === "camp")) return { kind: "creeps", ...mods };
  const m = lex.match(ws, i, ["unit", "building", "hero"]);
  if (m) return { kind: "unit", entry: m.entry, side, ...mods };
  // Nothing but a part of the map: "the top left", "the middle of the map".
  if (mods.region) return { kind: "region", region: mods.region };
  return undefined;
}

/** The console's panels by what players call them. */
const PANELS: Array<[RegExp, "quests" | "menu" | "allies" | "chat"]> = [
  [/\b(quests?|quest log|objectives?|missions?)\b/, "quests"],
  [/\b(menu|game menu|pause menu|main menu|options|escape menu)\b/, "menu"],
  [/\b(allies|alliance|alliances|diplomacy|ally menu|ally panel)\b/, "allies"],
  [/\b(message log|chat log|log|chat panel|chat history|messages)\b/, "chat"],
];

/**
 * A CHAT line: "say good game", "tell allies push mid", "type gg to all", "send message attack
 * now to everyone", or "chat" / "open chat" alone for the input. The message is the rest of the
 * sentence as said — the recogniser's free half fills it in (src/voice/control.ts) — less the
 * words that say WHO it is for ("to all", "to allies", "all chat", "team").
 */
export function parseChat(ws: readonly string[], text?: string): VoiceIntent | null {
  // Chinese is not tokenised for a message: what follows the verb IS the message, and the
  // recogniser already wrote it — translating its words back would rewrite the player's line
  // ("说打得不错" must not become "say attack 得不错").
  if (text && CJK.test(text)) return chatZh(text);
  let i = 0;
  if (ws[0] === "send" && /^(message|msg|text|chat)$/.test(ws[1] ?? "")) i = 2;
  else if (ws[0] === "send" && ws[1] === "a" && /^(message|msg|text|chat)$/.test(ws[2] ?? "")) i = 3;
  else if (/^(say|tell|type|write|chat|message)$/.test(ws[0] ?? "")) i = 1;
  else if (/^(open|start)$/.test(ws[0] ?? "") && ws[ws.length - 1] === "chat" && ws.length <= 3) return { kind: "chat", text: "", scope: null };
  else return null;
  const rest = ws.slice(i);
  let scope: "all" | "allies" | null = null;
  const take = (n: number, sc: "all" | "allies", at: number): void => { rest.splice(at, n); scope = sc; };
  const tail = glue(rest);
  // Who, at the end ("… to all") or at the start ("tell allies …", "all chat …").
  if (/ (to|for) (all|everyone|everybody|every one)$/.test(` ${tail}`)) take(2, "all", rest.length - 2);
  else if (/ (to|for) (allies|ally|team|my team|teammates|the team)$/.test(` ${tail}`)) take(rest[rest.length - 2] === "my" || rest[rest.length - 2] === "the" ? 3 : 2, "allies", rest.length - (rest[rest.length - 2] === "my" || rest[rest.length - 2] === "the" ? 3 : 2));
  else if (/^(all|everyone|everybody)\b/.test(tail)) take(rest[1] === "chat" ? 2 : 1, "all", 0);
  else if (/^(allies|team|ally)\b/.test(tail)) take(rest[1] === "chat" ? 2 : 1, "allies", 0);
  return { kind: "chat", text: glue(rest), scope };
}

/** Tokens back into text, for a chat line: Chinese is written without the spaces the tokens
 *  were split on, English with them ("gg well played" is not "ggwellplayed"). */
function glue(ws: readonly string[]): string {
  return ws.join(" ").replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, "$1").trim();
}

/**
 * A Chinese chat line: the verb, who it is for, and the message as it was heard. Only the verb
 * and the addressee are read; everything after them is the player's own words, untouched.
 */
function chatZh(text: string): VoiceIntent | null {
  let s = text.trim().replace(/[。！？!?，,]+$/, "");
  let scope: "all" | "allies" | null = null;
  // Who it is for comes first as often as last: "对所有人说 gg".
  const head = /^(?:对|给)(所有人|大家|全体|每个人|盟友|队友|友军)[，,]?\s*(?:说|喊|打字|输入)[，,]?\s*/.exec(s);
  if (head) {
    scope = head[1] === "盟友" || head[1] === "队友" || head[1] === "友军" ? "allies" : "all";
    s = s.slice(head[0].length);
    return { kind: "chat", text: s.trim(), scope };
  }
  const all = /[，,]?(?:对|给)(?:所有人|大家|全体|每个人)$/;
  const allies = /[，,]?(?:对|给)(?:盟友|队友|友军)$/;
  if (all.test(s)) { scope = "all"; s = s.replace(all, ""); }
  else if (allies.test(s)) { scope = "allies"; s = s.replace(allies, ""); }
  const said = /^(?:说|喊|告诉|打字|输入|发消息)(?:一下)?[，,]?\s*(?:给)?(?:所有人|大家|盟友|队友)?[，,]?\s*/.exec(s);
  if (!said) return null;
  return { kind: "chat", text: s.slice(said[0].length).trim(), scope };
}

function parseClause(ws: string[], ctx: ParseContext, inherited: string | null): { intent: VoiceIntent; verb: string } | null {
  const lex = ctx.lexicon;
  // A chat line is not a command at all: everything after the verb is the message.
  const chat = parseChat(ws);
  if (chat) return { intent: chat, verb: "chat" };
  // A pack's own sentence — "跳过过场", "打野" — wins before the common grammar reads it.
  const packed = packIntent(ws, ctx);
  if (packed) return { intent: packed, verb: "pack" };
  // “结盟”/“同盟”会被 F11 盟友面板的正则截走；它只读回盟友状态，先说清楚。
  if (ws[0] === "diplomacy") {
    return { intent: { kind: "diplomacy", action: "status", on: true, target: readTarget(ws, 1, ctx.lexicon) }, verb: "diplomacy" };
  }
  // “建造菜单”/“技能菜单”也含 menu，会被 F10 面板截走——命令卡页面优先。
  if (ws.includes("buildmenu") || (ws.includes("build") && ws.includes("menu"))) {
    return { intent: { kind: "cardpage", page: "build" }, verb: "buildmenu" };
  }
  if (ws.includes("learnmenu") || (ws.includes("skill") && ws.includes("menu"))) {
    return { intent: { kind: "cardpage", page: "learn" }, verb: "learnmenu" };
  }
  // The console's panels: "open the quest log", "close the menu", "show allies", "menu".
  const text = ws.join(" ");
  const opener = /^(open|show|toggle|bring|display|view|check|go)\b/.test(text) ? true : /^(close|hide|exit|leave|dismiss)\b/.test(text) ? false : undefined;
  if (opener !== undefined || ws.length <= 3) {
    for (const [re, panel] of PANELS) {
      if (!re.test(text)) continue;
      if (opener === undefined && ws.length > 2) break;
      return { intent: { kind: "panel", panel, open: opener === undefined ? null : opener }, verb: "panel" };
    }
  }
  // "pause the game", "pause", "unpause", "resume the game".
  if (/^(pause)( the)?( game)?$/.test(text)) return { intent: { kind: "pause", on: true }, verb: "pause" };
  if (/^(unpause|resume|continue)( the)? game$|^unpause$/.test(text)) return { intent: { kind: "pause", on: false }, verb: "pause" };
  // "move the camera to another gold mine", "take the camera to my base", "camera top left":
  // a clause that names the CAMERA is about the camera, whichever verb it opens with — "move"
  // above all, which would otherwise order the army there.
  const cam = ws.indexOf("camera");
  if (cam >= 0) {
    // "move the camera up", "pan the camera left a bit": a step from where it looks now.
    const dir = readDirection(ws, cam + 1);
    if (dir) return { intent: { kind: "camera", target: { kind: "step", dx: dir.dx, dy: dir.dy, scale: dir.scale } }, verb: "camera" };
    const t = readTarget(ws, cam + 1, lex);
    return t ? { intent: { kind: "camera", target: t }, verb: "camera" } : null;
  }
  // "go north", "go up and left": "go" is filler everywhere else ("go ahead"), a MOVE here.
  if (ws[0] === "go" && DIRECTION_WORDS[ws[1] ?? ""]) ws = ["move", ...ws.slice(1)];
  // “排队”/“queue”/“queued”：Shift 排队的修饰词；“clear queue” 里的 queue 是队列本身。
  const queueWord = (w: string, k: number): boolean =>
    w === "queue" && !(k > 0 && (ws[k - 1] === "clear" || ws[k - 1] === "cancel"));
  const queued = ws.includes("queued") || ws.some((w, k) => queueWord(w, k));
  if (queued) ws = ws.filter((w, k) => w !== "queued" && !queueWord(w, k));
  const head = readVerb(ws);
  const verb = head?.[0] ?? null;
  let i = head?.[1] ?? 0;
  const rest = (): VoiceTarget | undefined => readTarget(ws, i, lex);
  const done = (intent: VoiceIntent, v: string = verb ?? inherited ?? ""): { intent: VoiceIntent; verb: string } => ({
    intent: queued && intent.kind === "order" ? { ...intent, queued: true } : intent,
    verb: v,
  });

  // “全选屏幕”/“select all on screen” 会被读成 “select army” + “screen” 两个词；说了屏幕就以屏幕为准。
  if (verb === "army" && ws.slice(i).includes("screen")) return { intent: { kind: "select", what: "screen" }, verb: "select" };

  switch (verb) {
    case "rally":
      return done(readRally(ws, i, lex), "rally");
    case "move": case "attack": case "attackmove": case "patrol": case "attackground": case "smart": {
      // "move two footmen here", "attack with all footmen" — a subject may follow the verb.
      while (ws[i] === "with") i++;
      const sub = readSubject(ws, i, lex, false);
      if (sub && (sub.subject.counted || sub.subject.worker || sub.plural)) i = sub.end;
      const subject = sub && i === sub.end ? sub.subject : undefined;
      // "move up", "attack move north west", "move left a bit".
      const dir = readDirection(ws, i);
      if (dir) return done({ kind: "order", order: verb, target: { kind: "step", dx: dir.dx, dy: dir.dy, scale: dir.scale }, subject });
      const target = rest();
      // "Attack" on its own is the A-click at the middle of the screen: pressing A and never
      // clicking was a command that armed the card and did nothing, which is what "it cannot
      // attack" felt like. "Move" alone stays nothing — a move with no place to go is a slip.
      if (!target && (verb === "attack" || verb === "attackmove")) {
        return done({ kind: "order", order: verb, target: { kind: "screen" }, subject });
      }
      return done({ kind: "order", order: verb, target, subject });
    }
    case "follow": {
      // "follow the archmage", "follow my hero": a MOVE onto a friendly unit, which is a follow.
      const t = rest();
      return t ? done({ kind: "order", order: "smart", target: t }, "smart") : null;
    }
    case "put": {
      // The rally point: "put the rally point of the barracks on my hero".
      const r = ws.indexOf("rally");
      if (r >= 0) return done(readRally(ws, ws[r + 1] === "point" ? r + 2 : r + 1, lex), "rally");
      // A building: "put a farm here".
      let j = i;
      while (ws[j] === "a" || ws[j] === "an" || ws[j] === "the") j++;
      const b = lex.match(ws, j, ["building"]);
      if (b) { i = b.end; return done({ kind: "build", entry: b.entry, target: rest() }, "build"); }
      // Somebody, somewhere: "put all peasants on gold", "send two footmen there".
      const sub = readSubject(ws, i, lex, false);
      if (sub) i = sub.end;
      const res = resourceAhead(ws, i);
      if (res) return done({ kind: "harvest", res, subject: sub?.subject }, "harvest");
      const t = rest();
      return t || sub ? done({ kind: "order", order: "move", target: t, subject: sub?.subject }, "move") : null;
    }
    case "retreat": return done({ kind: "retreat", target: rest() });
    case "teleport": {
      // "tp out", "teleport back to the base", "tp out of there": the Town Portal, aimed at a
      // town hall of ours — the one said, else the main one (game/voiceActions.ts).
      const tp = lex.match(["tp"], 0, ["item"]) ?? lex.match(["town", "portal"], 0, ["item"]);
      // "Out of THERE" is where the army is leaving, not where it is going: only a named place
      // (a base, a unit) aims it.
      const t = rest();
      const to = t && t.kind !== "screen" && t.kind !== "cursor" ? t : undefined;
      return done({ kind: "useitem", entry: tp?.entry ?? { kind: "item", id: "stwp", phrase: "Scroll of Town Portal" }, target: to }, "press");
    }
    case "buy": case "sell": {
      // “买治疗药水”“买物品二”：先看是不是按格子说，再按名字匹配货架上的物品；
      // 什么都没说时把选择交给执行层——它会找最近一家有货的商店。
      let j = i;
      while (j < ws.length && (FILLER.has(ws[j]) || ws[j] === "a" || ws[j] === "an" || ws[j] === "the" || ws[j] === "some")) j++;
      if (ws[j] === "item" || ws[j] === "slot") {
        const n = NUMBERS[ws[j + 1] ?? ""];
        if (n !== undefined && n >= 1 && n <= 6) {
          return done(verb === "buy" ? { kind: "buy", slot: n - 1 } : { kind: "sell", slot: n - 1 });
        }
        j++;
      }
      const m = lex.match(ws, j, ["item"]);
      if (m) return done(verb === "buy" ? { kind: "buy", entry: m.entry } : { kind: "sell", entry: m.entry });
      return done(verb === "buy" ? { kind: "buy" } : { kind: "sell" });
    }
    case "revive": {
      // “复活英雄”/“复活大法师”：点名的按名字找，否则交给执行层挑最近阵亡的一位。
      while (i < ws.length && (FILLER.has(ws[i]) || MINE_WORDS.has(ws[i]) || ws[i] === "hero")) i++;
      const m = lex.match(ws, i, ["hero"]);
      return done(m ? { kind: "revive", entry: m.entry } : { kind: "revive" });
    }
    case "board": {
      while (i < ws.length && (FILLER.has(ws[i]) || ws[i] === "the" || ws[i] === "into" || ws[i] === "onto")) i++;
      const t = readTarget(ws, i, lex);
      return done(t ? { kind: "board", target: t } : { kind: "board" });
    }
    case "unload": return done({ kind: "unload" });
    case "repair": {
      // “修理农场”“修理这里”：点名建筑按名字，否则交给执行层找最近的受损建筑。
      while (i < ws.length && (FILLER.has(ws[i]) || MINE_WORDS.has(ws[i]) || ws[i] === "building")) i++;
      const b = lex.match(ws, i, ["building"]);
      if (b) return done({ kind: "repair", entry: b.entry, target: readTarget(ws, b.end, lex) });
      const t = readTarget(ws, i, lex);
      return done(t ? { kind: "repair", target: t } : { kind: "repair" });
    }
    case "auto-repair": {
      const off = ws[i] === "off" || ws[i] === "stop" || ws[i] === "disable" || ws[i] === "cancel";
      return done({ kind: "autorepair", on: !off });
    }
    case "sharevision": case "sharecontrol": {
      let on = true;
      if (ws[i] === "off" || ws[i] === "stop" || ws[i] === "no" || ws[i] === "disable" || ws[i] === "cancel") { on = false; i++; }
      const t = readTarget(ws, i, lex);
      return done(t
        ? { kind: "diplomacy", action: verb === "sharevision" ? "vision" : "control", on, target: t }
        : { kind: "diplomacy", action: verb === "sharevision" ? "vision" : "control", on });
    }
    case "diplomacy": return done({ kind: "diplomacy", action: "status", on: true, target: readTarget(ws, i, lex) });
    case "ping": return done({ kind: "ping", target: readTarget(ws, i, lex) });
    case "ungroupone": {
      // “把步兵从二队移除”/“remove the footman from group 2”：组号和单位名可以任意顺序。
      let n: number | undefined;
      let entry: LexEntry | undefined;
      for (let j = i; j < ws.length;) {
        const a = NUMBERS[ws[j] ?? ""];
        const b = NUMBERS[ws[j + 1] ?? ""];
        if (ws[j] === "group" && b !== undefined) { n = b % 10; j += 2; continue; }
        if ((ws[j + 1] === "group" || ws[j + 1] === "team") && a !== undefined) { n = a % 10; j += 2; continue; }
        const m = lex.match(ws, j, ["unit", "hero"]);
        if (m) { entry = m.entry; j = m.end; continue; }
        j++;
      }
      return done({ kind: "ungroupone", n, ...(entry ? { entry } : {}) });
    }
    case "subgroupnext": return done({ kind: "subgroup", next: true });
    case "subgroupprev": return done({ kind: "subgroup", next: false });
    case "subgroup": {
      const n = NUMBERS[ws[i] ?? ""];
      return done(n !== undefined ? { kind: "subgroup", index: (n % 10) || 10 } : { kind: "subgroup", next: true });
    }
    case "selectidle": return done({ kind: "select", what: "idle" });
    case "focus": {
      let j = i;
      while (j < ws.length && (FILLER.has(ws[j]) || MINE_WORDS.has(ws[j]))) j++;
      const m = lex.match(ws, j, ["unit", "hero"]);
      if (m) return done({ kind: "focus", target: { kind: "unit", entry: m.entry, side: "enemy" } });
      const t = readTarget(ws, j, lex);
      return done(t ? { kind: "focus", target: t } : { kind: "focus" });
    }
    case "swap": {
      // “交换物品一和三”：从后面的数字里取两个格子（1 起）。只认不会和别的词混淆的数字。
      const slot = (w: string): number | undefined => /^\d+$/.test(w) ? Number(w)
        : ({ one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 } as Record<string, number>)[w];
      const nums: number[] = [];
      for (let j = i; j < ws.length; j++) {
        const n = slot(ws[j] ?? "");
        if (n !== undefined && n >= 1 && n <= 6) nums.push(n);
      }
      return done({ kind: "swap", from: (nums[0] ?? 1) - 1, to: (nums[1] ?? 1) - 1 });
    }
    case "drop": {
      // "drop the salve" / "丢弃物品二": which carried item, by name or inventory slot.
      let j = i;
      while (j < ws.length && FILLER.has(ws[j])) j++;
      if (ws[j] === "item" || ws[j] === "slot") {
        const n = NUMBERS[ws[j + 1] ?? ""];
        if (n !== undefined && n >= 1 && n <= 6) return done({ kind: "drop", slot: n - 1 });
      }
      const m = lex.match(ws, j, ["item"]);
      return m ? done({ kind: "drop", entry: m.entry }) : null;
    }
    case "stop": return done({ kind: "stop" });
    case "hold": return done({ kind: "hold" });
    case "cancel": {
      // “取消第二队” / “cancel group 2” clears a control group, not a build/train queue.
      let j = i;
      while (j < ws.length && ws[j] === "the") j++;
      if (ws[j] === "group") {
        const n = NUMBERS[ws[j + 1] ?? ""];
        if (n !== undefined && n <= 10) return done({ kind: "group", n: n === 10 ? 0 : n, mode: "clear" });
      }
      // “取消训练步兵”/“cancel the footman”：点了名就取消队列里的那一项。
      let k = j;
      let all = false;
      while (k < ws.length && (ws[k] === "the" || ws[k] === "a" || ws[k] === "an"
        || ws[k] === "train" || ws[k] === "research" || ws[k] === "upgrade" || ws[k] === "from")) k++;
      // “cancel all footmen”：all 是整条队列/全部同名项。
      if (ALL_WORDS.has(ws[k] ?? "")) { all = true; k++; while (ws[k] === "the") k++; }
      const m = lex.match(ws, k, ["unit", "hero", "upgrade"]);
      if (m) return done({ kind: "cancelqueued", entry: m.entry, ...(all ? { all: true } : {}) });
      if (all) return done({ kind: "cancelqueued", all: true });
      return done({ kind: "cancel" });
    }
    case "cancelall": {
      // “cancel all footmen”/“取消所有步兵”：all 后面还可以点名。
      let k = i;
      while (k < ws.length && (ws[k] === "the" || ws[k] === "a" || ws[k] === "an"
        || ws[k] === "train" || ws[k] === "research" || ws[k] === "upgrade")) k++;
      const m = lex.match(ws, k, ["unit", "hero", "upgrade"]);
      return done(m ? { kind: "cancelqueued", all: true, entry: m.entry } : { kind: "cancelqueued", all: true });
    }
    case "buildmenu": return done({ kind: "cardpage", page: "build" });
    case "learnmenu": return done({ kind: "cardpage", page: "learn" });
    case "gold": return done({ kind: "harvest", res: "gold", target: rest() });
    case "lumber": return done({ kind: "harvest", res: "lumber", target: rest() });
    case "harvest": {
      const sub = readSubject(ws, i, lex, false);
      if (sub) {
        const res = resourceAhead(ws, sub.end);
        if (res) return done({ kind: "harvest", res, subject: sub.subject });
      }
      const t = rest();
      const res = t?.kind === "mine" ? "gold" : t?.kind === "trees" ? "lumber" : ws.slice(i).some((w) => w === "gold") ? "gold" : undefined;
      return done({ kind: "harvest", res, target: t });
    }
    case "army": return done({ kind: "select", what: "army" });
    case "idle": return done({ kind: "select", what: "idle" });
    case "group": case "assign": case "add": {
      while (ws[i] === "group" || ws[i] === "to") i++;
      const n = NUMBERS[ws[i] ?? ""];
      if (n === undefined || n > 10) return null;
      return done({ kind: "group", n: n === 10 ? 0 : n, mode: verb === "group" ? "recall" : verb === "assign" ? "assign" : "add" });
    }
    case "ungroup": return done({ kind: "ungroup" });
    case "camera": {
      const t = rest();
      return t ? done({ kind: "camera", target: t }) : null;
    }
    case "talkto": {
      while (i < ws.length && (FILLER.has(ws[i]) || ws[i] === "to")) i++;
      const t = readTarget(ws, i, lex);
      return t ? done({ kind: "order", order: "smart", target: t }) : null;
    }
    case "regroup": return done({ kind: "regroup" });
    case "select": {
      while (i < ws.length && (FILLER.has(ws[i]) || MINE_WORDS.has(ws[i]))) i++;
      const w = ws[i];
      // “全选屏幕”/“select all on screen”：只选画面内的单位。
      if (ws.slice(i).includes("screen")) return done({ kind: "select", what: "screen" });
      // "select army", "select all", "select everyone" — the "-" key's army.
      if (w === undefined || w === "army" || ((ALL_WORDS.has(w)) && (ws[i + 1] === undefined || ws[i + 1] === "army" || ws[i + 1] === "units"))) {
        return done({ kind: "select", what: "army" });
      }
      if (stem(w) === "hero") {
        const n = NUMBERS[ws[i + 1] ?? ""];
        return done({ kind: "select", what: "hero", index: n ? n - 1 : 0 });
      }
      const sub = readSubject(ws, i, lex, true);
      return sub ? done({ kind: "select", what: "subject", subject: sub.subject }) : null;
    }
    case "train": {
      while (ws[i] === "the") i++;
      const [count, j] = readCount(ws, i);
      i = j;
      const m = lex.match(ws, i, ["unit", "hero"]);
      if (m) return done({ kind: "train", entry: m.entry, count: Math.max(1, Math.min(count, 12)) });
      // "make a farm": the player said make, the game calls it build.
      const b = lex.match(ws, i, ["building"]);
      if (b) { i = b.end; return done({ kind: "build", entry: b.entry, target: rest() }, "build"); }
      return pressByName(ws, i, lex, done);
    }
    case "build": {
      while (ws[i] === "a" || ws[i] === "an") i++;
      const b = lex.match(ws, i, ["building"]);
      if (b) { i = b.end; return done({ kind: "build", entry: b.entry, target: rest() }); }
      // "build three footmen" — said build, meant train.
      const [count, j] = readCount(ws, i);
      const u = lex.match(ws, j, ["unit", "hero"]);
      if (u) return done({ kind: "train", entry: u.entry, count }, "train");
      return null;
    }
    case "finish": {
      // "finish the altar", "finish building the farm", "complete all buildings", "resume construction".
      let all = false;
      while (i < ws.length && (FILLER.has(ws[i]) || MINE_WORDS.has(ws[i]) || ALL_WORDS.has(ws[i]) || ws[i] === "building" || ws[i] === "constructing" || ws[i] === "construction" || ws[i] === "a")) {
        if (ALL_WORDS.has(ws[i])) all = true;
        i++;
      }
      const b = lex.match(ws, i, ["building"]);
      return done({ kind: "finish", entry: b?.entry, all });
    }
    case "research": {
      const m = lex.match(ws, i, ["upgrade", "button"]);
      return m ? done({ kind: "research", entry: m.entry }) : null;
    }
    case "learn": {
      const m = lex.match(ws, i, ["ability", "button"]);
      return m ? done({ kind: "learn", entry: m.entry }) : null;
    }
    case "auto-on": case "auto-off": case "autocast": {
      let on = verb !== "auto-off";
      const m = lex.match(ws, i, ["ability", "button"]);
      if (!m) return null;
      if (ws[m.end] === "off") on = false;
      return done({ kind: "autocast", entry: m.entry, on });
    }
    case "pickitem": {
      // "pick up the potion", "grab that", "拾取它": the item's name if it has one; otherwise
      // the nearest item in sight (game/voiceActions.ts). "all" turns it into a sweep.
      let j = i;
      while (j < ws.length && (FILLER.has(ws[j]) || ["up", "a", "an", "the", "it", "that", "this", "item", "items", "ground", "on", "from"].includes(ws[j]))) j++;
      const all = ws.slice(i).some((w) => w === "all" || w === "everything");
      const m = lex.match(ws, j, ["item"]);
      return m ? done({ kind: "pick", entry: m.entry, all }) : done({ kind: "pick", all });
    }
    case "lootall": return done({ kind: "pick", all: true });
    case "heal": return done({ kind: "heal" });
    case "giveitem": {
      // "give the salve to the hero": the item first, then "to <hero>".
      let j = i;
      while (j < ws.length && (FILLER.has(ws[j]) || ws[j] === "a" || ws[j] === "an" || ws[j] === "the")) j++;
      const m = lex.match(ws, j, ["item"]);
      if (!m) return null;
      let k = m.end;
      while (k < ws.length && (FILLER.has(ws[k]) || ws[k] === "to" || ws[k] === "for")) k++;
      const t = readTarget(ws, k, lex);
      return t ? done({ kind: "give", entry: m.entry, target: t }) : null;
    }
    case "press": {
      // "use slot two" / "use item one" — the inventory by number.
      if (ws[i] === "item" || ws[i] === "slot") {
        const n = NUMBERS[ws[i + 1] ?? ""];
        if (n !== undefined && n >= 1 && n <= 6) { i += 2; return done({ kind: "useitem", slot: n - 1, target: rest() }); }
      }
      return pressByName(ws, i, lex, done);
    }
    default:
      break;
  }

  // No verb of its own. A clause after "and" carries the previous one on ("select footmen and
  // riflemen", "train two footmen and a priest").
  if (inherited === "select" || inherited === "train") {
    const kinds: LexEntry["kind"][] = ["unit", "hero", "building"];
    const [count, j] = inherited === "train" ? readCount(ws, 0) : [1, 0];
    const m = lex.match(ws, j, kinds);
    if (m) {
      if (inherited === "train") return done({ kind: "train", entry: m.entry, count }, inherited);
    }
    if (inherited === "select") {
      const sub = readSubject(ws, 0, lex, true);
      if (sub) return done({ kind: "select", what: "subject", subject: sub.subject }, inherited);
    }
  }
  // A SUBJECT first: "all peasants on gold", "two peasants to wood", "footmen attack move here".
  const sub = readSubject(ws, 0, lex, false);
  if (sub && (sub.subject.counted || sub.subject.worker || sub.plural)) {
    const res = resourceAhead(ws, sub.end);
    if (res) return done({ kind: "harvest", res, subject: sub.subject }, "harvest");
    const after = parseClause(ws.slice(sub.end), ctx, null);
    if (after && (after.intent.kind === "order" || after.intent.kind === "harvest")) {
      after.intent.subject ??= sub.subject;
      return after;
    }
  }
  // …and otherwise it is a BUTTON's name: "storm bolt the hero", "blizzard here", "footman".
  return pressByName(ws, 0, lex, done);
}

/**
 * Read a SUBJECT — who an order is for — from `at`: [all | a count] [idle] (worker word | unit
 * name) [from gold | wood]. `allowFrom` reads the trailing resource as a FILTER ("select one
 * worker from wood"); without it the resource is left for the verb ("put all peasants ON GOLD"
 * is a destination). `plural` says the name was said in the plural ("peasants").
 */
export function readSubject(
  ws: readonly string[],
  at: number,
  lex: Lexicon,
  allowFrom: boolean,
): { subject: Subject; end: number; plural: boolean } | null {
  let i = at;
  let count: number | "all" | undefined;
  let idle = false;
  const skip = (): void => { while (ws[i] === "the" || ws[i] === "my" || ws[i] === "our" || ws[i] === "of") i++; };
  skip();
  // "A"/"an" is the singular, not a count: "select a peasant" means the same as "select
  // peasant" — an idle one — and only a NUMBER ("one peasant") means any one.
  if (ws[i] === "a" || ws[i] === "an") i++;
  else if (ALL_WORDS.has(ws[i] ?? "")) { count = "all"; i++; }
  else if (ws[i] !== undefined && !NOT_COUNTS.has(ws[i]) && NUMBERS[ws[i]] !== undefined) { count = NUMBERS[ws[i]]; i++; }
  skip();
  if (ws[i] === "idle" || ws[i] === "lazy" || ws[i] === "free") { idle = true; i++; }
  let entry: LexEntry | undefined;
  let worker = false;
  let plural = false;
  const w = ws[i];
  if (w === undefined) return null;
  if (WORKER_WORDS.has(w)) {
    worker = true;
    plural = stem(w) !== w;
    i++;
  } else {
    // SELECTING may name a building ("select altar", "select my main building"); an order's
    // subject is somebody who walks.
    const m = lex.match(ws, i, allowFrom ? ["unit", "hero", "building"] : ["unit", "hero"]);
    if (!m) return null;
    entry = m.entry;
    const last = ws[m.end - 1];
    plural = stem(last) !== last;
    i = m.end;
  }
  // "fiend 4", "fiend number four", "footman #2": the number on its voice label. The homophones a
  // count refuses ("to", "for") are numbers here only at the end of the sentence, where no
  // preposition can follow.
  let index: number | undefined;
  {
    let j = i;
    if (ws[j] === "number" || ws[j] === "no" || ws[j] === "num") j++;
    const n = ws[j] !== undefined && ws[j] !== "a" && ws[j] !== "an" && (!NOT_COUNTS.has(ws[j]) || j === ws.length - 1) ? NUMBERS[ws[j]] : undefined;
    if (n !== undefined && n >= 1) { index = n; i = j + 1; plural = false; }
  }
  let from: "gold" | "lumber" | undefined;
  if (allowFrom) {
    let j = i;
    while (j < ws.length && FROM_WORDS.has(ws[j])) j++;
    if (j > i || j === i) {
      if (GOLD_WORDS.has(ws[j] ?? "") || (ws[j] === "gold" && ws[j + 1] === "mine")) from = "gold";
      else if (LUMBER_WORDS.has(ws[j] ?? "")) from = "lumber";
      if (from) i = j + 1 + (ws[j + 1] === "mine" ? 1 : 0);
    }
  }
  return {
    subject: { entry, worker, count: count ?? (plural ? "all" : 1), counted: count !== undefined, idle, from, index },
    end: i,
    plural,
  };
}

/** A resource named anywhere after `at` ("on gold", "to the gold mine", "chop wood"). */
function resourceAhead(ws: readonly string[], at: number): "gold" | "lumber" | undefined {
  for (let i = at; i < ws.length; i++) {
    if (ws[i] === "gold" || ws[i] === "mine" || ws[i] === "mines" || ws[i] === "mining") return "gold";
    if (LUMBER_WORDS.has(ws[i]) || ws[i] === "chop" || ws[i] === "chopping") return "lumber";
  }
  return undefined;
}

/** The rest of a rally clause, after "rally (point)": [of | for] [the] <building> <target>.
 *  Without a building it is the selected building's rally. */
function readRally(ws: readonly string[], at: number, lex: Lexicon): VoiceIntent {
  let i = at;
  while (ws[i] === "point" || ws[i] === "of" || ws[i] === "for" || ws[i] === "from" || ws[i] === "the" || ws[i] === "my" || ws[i] === "our") i++;
  const b = lex.match(ws, i, ["building"]);
  if (b) i = b.end;
  return { kind: "order", order: "rally", target: readTarget(ws, i, lex), source: b?.entry };
}

function pressByName(
  ws: readonly string[],
  at: number,
  lex: Lexicon,
  done: (intent: VoiceIntent, v?: string) => { intent: VoiceIntent; verb: string },
): { intent: VoiceIntent; verb: string } | null {
  let i = at;
  while (i < ws.length && FILLER.has(ws[i])) i++;
  const m = lex.match(ws, i, ["button", "ability", "item"]);
  if (!m) return null;
  const target = readTarget(ws, m.end, lex);
  if (m.entry.kind === "item") return done({ kind: "useitem", entry: m.entry, target }, "press");
  return done({ kind: "press", entry: m.entry, target }, "press");
}

/** A one-line reading of an intent, for the echo the player sees ("Train 3 × Footman"). */
const D = (k: MessageKey, v?: Record<string, string | number>): string => t(k, v);

/** A panel's name as the console calls it, in the player's language ("quest log", "任务面板"). */
function panelName(id: string): string {
  const known = ["quests", "menu", "allies", "chat", "hero", "inventory", "score", "log"];
  return known.includes(id) ? D(`voice.d.panel.${id}` as MessageKey) : id;
}

export function describe(i: VoiceIntent): string {
  const to = (x?: VoiceTarget): string => {
    if (!x) return "";
    switch (x.kind) {
      case "screen": return ` → ${D("voice.d.here")}`;
      case "cursor": return ` → ${D("voice.d.cursor")}`;
      case "region": return ` → ${regionWords(x.region)}`;
      case "step": return ` → ${[x.dy > 0 ? D("voice.d.reg.top") : x.dy < 0 ? D("voice.d.reg.bottom") : "", x.dx > 0 ? D("voice.d.reg.right") : x.dx < 0 ? D("voice.d.reg.left") : ""].join("")}${x.scale < 1 ? D("voice.d.reg.middle") : ""}`;
      case "unit": return ` → ${x.side === "enemy" ? `${D("voice.d.enemy")} ` : x.side === "mine" ? `${D("voice.d.my")} ` : ""}${x.entry.phrase}`;
      case "hero": return ` → ${x.side === "enemy" ? `${D("voice.d.enemy")} ` : x.side === "mine" ? `${D("voice.d.my")} ` : ""}${D("voice.d.hero")}`;
      case "base": return ` → ${x.side === "enemy" ? D("voice.d.enemy") : D("voice.d.my")} ${D("voice.d.base")}`;
      case "mine": return ` → ${x.pick === "next" ? `${D("voice.d.another")} ` : ""}${D("voice.d.mine")}${x.region ? ` (${regionWords(x.region)})` : ""}`;
      case "trees": return ` → ${D("voice.d.trees")}`;
      case "army": return ` → ${D("voice.d.army")}`;
      case "creeps": return ` → ${x.pick === "next" ? `${D("voice.d.another")} ` : ""}${x.tier ? `${x.tier} ` : ""}${D("voice.d.creeps")}${x.region ? ` (${regionWords(x.region)})` : ""}`;
      case "enemies": return ` → ${D("voice.d.enemies")}${x.region ? ` (${regionWords(x.region)})` : ""}`;
      case "grounditem": return x.entry ? ` → ${x.entry.phrase}` : "";
    }
  };
  const order = { move: "move", attack: "attack", attackmove: "attackmove", patrol: "patrol", attackground: "attackground", rally: "rally", smart: "smart" }[i.kind === "order" ? i.order : "move"];
  switch (i.kind) {
    case "order": return `${i.subject ? `${who(i.subject)}: ` : ""}${i.source ? `${i.source.phrase} ` : ""}${D(`voice.d.${order}` as MessageKey)}${to(i.target)}`;
    case "retreat": return `${D("voice.d.retreat")}${to(i.target) || ` → ${D("voice.d.home")}`}`;
    case "stop": return D("voice.d.stop");
    case "hold": return D("voice.d.hold");
    case "cancel": return D("voice.d.cancel");
    case "cancelqueued": return i.all
      ? D(i.entry ? "voice.d.cancelAllQueued" : "voice.d.clearQueue", { name: i.entry?.phrase ?? "" })
      : D("voice.d.cancelQueued", { name: i.entry?.phrase ?? "" });
    case "cardpage": return D(i.page === "build" ? "voice.d.buildMenu" : "voice.d.learnMenu");
    case "harvest": return `${i.subject ? `${who(i.subject)}: ` : ""}${D("voice.d.harvest")}${i.res ? ` ${i.res === "gold" ? D("voice.d.gold") : D("voice.d.lumber")}` : ""}${to(i.target)}`;
    case "train": return D("voice.d.train", { count: i.count > 1 ? i.count : 1, name: i.entry.phrase });
    case "build": return `${D("voice.d.build", { name: i.entry.phrase })}${to(i.target)}`;
    case "finish": return i.entry ? D("voice.d.finish", { name: i.entry.phrase }) : D(i.all ? "voice.d.finishAll" : "voice.d.finishOne");
    case "research": return D("voice.d.research", { name: i.entry.phrase });
    case "learn": return D("voice.d.learn", { name: i.entry.phrase });
    case "press": return `${i.entry.phrase}${to(i.target)}`;
    case "autocast": return D("voice.d.autocast", { name: i.entry.phrase, state: D(i.on ? "voice.d.on" : "voice.d.off") });
    case "useitem": return D("voice.d.use", { name: i.entry?.phrase ?? D("voice.d.item", { n: (i.slot ?? 0) + 1 }) }) + to(i.target);
    case "buy": return D("voice.d.buy", { name: i.entry?.phrase ?? D("voice.d.item", { n: (i.slot ?? 0) + 1 }) });
    case "sell": return D("voice.d.sell", { name: i.entry?.phrase ?? D("voice.d.item", { n: (i.slot ?? 0) + 1 }) });
    case "revive": return i.entry ? D("voice.d.reviveName", { name: i.entry.phrase }) : D("voice.d.revive");
    case "board": return `${D("voice.d.board")}${to(i.target)}`;
    case "unload": return D("voice.d.unload");
    case "repair": return i.entry ? D("voice.d.repairName", { name: i.entry.phrase }) : D("voice.d.repair");
    case "autorepair": return D(i.on ? "voice.d.autoRepairOn" : "voice.d.autoRepairOff");
    case "diplomacy": return i.action === "status" ? D("voice.d.allianceList") : i.action === "vision"
      ? D(i.on ? "voice.d.shareVisionOn" : "voice.d.shareVisionOff")
      : D(i.on ? "voice.d.shareControlOn" : "voice.d.shareControlOff");
    case "ping": return `${D("voice.d.ping")}${to(i.target)}`;
    case "ungroupone": return D("voice.d.ungroupOne", { n: String(i.n ?? 1) });
    case "subgroup": return i.next === false ? D("voice.d.subgroupPrev")
      : i.index !== undefined ? D("voice.d.subgroupN", { n: String(i.index) }) : D("voice.d.subgroupNext");
    case "focus": return i.target && "entry" in i.target && i.target.entry ? D("voice.d.focusName", { name: i.target.entry.phrase }) : D("voice.d.focus");
    case "swap": return D("voice.d.swap", { from: String(i.from + 1), to: String(i.to + 1) });
    case "pick": return i.all ? D("voice.d.loot")
      : i.entry ? D("voice.d.pickName", { name: i.entry.phrase }) : D("voice.d.pickAny");
    case "give": return D("voice.d.give", { name: i.entry?.phrase ?? D("voice.d.item", { n: (i.slot ?? 0) + 1 }) }) + to(i.target);
    case "drop": return D("voice.d.drop", { name: i.entry?.phrase ?? D("voice.d.item", { n: (i.slot ?? 0) + 1 }) });
    case "heal": return D("voice.d.heal");
    case "select": return i.what === "army" ? D("voice.d.selectArmy") : i.what === "idle" ? D("voice.d.selectIdle") : i.what === "hero" ? D("voice.d.selectHero", { n: (i.index ?? 0) + 1 }) : i.what === "screen" ? D("voice.d.selectScreen") : D("voice.d.select", { who: who(i.subject) });
    case "group": return D(i.mode === "recall" ? "voice.d.groupRecall" : i.mode === "assign" ? "voice.d.groupAssign" : i.mode === "clear" ? "voice.d.groupClear" : "voice.d.groupAdd", { n: i.n });
    case "ungroup": return D("voice.d.ungroup");
    case "camera": return `${D("voice.d.camera")}${to(i.target)}`;
    case "panel": return D(i.open === false ? "voice.d.close" : "voice.d.open", { what: panelName(i.panel) });
    case "pause": return D(i.on ? "voice.d.pause" : "voice.d.resume");
    case "cinematic": return D("voice.d.cinematic");
    case "quest": return i.mode === "list" ? D("voice.d.questList")
      : i.mode === "progress" ? D("voice.d.questProgress")
      : i.mode === "next" ? D("voice.d.questNext")
      : i.mode === "previous" ? D("voice.d.questPrev")
      : D("voice.d.quest");
    case "dialog": return i.choice ? D(`voice.d.dialog.${i.choice}`)
      : i.index === undefined ? D("voice.d.dialogFirst") : D("voice.d.dialog", { n: i.index + 1 });
    case "regroup": return D("voice.d.regroup");
    case "chat": return i.text ? D("voice.d.chat", { scope: i.scope ? ` (${i.scope === "all" ? D("voice.d.all") : D("voice.d.allies")})` : "", text: i.text }) : D("voice.d.openChat");
  }
}

function regionWords(r: Region): string {
  const y = r.y === 1 ? D("voice.d.reg.top") : r.y === -1 ? D("voice.d.reg.bottom") : r.y === 0 ? D("voice.d.reg.middle") : "";
  const x = r.x === 1 ? D("voice.d.reg.right") : r.x === -1 ? D("voice.d.reg.left") : r.x === 0 && r.y !== 0 ? D("voice.d.reg.middle") : "";
  return [y, x].filter(Boolean).join("") || D("voice.d.reg.map");
}

/** A subject in words: "all Peasants", "1 idle worker", "1 worker from lumber". */
function who(sub?: Subject): string {
  if (!sub) return "";
  const name = sub.worker ? D("voice.d.worker") : sub.entry?.phrase ?? D("voice.d.unit");
  if (sub.index !== undefined) return `${name} ${sub.index}`;
  const n = sub.count === "all" ? D("voice.d.all") : String(sub.count);
  return `${n}${sub.idle ? ` ${D("voice.d.idle")}` : ""} ${name}${sub.from ? ` ${D("voice.d.from", { res: sub.from === "gold" ? D("voice.d.gold") : D("voice.d.lumber") })}` : ""}`;
}
