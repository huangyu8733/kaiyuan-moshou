// Headless check of Voice Control's MAPPING — what the recogniser heard → the intents the match
// carries out (src/voice/parser.ts). Run: pnpm sim:test
//
// The parser is the whole of "understanding" in Voice Control: there is no language model, by
// design (src/voice/model.ts says why), so every phrase a player is promised in the Options
// tooltip is pinned here. The lexicon is a hand-made slice of what a match hands in — the card's
// buttons, the race's tech tree, the units on screen — using the game's own names.
const { join } = require("node:path");
const REPO = join(__dirname, "..");
require("node:fs").writeFileSync(join(REPO, ".sim-build", "package.json"), '{"type":"commonjs"}');
const { Lexicon, parse, describe, stem } = require(join(REPO, ".sim-build", "src", "voice", "parser.js"));
// The echo `describe` prints follows the UI language; these checks are the English reader's.
const { setLocale } = require(join(REPO, ".sim-build", "src", "i18n", "index.js"));
setLocale("enUS");

let fails = 0;
function check(name, ok, detail) {
  if (ok) console.log(`  ok   ${name}`);
  else { fails++; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
}

const lex = new Lexicon([
  { kind: "unit", id: "hfoo", phrase: "Footman" },
  { kind: "unit", id: "hrif", phrase: "Rifleman" },
  { kind: "unit", id: "hpea", phrase: "Peasant" },
  { kind: "hero", id: "Hblm", phrase: "Blood Mage" },
  { kind: "unit", id: "Obla", phrase: "Blademaster" },
  { kind: "building", id: "hhou", phrase: "Farm" },
  { kind: "building", id: "hbar", phrase: "Barracks" },
  { kind: "upgrade", id: "Rhme", phrase: "Iron Forged Swords" },
  { kind: "ability", id: "AHtb", phrase: "Storm Bolt" },
  { kind: "ability", id: "AUfn", phrase: "Frost Nova" },
  { kind: "ability", id: "AHhb", phrase: "Holy Light" },
  { kind: "button", id: "ability:AHbz", phrase: "Blizzard" },
  { kind: "button", id: "rally", phrase: "Set Rally Point" },
  { kind: "building", id: "hbar", phrase: "Barracks" },
  { kind: "building", id: "usep", phrase: "Crypt" },
  { kind: "hero", id: "Udea", phrase: "Death Knight" },
  { kind: "building", id: "ntav", phrase: "Tavern" },
  { kind: "building", id: "etrp", phrase: "tower" },
  { kind: "building", id: "eden", phrase: "shop" },
  { kind: "building", id: "halt", phrase: "Altar of Kings" },
  { kind: "building", id: "halt", phrase: "altar" },
  { kind: "unit", id: "ogru", phrase: "Grunt" },
  { kind: "item", id: "hslv", phrase: "Healing Salve" },
  { kind: "item", id: "stwp", phrase: "town portal" },
]);
const p = (t) => parse(t, { lexicon: lex });
const one = (t) => { const r = p(t); return r.length === 1 ? r[0] : null; };

console.log("stems");
check("footmen → footman", stem("footmen") === "footman");
check("riflemen → rifleman", stem("riflemen") === "rifleman");

console.log("orders");
let i = one("attack move here");
check("attack move here = attackmove @ screen", i?.kind === "order" && i.order === "attackmove" && i.target?.kind === "screen", JSON.stringify(i));
i = one("move to the cursor");
check("cursor only when said", i?.kind === "order" && i.order === "move" && i.target?.kind === "cursor", JSON.stringify(i));
i = one("attack the enemy hero");
check("attack the enemy hero", i?.kind === "order" && i.order === "attack" && i.target?.kind === "hero" && i.target.side === "enemy", JSON.stringify(i));
i = one("hold position");
check("hold position", i?.kind === "hold");
i = one("stop");
check("stop", i?.kind === "stop");

console.log("production");
i = one("train three footmen");
check("train three footmen", i?.kind === "train" && i.entry.id === "hfoo" && i.count === 3, JSON.stringify(i));
i = one("make a rifleman");
check("make a rifleman = 1", i?.kind === "train" && i.entry.id === "hrif" && i.count === 1, JSON.stringify(i));
const two = p("train two footmen and a rifleman");
check("train … and … inherits the verb", two.length === 2 && two[1].kind === "train" && two[1].entry.id === "hrif", JSON.stringify(two));
i = one("build a farm here");
check("build a farm here", i?.kind === "build" && i.entry.id === "hhou" && i.target?.kind === "screen", JSON.stringify(i));
i = one("build farm");
check("build farm (no place)", i?.kind === "build" && i.entry.id === "hhou" && !i.target, JSON.stringify(i));
i = one("research iron forged swords");
check("research", i?.kind === "research" && i.entry.id === "Rhme", JSON.stringify(i));
i = one("train blade master");
check("a split compound still names the unit", i?.kind === "train" && i.entry.id === "Obla", JSON.stringify(i));

console.log("spells");
i = one("use frost nova");
check("use frost nova = press, no target (assist)", i?.kind === "press" && i.entry.id === "AUfn" && !i.target, JSON.stringify(i));
i = one("storm bolt the enemy hero");
check("storm bolt the enemy hero", i?.kind === "press" && i.entry.id === "AHtb" && i.target?.kind === "hero" && i.target.side === "enemy", JSON.stringify(i));
i = one("blizzard here");
check("blizzard here (a card button)", i?.kind === "press" && i.entry.id === "ability:AHbz" && i.target?.kind === "screen", JSON.stringify(i));
i = one("holy light my hero");
check("holy light my hero", i?.kind === "press" && i.target?.kind === "hero" && i.target.side === "mine", JSON.stringify(i));

console.log("selection & groups");
i = one("select all footmen");
check("select all footmen", i?.kind === "select" && i.what === "subject" && i.subject.entry.id === "hfoo" && i.subject.count === "all", JSON.stringify(i));
i = one("select army");
check("select army", i?.kind === "select" && i.what === "army");
i = one("select all on screen");
check("select all on screen", i?.kind === "select" && i.what === "screen", JSON.stringify(i));
i = one("select all");
check("select all = army", i?.kind === "select" && i.what === "army");
for (const w of ["peasant", "worker", "peon"]) {
  i = one(`select ${w}`);
  check(`select ${w} = one IDLE worker`, i?.kind === "select" && i.subject?.worker && i.subject.count === 1 && !i.subject.counted, JSON.stringify(i));
}
i = one("select one worker");
check("select one worker = any one", i?.kind === "select" && i.subject?.worker && i.subject.count === 1 && i.subject.counted, JSON.stringify(i));
i = one("select one worker from wood");
check("select one worker from wood", i?.kind === "select" && i.subject?.from === "lumber" && i.subject.count === 1, JSON.stringify(i));
i = one("select two peasants that are mining gold");
check("select two peasants mining gold", i?.kind === "select" && i.subject?.from === "gold" && i.subject.count === 2, JSON.stringify(i));
i = one("select idle peasants");
check("select idle peasants = all idle", i?.kind === "select" && i.subject?.idle && i.subject.count === "all", JSON.stringify(i));
i = one("group two");
check("group two", i?.kind === "group" && i.n === 2 && i.mode === "recall", JSON.stringify(i));
i = one("make group three");
check("make group three", i?.kind === "group" && i.n === 3 && i.mode === "assign", JSON.stringify(i));

console.log("gathering & rally");
i = one("put all peasants on gold");
check("put all peasants on gold", i?.kind === "harvest" && i.res === "gold" && i.subject?.worker && i.subject.count === "all", JSON.stringify(i));
i = one("send two workers to wood");
check("send two workers to wood", i?.kind === "harvest" && i.res === "lumber" && i.subject?.count === 2, JSON.stringify(i));
i = one("all peasants to the gold mine");
check("subject first, no verb", i?.kind === "harvest" && i.res === "gold" && i.subject?.count === "all", JSON.stringify(i));
i = one("put the rally point of barracks on my hero");
check("rally of barracks on my hero", i?.kind === "order" && i.order === "rally" && i.source?.id === "hbar" && i.target?.kind === "hero" && i.target.side === "mine", JSON.stringify(i));
i = one("put the rally point of the crypt on the death knight");
check("rally of crypt on the death knight", i?.kind === "order" && i.order === "rally" && i.source?.id === "usep" && i.target?.kind === "unit" && i.target.entry.id === "Udea", JSON.stringify(i));
i = one("set rally point here");
check("set rally point here (selected)", i?.kind === "order" && i.order === "rally" && !i.source && i.target?.kind === "screen", JSON.stringify(i));
i = one("send all footmen here");
check("send all footmen here = move", i?.kind === "order" && i.order === "move" && i.subject?.entry.id === "hfoo" && i.target?.kind === "screen", JSON.stringify(i));
i = one("build a tower");
check("build a tower (race term)", i?.kind === "build" && i.entry.id === "etrp", JSON.stringify(i));
i = one("build a shop");
check("build a shop (race term)", i?.kind === "build" && i.entry.id === "eden", JSON.stringify(i));

console.log("finish & items");
i = one("finish the altar");
check("finish the altar", i?.kind === "finish" && i.entry?.id === "halt" && !i.all, JSON.stringify(i));
i = one("finish building the altar of kings");
check("finish building the altar of kings", i?.kind === "finish" && i.entry?.id === "halt", JSON.stringify(i));
i = one("complete all buildings");
check("complete all buildings", i?.kind === "finish" && !i.entry && i.all, JSON.stringify(i));
i = one("select a peasant");
check("select a peasant = idle one (a is not a count)", i?.kind === "select" && i.subject?.worker && !i.subject.counted && i.subject.count === 1, JSON.stringify(i));
i = one("use healing salve on grunt");
check("use healing salve on grunt", i?.kind === "useitem" && i.entry?.id === "hslv" && i.target?.kind === "unit" && i.target.entry.id === "ogru", JSON.stringify(i));
i = one("use town portal");
check("use town portal", i?.kind === "useitem" && i.entry?.id === "stwp" && !i.target, JSON.stringify(i));
i = one("drop the healing salve");
check("drop the healing salve", i?.kind === "drop" && i.entry?.id === "hslv", JSON.stringify(i));
i = one("buy healing salve");
check("buy healing salve", i?.kind === "buy" && i.entry?.id === "hslv", JSON.stringify(i));
i = one("sell item 1");
check("sell item 1", i?.kind === "sell" && i.slot === 0, JSON.stringify(i));
i = one("revive the blood mage");
check("revive the blood mage", i?.kind === "revive" && i.entry?.id === "Hblm", JSON.stringify(i));
i = one("revive hero");
check("revive hero (no name)", i?.kind === "revive" && !i.entry, JSON.stringify(i));
i = one("load the transport");
check("load the transport", i?.kind === "board" && !i.target, JSON.stringify(i));
i = one("unload");
check("unload", i?.kind === "unload", JSON.stringify(i));
i = one("repair the tower");
check("repair the tower", i?.kind === "repair" && i.entry?.id === "etrp", JSON.stringify(i));
i = one("repair");
check("repair (anything damaged)", i?.kind === "repair" && !i.entry, JSON.stringify(i));
i = one("auto repair");
check("auto repair on", i?.kind === "autorepair" && i.on, JSON.stringify(i));
i = one("auto repair off");
check("auto repair off", i?.kind === "autorepair" && !i.on, JSON.stringify(i));
i = one("share vision");
check("share vision", i?.kind === "diplomacy" && i.action === "vision" && i.on, JSON.stringify(i));
i = one("share control off");
check("share control off", i?.kind === "diplomacy" && i.action === "control" && !i.on, JSON.stringify(i));
i = one("ally status");
check("ally status", i?.kind === "diplomacy" && i.action === "status", JSON.stringify(i));
i = one("signal here");
check("signal here", i?.kind === "ping" && i.target?.kind === "screen", JSON.stringify(i));
i = one("queue move here");
check("queue move here", i?.kind === "order" && i.order === "move" && i.queued === true, JSON.stringify(i));
i = one("remove the footman from group 2");
check("remove the footman from group 2", i?.kind === "ungroupone" && i.n === 2 && i.entry?.id === "hfoo", JSON.stringify(i));
i = one("next subgroup");
check("next subgroup", i?.kind === "subgroup" && i.next === true, JSON.stringify(i));
i = one("previous subgroup");
check("previous subgroup", i?.kind === "subgroup" && i.next === false, JSON.stringify(i));
i = one("subgroup 2");
check("subgroup 2", i?.kind === "subgroup" && i.index === 2, JSON.stringify(i));
i = one("next idle worker");
check("next idle worker", i?.kind === "select" && i.what === "idle", JSON.stringify(i));
i = one("focus fire the footman");
check("focus fire the footman", i?.kind === "focus" && i.target?.kind === "unit" && i.target.entry.id === "hfoo", JSON.stringify(i));
i = one("swap item 1 and 3");
check("swap item 1 and 3", i?.kind === "swap" && i.from === 0 && i.to === 2, JSON.stringify(i));
i = one("cancel the footman");
check("cancel the footman", i?.kind === "cancelqueued" && i.entry?.id === "hfoo", JSON.stringify(i));
i = one("build menu");
check("build menu", i?.kind === "cardpage" && i.page === "build", JSON.stringify(i));
i = one("skill menu");
check("skill menu", i?.kind === "cardpage" && i.page === "learn", JSON.stringify(i));
i = one("clear queue");
check("clear queue", i?.kind === "cancelqueued" && i.all === true && !i.entry, JSON.stringify(i));
i = one("cancel all footmen");
check("cancel all footmen", i?.kind === "cancelqueued" && i.all === true && i.entry?.id === "hfoo", JSON.stringify(i));
i = one("hire the blood mage");
check("hire the blood mage", i?.kind === "train" && i.entry?.id === "Hblm", JSON.stringify(i));
i = one("rally army");
check("rally army = regroup", i?.kind === "regroup", JSON.stringify(i));
i = one("regroup army");
check("regroup army = regroup", i?.kind === "regroup", JSON.stringify(i));
i = one("ungroup");
check("ungroup", i?.kind === "ungroup", JSON.stringify(i));
i = one("cancel group 3");
check("cancel group 3 = clear control group", i?.kind === "group" && i.n === 3 && i.mode === "clear", JSON.stringify(i));

console.log("camera");
i = one("move the camera to the tavern");
check("camera to the tavern", i?.kind === "camera" && i.target.kind === "unit" && i.target.entry.id === "ntav", JSON.stringify(i));
i = one("camera to another creep camp");
check("camera to another creep camp", i?.kind === "camera" && i.target.kind === "creeps" && i.target.pick === "next", JSON.stringify(i));
i = one("move the camera to another gold mine");
check("camera → another gold mine (not a MOVE order)", i?.kind === "camera" && i.target.kind === "mine" && i.target.pick === "next", JSON.stringify(i));
i = one("move the camera to a gold mine on the right side of the map");
check("camera → gold mine, right side", i?.kind === "camera" && i.target.kind === "mine" && i.target.region?.x === 1 && i.target.region.y === null, JSON.stringify(i));
i = one("camera top left");
check("camera top left = a region", i?.kind === "camera" && i.target.kind === "region" && i.target.region.x === -1 && i.target.region.y === 1, JSON.stringify(i));
i = one("look at my base");
check("look at my base", i?.kind === "camera" && i.target.kind === "base" && i.target.side === "mine", JSON.stringify(i));
i = one("show the enemy base");
check("show the enemy base", i?.kind === "camera" && i.target.kind === "base" && i.target.side === "enemy", JSON.stringify(i));

console.log("panels, pause & chat");
i = one("open the quest log");
check("open the quest log", i?.kind === "panel" && i.panel === "quests" && i.open === true, JSON.stringify(i));
i = one("close the menu");
check("close the menu", i?.kind === "panel" && i.panel === "menu" && i.open === false, JSON.stringify(i));
i = one("allies");
check("allies (toggle)", i?.kind === "panel" && i.panel === "allies" && i.open === null, JSON.stringify(i));
i = one("show the message log");
check("show the message log", i?.kind === "panel" && i.panel === "chat", JSON.stringify(i));
i = one("pause the game");
check("pause the game", i?.kind === "pause" && i.on, JSON.stringify(i));
i = one("unpause");
check("unpause", i?.kind === "pause" && !i.on, JSON.stringify(i));
i = one("暂停");
check("暂停", i?.kind === "pause" && i.on === true, JSON.stringify(i));
i = one("继续游戏");
check("继续游戏", i?.kind === "pause" && !i.on, JSON.stringify(i));
i = one("取消暂停");
check("取消暂停", i?.kind === "pause" && !i.on, JSON.stringify(i));
i = one("恢复对局");
check("恢复对局", i?.kind === "pause" && !i.on, JSON.stringify(i));
i = one("say good game to all");
check("say good game to all", i?.kind === "chat" && i.text === "good game" && i.scope === "all", JSON.stringify(i));
i = one("tell allies push the middle and then attack");
check("tell allies … (and is part of the message)", i?.kind === "chat" && i.scope === "allies" && i.text === "push the middle and then attack", JSON.stringify(p("tell allies push the middle and then attack")));
i = one("send message we need help to my team");
check("send message … to my team", i?.kind === "chat" && i.scope === "allies" && i.text === "we need help", JSON.stringify(i));
i = one("open chat");
check("open chat = the input", i?.kind === "chat" && i.text === "", JSON.stringify(i));
i = one("show the enemy base");
check("show the enemy base is still the camera", i?.kind === "camera", JSON.stringify(i));

console.log("free text (Whisper)");
i = one("Build an alter.");
check("Build an alter. (sound-alike, punctuation)", i?.kind === "build" && i.entry.id === "halt", JSON.stringify(i));
i = one("Train 3 Footmen.");
check("Train 3 Footmen. (digits, capitals)", i?.kind === "train" && i.entry.id === "hfoo" && i.count === 3, JSON.stringify(i));
i = one("Finish the altar.");
check("Finish the altar.", i?.kind === "finish" && i.entry?.id === "halt", JSON.stringify(i));
i = one("Attack-move here.");
check("Attack-move here.", i?.kind === "order" && i.order === "attackmove", JSON.stringify(i));
check("orc does not sound like ark (too short)", one("build an ark") === null, JSON.stringify(p("build an ark")));

console.log("camps, camera, fall back");
i = one("Move the camera to a green camp.");
check("camera to a green camp", i?.kind === "camera" && i.target.kind === "creeps" && i.target.tier === "green", JSON.stringify(i));
i = one("Pan the camera to another orange creep camp");
check("pan to another orange creep camp", i?.kind === "camera" && i.target.kind === "creeps" && i.target.tier === "orange" && i.target.pick === "next", JSON.stringify(i));
i = one("Move the camera back to my base.");
check("camera back to my base", i?.kind === "camera" && i.target.kind === "base" && i.target.side === "mine", JSON.stringify(i));
i = one("pan to my base");
check("pan to my base", i?.kind === "camera" && i.target.kind === "base", JSON.stringify(i));
i = one("Fall back!");
check("fall back", i?.kind === "retreat" && !i.target, JSON.stringify(i));
i = one("retreat to the gold mine");
check("retreat to the gold mine", i?.kind === "retreat" && i.target?.kind === "mine", JSON.stringify(i));
i = one("go home");
check("go home", i?.kind === "retreat", JSON.stringify(i));
i = one("Place a farm here.");
check("place a farm here", i?.kind === "build" && i.entry.id === "hhou", JSON.stringify(i));
i = one("camera to the goblin merchant");
check("camera to the goblin merchant (lexicon has it when seen)", i === null || i.kind === "camera", JSON.stringify(i));

console.log("buildings, labels, teleport, gatherers");
const lex2 = new Lexicon([
  { kind: "unit", id: "ugho", phrase: "Ghoul" },
  { kind: "unit", id: "ucry", phrase: "Crypt Fiend" },
  { kind: "unit", id: "ucry", phrase: "Fiend" },
  { kind: "building", id: "uaod", phrase: "Altar of Darkness" },
  { kind: "building", id: "uaod", phrase: "altar" },
  { kind: "building", id: "unpl", phrase: "main building" },
  { kind: "building", id: "uzig", phrase: "Ziggurat" },
  { kind: "item", id: "stwp", phrase: "tp" },
]);
const one2 = (t) => { const r = parse(t, { lexicon: lex2 }); return r.length === 1 ? r[0] : null; };
i = one2("select altar");
check("select altar = a building", i?.kind === "select" && i.subject?.entry?.id === "uaod", JSON.stringify(i));
i = one2("select my main building");
check("select my main building", i?.kind === "select" && i.subject?.entry?.id === "unpl", JSON.stringify(i));
i = one2("select fiend 4");
check("select fiend 4 = the label", i?.kind === "select" && i.subject?.entry?.id === "ucry" && i.subject.index === 4, JSON.stringify(i));
i = one2("select crypt fiend number for");
check("…number for (a homophone, at the end)", i?.subject?.index === 4, JSON.stringify(i));
i = one2("send a ghoul to gather lumber");
check("ghoul to gather lumber", i?.kind === "harvest" && i.res === "lumber" && i.subject?.entry?.id === "ugho", JSON.stringify(i));
i = one2("ghouls go collect wood");
check("ghouls collect wood", i?.kind === "harvest" && i.res === "lumber" && i.subject?.count === "all", JSON.stringify(i));
i = one2("tp out");
check("tp out = Town Portal home", i?.kind === "useitem" && i.entry?.id === "stwp" && !i.target, JSON.stringify(i));
i = one2("teleport out of there");
check("teleport out of there (not 'there')", i?.kind === "useitem" && i.entry?.id === "stwp" && !i.target, JSON.stringify(i));
i = one2("tp back to the base");
check("tp back to the base", i?.kind === "useitem" && i.target?.kind === "base", JSON.stringify(i));
i = one2("build a ziggurat");
check("build a ziggurat", i?.kind === "build" && i.entry.id === "uzig", JSON.stringify(i));

i = one2("select a collide");
check("'a collide' is heard as acolyte", i?.kind === "select" && i.subject?.worker === true, JSON.stringify(i));
i = one2("send two accolades to gold");
check("'accolades' is heard as acolytes", i?.kind === "harvest" && i.subject?.count === 2, JSON.stringify(i));
i = one2("go to gold");
check("go to gold (gathering is decided by who hears it)", i?.kind === "order" && i.target?.kind === "mine", JSON.stringify(i));

console.log("retreat, directions, follow, mishearings");
const lex3 = new Lexicon([
  { kind: "hero", id: "Hamg", phrase: "Archmage" },
  { kind: "hero", id: "Emoo", phrase: "Priestess of the Moon" },
  { kind: "item", id: "stwp", phrase: "tp" },
]);
const one3 = (t) => { const r = parse(t, { lexicon: lex3 }); return r.length === 1 ? r[0] : null; };
for (const t of ["go back", "Fallback!", "get back", "move back", "fall back"]) check(`${t} = retreat`, one3(t)?.kind === "retreat", JSON.stringify(p(t)));
check("T.P. out = Town Portal", one3("T.P. out")?.kind === "useitem", JSON.stringify(one3("T.P. out")));
check("teepee out = Town Portal", one3("teepee out")?.kind === "useitem", JSON.stringify(one3("teepee out")));
i = one3("move up");
check("move up = a step north", i?.kind === "order" && i.target?.kind === "step" && i.target.dy === 1 && i.target.dx === 0, JSON.stringify(i));
i = one3("go north west");
check("go north west", i?.target?.kind === "step" && i.target.dx === -1 && i.target.dy === 1, JSON.stringify(i));
i = one3("move up and to the left");
check("up and to the left is ONE direction", i?.target?.kind === "step" && i.target.dx === -1 && i.target.dy === 1, JSON.stringify(p("move up and to the left")));
i = one3("move left a bit");
check("left a bit = half a step", i?.target?.kind === "step" && i.target.scale === 0.5, JSON.stringify(i));
i = one3("move to the north");
check("move TO the north is still the map's north", i?.target?.kind === "region", JSON.stringify(i));
i = one3("pan the camera left");
check("pan the camera left = a camera step", i?.kind === "camera" && i.target.kind === "step" && i.target.dx === -1, JSON.stringify(i));
i = one3("follow the archmage");
check("follow the archmage", i?.kind === "order" && i.order === "smart" && i.target?.kind === "unit" && i.target.entry.id === "Hamg", JSON.stringify(i));
i = one3("train priest is of the moon");
check("'priest is of the moon' is the Priestess", i?.kind === "train" && i.entry.id === "Emoo", JSON.stringify(i));
i = one3("train the priestess of moon");
check("'the priestess of moon'", i?.kind === "train" && i.entry.id === "Emoo", JSON.stringify(i));

console.log("not commands");
check("small talk is nothing", p("hello how are you").length === 0, JSON.stringify(p("hello how are you")));
check("describe() names every intent", p("train three footmen and group two").map(describe).join(" · ") === "Train 3 × Footman · Group 2", p("train three footmen and group two").map(describe).join(" · "));

// ---- 中文：同样的文法，中文的词（parser.ts 的 ZH 表），名字仍然是地图给的中文名 ----
console.log("中文命令");
setLocale("zhCN");
const zh = new Lexicon([
  { kind: "unit", id: "hfoo", phrase: "步兵" },
  { kind: "unit", id: "hpea", phrase: "农民" },
  { kind: "unit", id: "hrif", phrase: "火枪手" },
  { kind: "building", id: "hhou", phrase: "农场" },
  { kind: "building", id: "hbar", phrase: "兵营" },
  { kind: "hero", id: "Hmkg", phrase: "山丘之王" },
  { kind: "ability", id: "AHtb", phrase: "风暴之锤" },
  { kind: "item", id: "stwp", phrase: "回城卷轴" },
]);
const z = (text) => { const r = parse(text, { lexicon: zh }); return r.length === 1 ? r[0] : null; };
let zi = z("训练三个步兵");
check("训练三个步兵", zi?.kind === "train" && zi.entry.id === "hfoo" && zi.count === 3, JSON.stringify(zi));
zi = z("建造农场在这里");
check("建造农场在这里", zi?.kind === "build" && zi.entry.id === "hhou" && zi.target?.kind === "screen", JSON.stringify(zi));
zi = z("所有农民采金");
check("所有农民采金", zi?.kind === "harvest" && zi.res === "gold" && zi.subject?.count === "all" && zi.subject.worker === true, JSON.stringify(zi));
zi = z("攻击敌人英雄");
check("攻击敌人英雄", zi?.kind === "order" && zi.order === "attack" && zi.target?.kind === "hero" && zi.target.side === "enemy", JSON.stringify(zi));
zi = z("对敌人英雄使用风暴之锤");
check("对敌人英雄使用风暴之锤", zi?.kind === "press" && zi.entry.id === "AHtb" && zi.target?.kind === "hero" && zi.target.side === "enemy", JSON.stringify(zi));
zi = z("给英雄使用回城卷轴");
check("给英雄使用回城卷轴", zi?.kind === "useitem" && zi.entry?.id === "stwp" && zi.target?.kind === "hero", JSON.stringify(zi));
zi = z("选中所有部队");
check("选中所有部队", zi?.kind === "select" && zi.what === "army", JSON.stringify(zi));
zi = z("回城卷轴");
check("回城卷轴 = 用回城", zi?.kind === "press" || zi?.kind === "useitem" || zi?.kind === "order" || zi?.kind === "teleport", JSON.stringify(zi));
zi = z("说打得不错");
check("说打得不错 = 一条聊天", zi?.kind === "chat" && zi.text === "打得不错", JSON.stringify(zi));
zi = z("第二队");
check("第二队 = 切换到编队 2", zi?.kind === "group" && zi.n === 2, JSON.stringify(zi));
zi = z("取消第二队");
check("取消第二队 = 清空编队 2", zi?.kind === "group" && zi.n === 2 && zi.mode === "clear", JSON.stringify(zi));
zi = z("取消编组");
check("取消编组", zi?.kind === "ungroup", JSON.stringify(zi));
zi = z("丢弃回城卷轴");
check("丢弃回城卷轴", zi?.kind === "drop" && zi.entry?.id === "stwp", JSON.stringify(zi));
zi = z("开启自动施放风暴之锤");
check("开启自动施放", zi?.kind === "autocast" && zi.on === true && zi.entry.id === "AHtb", JSON.stringify(zi));
zi = z("关闭自动施放风暴之锤");
check("关闭自动施放", zi?.kind === "autocast" && zi.on === false && zi.entry.id === "AHtb", JSON.stringify(zi));
zi = z("训练三个火枪首");
check("名字错一个字也能认出（火枪首→火枪手）", zi?.kind === "train" && zi.entry.id === "hrif", JSON.stringify(zi));
zi = z("建造农厂");
check("两个字的建筑名听错也能认出（农厂→农场）", zi?.kind === "build" && zi.entry.id === "hhou", JSON.stringify(zi));
zi = z("向上移动");
check("方向在前也能走（向上移动）", zi?.kind === "order" && zi.target?.kind === "step" && zi.target.dy === 1, JSON.stringify(zi));
zi = z("向右上移动");
check("中文八方向：右上", zi?.kind === "order" && zi.target?.kind === "step" && zi.target.dx === 1 && zi.target.dy === 1, JSON.stringify(zi));
zi = z("往左下走");
check("中文八方向：左下", zi?.kind === "order" && zi.target?.kind === "step" && zi.target.dx === -1 && zi.target.dy === -1, JSON.stringify(zi));
zi = z("朝左上移动");
check("中文八方向：左上", zi?.kind === "order" && zi.target?.kind === "step" && zi.target.dx === -1 && zi.target.dy === 1, JSON.stringify(zi));
zi = z("向左移一点");
check("向左移一点 = 半步（动宾之间的“移”不挡距离词）", zi?.kind === "order" && zi.target?.kind === "step" && zi.target.dx === -1 && zi.target.scale === 0.5, JSON.stringify(zi));
zi = z("向左移动一点");
check("向左移动一点 = 半步", zi?.kind === "order" && zi.target?.kind === "step" && zi.target.scale === 0.5, JSON.stringify(zi));
zi = z("向左走一点");
check("向左走一点 = 半步", zi?.kind === "order" && zi.target?.kind === "step" && zi.target.scale === 0.5, JSON.stringify(zi));
zi = z("向英雄靠拢");
check("中文：向英雄靠拢", zi?.kind === "regroup", JSON.stringify(zi));
zi = z("靠拢英雄");
check("中文：靠拢英雄", zi?.kind === "regroup", JSON.stringify(zi));
zi = z("集合");
check("中文：集合 = 靠拢", zi?.kind === "regroup", JSON.stringify(zi));
zi = z("攻击");
check("只说攻击 = 攻击屏幕中央", zi?.kind === "order" && zi.order === "attack" && zi.target?.kind === "screen", JSON.stringify(zi));
zi = z("全军出击");
check("全军出击 = 攻击移动", zi?.kind === "order" && zi.order === "attackmove", JSON.stringify(zi));
// A MAP VOICE PACK (voice/packs.ts) is names, not code: the map supplies "肉山" for a unit the
// base tables call something else, and the base grammar reads it like any other target.
const packLex = new Lexicon([{ kind: "unit", id: "n000", phrase: "肉山" }]);
const pk = parse("攻击肉山", { lexicon: packLex })[0];
check("地图语音包的名字能被识别（肉山）", pk?.kind === "order" && pk.target?.kind === "unit" && pk.target.entry.id === "n000", JSON.stringify(pk));
zi = z("訓練三個步兵");
check("繁体也能认出", zi?.kind === "train" && zi.entry.id === "hfoo" && zi.count === 3, JSON.stringify(zi));
const zhTrain = z("训练三个步兵");
check("中文回显", !!zhTrain && describe(zhTrain).includes("步兵"), String(zhTrain && describe(zhTrain)));

// ---- 同音回退：识别器把“拾取”写成“时区/失去”时，按无调拼音仍能命中 ----
console.log("同音回退");
const soundLex = new Lexicon([]);
let shq = parse("拾取", { lexicon: soundLex })[0];
check("同音：拾取（精确）", shq?.kind === "pick", JSON.stringify(shq));
shq = parse("时区", { lexicon: soundLex })[0];
check("同音：时区 → 拾取", shq?.kind === "pick", JSON.stringify(shq));
shq = parse("失去", { lexicon: soundLex })[0];
check("同音：失去 → 拾取", shq?.kind === "pick", JSON.stringify(shq));
shq = parse("十取", { lexicon: soundLex })[0];
check("同音：十取 → 拾取", shq?.kind === "pick", JSON.stringify(shq));
check("同音：单字不回退", parse("是", { lexicon: soundLex }).length === 0, JSON.stringify(parse("是", { lexicon: soundLex })));
// 名字优先：本身就叫“时区”的单位仍按名字解析，不会被回退成拾取。
const namedLex = new Lexicon([{ kind: "unit", id: "n000", phrase: "时区" }]);
const named = parse("攻击时区", { lexicon: namedLex })[0];
check("同音：名字优先于回退", named?.kind === "order" && named.order === "attack" && named.target?.entry?.id === "n000", JSON.stringify(named));
// 中文聊天走原文，不经过切词，所以回退不会改写玩家的话。
const said = parse("说我失去了", { lexicon: soundLex })[0];
check("同音：聊天不改写", said?.kind === "chat" && said.text.includes("失去"), JSON.stringify(said));

// ---- 名字的拼音匹配：同音字先认，读音只差一两个字母再放宽 ----
console.log("名字拼音");
const nameLex = new Lexicon([
  { kind: "unit", id: "hfoo", phrase: "步兵" },
  { kind: "unit", id: "hrif", phrase: "火枪手" },
  { kind: "building", id: "hhou", phrase: "农场" },
  { kind: "hero", id: "Hmkg", phrase: "山丘之王" },
]);
let nm = parse("攻击不兵", { lexicon: nameLex })[0];
check("名字拼音：不兵 → 步兵", nm?.kind === "order" && nm.target?.entry?.id === "hfoo", JSON.stringify(nm));
nm = parse("建造农厂", { lexicon: nameLex })[0];
check("名字拼音：农厂 → 农场", nm?.kind === "build" && nm.entry?.id === "hhou", JSON.stringify(nm));
nm = parse("攻击火枪书", { lexicon: nameLex })[0];
check("名字拼音：火枪书 → 火枪手（少一个字母）", nm?.kind === "order" && nm.target?.entry?.id === "hrif", JSON.stringify(nm));
nm = parse("攻击山丘之万", { lexicon: nameLex })[0];
check("名字拼音：之万 → 之王（编辑距离）", nm?.kind === "order" && nm.target?.entry?.id === "Hmkg", JSON.stringify(nm));
// 精确写法仍然是第一优先：名字本身叫“时区”时，不会被当成“拾取”。
const exactFirst = parse("攻击时区", { lexicon: namedLex })[0];
check("名字拼音：精确名字优先", exactFirst?.kind === "order" && exactFirst.target?.entry?.id === "n000", JSON.stringify(exactFirst));



// ---- 语音包：一张地图/一种地图自己的说法（voice/packs.ts 的 phrases）----
console.log("语音包");
const { CAMPAIGN_PACK, MELEE_PACK, MAP_PACKS, mapKey, chapterPack, voicePacks } = require(join(REPO, ".sim-build", "src", "voice", "packs.js"));
const { parseMapVoice } = require(join(REPO, ".sim-build", "src", "voice", "mapVoice.js"));
const withPack = (text, packs) => { const r = parse(text, { lexicon: zh, packs }); return r.length === 1 ? r[0] : null; };
let pi = withPack("跳过过场", [CAMPAIGN_PACK]);
check("战役：跳过过场", pi?.kind === "cinematic", JSON.stringify(pi));
pi = withPack("跳过开场", [CAMPAIGN_PACK]);
check("战役：跳过开场", pi?.kind === "cinematic", JSON.stringify(pi));
pi = withPack("跳过开始场景", [CAMPAIGN_PACK]);
check("战役：跳过开始场景", pi?.kind === "cinematic", JSON.stringify(pi));
pi = withPack("跳过", [CAMPAIGN_PACK]);
check("战役：只说跳过", pi?.kind === "cinematic", JSON.stringify(pi));
pi = withPack("skip the opening", [CAMPAIGN_PACK]);
check("战役：skip the opening", pi?.kind === "cinematic", JSON.stringify(pi));
pi = withPack("现在要做什么", [CAMPAIGN_PACK]);
check("战役：现在要做什么", pi?.kind === "quest", JSON.stringify(pi));
pi = withPack("选择第一个选项", [CAMPAIGN_PACK]);
check("战役：选择第一个选项", pi?.kind === "dialog" && pi.index === 0, JSON.stringify(pi));
pi = withPack("接受", [CAMPAIGN_PACK]);
check("战役：接受", pi?.kind === "dialog" && pi.index === undefined, JSON.stringify(pi));
pi = withPack("任务列表", [CAMPAIGN_PACK]);
check("战役：任务列表", pi?.kind === "quest" && pi.mode === "list", JSON.stringify(pi));
pi = withPack("下一个任务", [CAMPAIGN_PACK]);
check("战役：下一个任务", pi?.kind === "quest" && pi.mode === "next", JSON.stringify(pi));
pi = withPack("任务进度", [CAMPAIGN_PACK]);
check("战役：任务进度", pi?.kind === "quest" && pi.mode === "progress", JSON.stringify(pi));
pi = withPack("第四个选项", [CAMPAIGN_PACK]);
check("战役：第四个选项", pi?.kind === "dialog" && pi.index === 3, JSON.stringify(pi));
pi = withPack("拒绝", [CAMPAIGN_PACK]);
check("战役：拒绝", pi?.kind === "dialog" && pi.choice === "decline", JSON.stringify(pi));
pi = withPack("继续", [CAMPAIGN_PACK]);
check("战役：继续", pi?.kind === "dialog" && pi.choice === "continue", JSON.stringify(pi));
pi = withPack("集合部队", [CAMPAIGN_PACK]);
check("战役：集合部队", pi?.kind === "regroup", JSON.stringify(pi));
pi = withPack("找到步兵", [CAMPAIGN_PACK]);
check("战役：找到步兵", pi?.kind === "camera" && pi.target?.kind === "unit" && pi.target.entry.id === "hfoo", JSON.stringify(pi));
pi = withPack("和步兵说话", [CAMPAIGN_PACK]);
check("战役：和步兵说话", pi?.kind === "order" && pi.order === "smart" && pi.target?.entry?.id === "hfoo", JSON.stringify(pi));
pi = withPack("保护步兵", [CAMPAIGN_PACK]);
check("战役：保护步兵", pi?.kind === "order" && pi.order === "smart" && pi.target?.entry?.id === "hfoo", JSON.stringify(pi));
pi = withPack("搜刮", [CAMPAIGN_PACK]);
check("战役：搜刮", pi?.kind === "pick" && pi.all === true, JSON.stringify(pi));
pi = withPack("捡起所有物品", [CAMPAIGN_PACK]);
check("战役：捡起所有物品", pi?.kind === "pick" && pi.all === true, JSON.stringify(pi));
pi = withPack("去治疗", [CAMPAIGN_PACK]);
check("战役：去治疗", pi?.kind === "heal", JSON.stringify(pi));
const giveLex = new Lexicon([{ kind: "item", id: "phea", phrase: "治疗药膏" }, { kind: "item", id: "phea", phrase: "healing salve" }]);
pi = parse("把治疗药膏给英雄", { lexicon: giveLex, packs: [CAMPAIGN_PACK] })[0];
check("战役：把物品给英雄", pi?.kind === "give" && pi.entry?.id === "phea" && pi.target?.kind === "hero", JSON.stringify(pi));
setLocale("enUS");
pi = parse("pick up all items", { lexicon: giveLex, packs: [CAMPAIGN_PACK] })[0];
check("战役：pick up all items", pi?.kind === "pick" && pi.all === true, JSON.stringify(pi));
pi = parse("give the healing salve to the hero", { lexicon: giveLex, packs: [CAMPAIGN_PACK] })[0];
check("战役：give item", pi?.kind === "give" && pi.entry?.id === "phea" && pi.target?.kind === "hero", JSON.stringify(pi));
setLocale("zhCN");

// ---- 战役章节专属词表：Rise of the Naga（NightElfX01）----
console.log("战役章节词表");
const rise = chapterPack("Rise of the Naga");
check("章节：按标题找到章节包", !!rise && rise.id === "chapter:nightelfx01", rise?.id ?? "none");
check("章节：中文标题同一包", chapterPack("纳迦的崛起") === rise, "");
const risePacks = voicePacks("campaign", "Rise of the Naga");
check("章节：进入战役包序列", risePacks.some((p) => p.id === "chapter:nightelfx01"), risePacks.map((p) => p.id).join(","));
const riseLex = new Lexicon(rise.entries ?? []);
pi = parse("打开大门", { lexicon: riseLex, packs: risePacks })[0];
check("章节：打开大门", pi?.kind === "order" && pi.order === "attack" && pi.target?.entry?.id === "chapter:gate", JSON.stringify(pi));
pi = parse("攻击纳迦", { lexicon: riseLex, packs: risePacks })[0];
check("章节：攻击纳迦", pi?.kind === "order" && pi.order === "attack" && pi.target?.entry?.phrase === "纳迦", JSON.stringify(pi));
pi = parse("跟随玛维", { lexicon: riseLex, packs: risePacks })[0];
check("章节：跟随玛维", pi?.kind === "order" && pi.order === "smart" && pi.target?.entry?.phrase === "玛维", JSON.stringify(pi));
const sidecarPath = join(REPO, "Warcraft III zhCN", "Maps", "FrozenThrone", "Campaign", "NightElfX01.w3x.voice.json");
const sidecar = parseMapVoice(require("fs").readFileSync(sidecarPath, "utf8"));
check("章节：sidecar 可解析", !!sidecar && (sidecar.pack.entries?.length ?? 0) >= 5 && (sidecar.pack.phrases?.length ?? 0) >= 6, sidecar ? `${sidecar.locale} ${sidecar.pack.entries?.length}/${sidecar.pack.phrases?.length}` : "none");
pi = withPack("侦察", [MELEE_PACK]);
check("对战：侦察", pi?.kind === "order" && pi.order === "move" && pi.target?.kind === "base" && pi.target.side === "enemy", JSON.stringify(pi));
pi = withPack("集火", [MELEE_PACK]);
check("对战：集火", pi?.kind === "order" && pi.order === "attack" && pi.target?.kind === "hero" && pi.target.side === "enemy", JSON.stringify(pi));
pi = withPack("推进", [MELEE_PACK]);
check("对战：推进", pi?.kind === "order" && pi.order === "attackmove" && pi.target?.kind === "base", JSON.stringify(pi));
pi = withPack("防守", [MELEE_PACK]);
check("对战：防守", pi?.kind === "order" && pi.order === "move" && pi.target?.kind === "base" && pi.target.side === "mine", JSON.stringify(pi));
const dota = [MAP_PACKS["dota-v6-83d"]];
pi = withPack("打野", dota);
check("地图：打野 = 攻击移动野怪", pi?.kind === "order" && pi.order === "attackmove" && pi.target?.kind === "creeps", JSON.stringify(pi));
pi = withPack("推线", dota);
check("地图：推线 = 攻击移动中路", pi?.kind === "order" && pi.order === "attackmove" && pi.target?.kind === "region" && pi.target.region.x === 0 && pi.target.region.y === 0, JSON.stringify(pi));
pi = withPack("守家", dota);
check("地图：守家", pi?.kind === "order" && pi.order === "move" && pi.target?.kind === "base" && pi.target.side === "mine", JSON.stringify(pi));
check("没有包时“跳过过场”不是命令", parse("跳过过场", { lexicon: zh }).length === 0, JSON.stringify(parse("跳过过场", { lexicon: zh })));
check("地图名归一（DotA AI）", mapKey("DotA AI v6.90G PT-BR v4.1") === "dota-ai-v6-90g-pt-br-v4-1", mapKey("DotA AI v6.90G PT-BR v4.1"));

// ---- 地图自己带的语音包（voice/mapVoice.ts）：与地图同目录、一个文件多语言 ----
console.log("地图语音文件");
const VOICE_FILE = JSON.stringify({
  format: 1,
  default: "zhCN",
  languages: {
    zhCN: {
      names: { units: { n01X: ["肉山", "Roshan"] } },
      commands: [
        { say: ["打野", "清野"], do: { order: "attackmove", target: { kind: "creeps" } } },
        { say: ["集火"], do: { order: "attack", target: { kind: "hero", side: "enemy" } } },
      ],
    },
    enUS: {
      names: { units: { n01X: ["Roshan"] } },
      commands: [
        { say: ["jungle"], do: { order: "attackmove", target: { kind: "creeps" } } },
        { say: ["focus fire"], do: { order: "attack", target: { kind: "hero", side: "enemy" } } },
      ],
    },
  },
});
setLocale("zhCN");
const mvZh = parseMapVoice(VOICE_FILE);
check("地图语音：选中文块", mvZh?.locale === "zhCN", String(mvZh?.locale));
check("地图语音：名字数与命令数", mvZh?.pack.entries?.length === 2 && mvZh?.pack.phrases?.length === 3, `${mvZh?.pack.entries?.length}/${mvZh?.pack.phrases?.length}`);
const mvZhLex = new Lexicon(mvZh.pack.entries ?? []);
let mvi = parse("打野", { lexicon: mvZhLex, packs: [mvZh.pack] })[0];
check("地图语音：打野", mvi?.kind === "order" && mvi.order === "attackmove" && mvi.target?.kind === "creeps", JSON.stringify(mvi));
mvi = parse("攻击肉山", { lexicon: mvZhLex, packs: [mvZh.pack] })[0];
check("地图语音：肉山的 rawcode", mvi?.kind === "order" && mvi.target?.kind === "unit" && mvi.target.entry.id === "n01X", JSON.stringify(mvi));
setLocale("enUS");
const mvEn = parseMapVoice(VOICE_FILE);
check("地图语音：选英文块", mvEn?.locale === "enUS", String(mvEn?.locale));
const mvEnLex = new Lexicon(mvEn.pack.entries ?? []);
mvi = parse("jungle", { lexicon: mvEnLex, packs: [mvEn.pack] })[0];
check("地图语音：jungle", mvi?.kind === "order" && mvi.order === "attackmove" && mvi.target?.kind === "creeps", JSON.stringify(mvi));
// 玩家语言没有对应块时，落到文件的 default。
const onlyZh = parseMapVoice(JSON.stringify({ format: 1, default: "zhCN", languages: { zhCN: { commands: [{ say: ["打野"], do: { stop: true } }] } } }));
check("地图语音：缺语言块时回退 default", onlyZh?.locale === "zhCN" && onlyZh.pack.phrases?.length === 1, String(onlyZh?.locale));
// 单语言文件（没有 languages 块）与坏命令的行级容错。
const flat = parseMapVoice(JSON.stringify({ format: 1, commands: [{ say: ["a"], do: { order: "fly" } }, { say: ["b"], do: { stop: true } }] }));
check("地图语音：坏命令被跳过", flat?.pack.phrases?.length === 1, String(flat?.pack.phrases?.length));
check("地图语音：非语音文件返回 null", parseMapVoice("{}") === null && parseMapVoice("not json") === null, "");

// ---- 拾取地上的物品 ----
console.log("拾取物品");
setLocale("zhCN");
const pickLex = new Lexicon([
  { kind: "item", id: "phea", phrase: "治疗药膏" },
  { kind: "item", id: "phea", phrase: "healing salve" },
]);
let pickIntent = parse("拾取治疗药膏", { lexicon: pickLex })[0];
check("拾取：中文按名字", pickIntent?.kind === "pick" && pickIntent.entry?.id === "phea", JSON.stringify(pickIntent));
pickIntent = parse("捡起来", { lexicon: pickLex })[0];
check("拾取：中文不带名字", pickIntent?.kind === "pick" && pickIntent.entry === undefined, JSON.stringify(pickIntent));
setLocale("enUS");
pickIntent = parse("pick up the healing salve", { lexicon: pickLex })[0];
check("拾取：英文按名字", pickIntent?.kind === "pick" && pickIntent.entry?.id === "phea", JSON.stringify(pickIntent));
pickIntent = parse("grab that", { lexicon: pickLex })[0];
check("拾取：grab that 不指定名字", pickIntent?.kind === "pick" && pickIntent.entry === undefined, JSON.stringify(pickIntent));
// ---- 商店买 / 卖 ----
setLocale("zhCN");
let trade = parse("买治疗药膏", { lexicon: pickLex })[0];
check("商店：中文买", trade?.kind === "buy" && trade.entry?.id === "phea", JSON.stringify(trade));
trade = parse("买物品二", { lexicon: pickLex })[0];
check("商店：中文按格子买", trade?.kind === "buy" && trade.slot === 1, JSON.stringify(trade));
trade = parse("卖治疗药膏", { lexicon: pickLex })[0];
check("商店：中文卖", trade?.kind === "sell" && trade.entry?.id === "phea", JSON.stringify(trade));
trade = parse("出售物品一", { lexicon: pickLex })[0];
check("商店：中文按格子卖", trade?.kind === "sell" && trade.slot === 0, JSON.stringify(trade));
trade = parse("复活英雄", { lexicon: pickLex })[0];
check("复活：中文", trade?.kind === "revive" && !trade.entry, JSON.stringify(trade));
trade = parse("装载", { lexicon: pickLex })[0];
check("运输：中文装载", trade?.kind === "board", JSON.stringify(trade));
trade = parse("卸载", { lexicon: pickLex })[0];
check("运输：中文卸载", trade?.kind === "unload", JSON.stringify(trade));
trade = parse("修理", { lexicon: pickLex })[0];
check("修理：中文", trade?.kind === "repair", JSON.stringify(trade));
trade = parse("自动修理", { lexicon: pickLex })[0];
check("修理：中文自动修理", trade?.kind === "autorepair" && trade.on, JSON.stringify(trade));
trade = parse("关闭自动修理", { lexicon: pickLex })[0];
check("修理：中文关闭自动修理", trade?.kind === "autorepair" && !trade.on, JSON.stringify(trade));
trade = parse("全选屏幕", { lexicon: pickLex })[0];
check("选择：中文全选屏幕", trade?.kind === "select" && trade.what === "screen", JSON.stringify(trade));
trade = parse("共享视野", { lexicon: pickLex })[0];
check("联盟：中文共享视野", trade?.kind === "diplomacy" && trade.action === "vision" && trade.on, JSON.stringify(trade));
trade = parse("取消共享控制", { lexicon: pickLex })[0];
check("联盟：中文取消共享控制", trade?.kind === "diplomacy" && trade.action === "control" && !trade.on, JSON.stringify(trade));
trade = parse("结盟", { lexicon: pickLex })[0];
check("联盟：中文结盟状态", trade?.kind === "diplomacy" && trade.action === "status", JSON.stringify(trade));
trade = parse("标记这里", { lexicon: pickLex })[0];
check("信号：中文标记这里", trade?.kind === "ping" && trade.target?.kind === "screen", JSON.stringify(trade));
trade = parse("排队移动到那里", { lexicon: pickLex })[0];
check("队列：中文排队移动", trade?.kind === "order" && trade.order === "move" && trade.queued === true, JSON.stringify(trade));
trade = parse("移出第二队", { lexicon: pickLex })[0];
check("编队：中文移出第二队", trade?.kind === "ungroupone" && trade.n === 2, JSON.stringify(trade));
trade = parse("下一组", { lexicon: pickLex })[0];
check("子组：中文下一组", trade?.kind === "subgroup" && trade.next === true, JSON.stringify(trade));
trade = parse("子组二", { lexicon: pickLex })[0];
check("子组：中文子组二", trade?.kind === "subgroup" && trade.index === 2, JSON.stringify(trade));
trade = parse("下一个空闲农民", { lexicon: pickLex })[0];
check("选择：中文下一个空闲农民", trade?.kind === "select" && trade.what === "idle", JSON.stringify(trade));
trade = parse("集火英雄", { lexicon: pickLex })[0];
check("集火：中文英雄", trade?.kind === "focus" && trade.target?.kind === "hero", JSON.stringify(trade));
trade = parse("交换物品一和三", { lexicon: pickLex })[0];
check("物品：中文交换", trade?.kind === "swap" && trade.from === 0 && trade.to === 2, JSON.stringify(trade));
trade = parse("建造菜单", { lexicon: pickLex })[0];
check("命令卡：中文建造菜单", trade?.kind === "cardpage" && trade.page === "build", JSON.stringify(trade));
trade = parse("技能菜单", { lexicon: pickLex })[0];
check("命令卡：中文技能菜单", trade?.kind === "cardpage" && trade.page === "learn", JSON.stringify(trade));
trade = parse("清空队列", { lexicon: pickLex })[0];
check("队列：中文清空", trade?.kind === "cancelqueued" && trade.all === true, JSON.stringify(trade));
setLocale("enUS");
// "pick the footman" must still be SELECT, not a pick-up: only the two-word forms mean loot.
const pickSel = new Lexicon([{ kind: "unit", id: "hfoo", phrase: "footman" }]);
pickIntent = parse("pick the footman", { lexicon: pickSel })[0];
check("拾取：pick 仍是选择", pickIntent?.kind === "select", JSON.stringify(pickIntent));

// ---- 攻击“敌人”这一整群，而不是敌方基地 ----
console.log("攻击敌人");
const bare = new Lexicon([]);
setLocale("zhCN");
let atk = parse("攻击敌人", { lexicon: bare })[0];
check("敌人：中文", atk?.kind === "order" && atk.order === "attack" && atk.target?.kind === "enemies", JSON.stringify(atk));
atk = parse("攻击所有敌人", { lexicon: bare })[0];
check("敌人：所有敌人", atk?.kind === "order" && atk.target?.kind === "enemies", JSON.stringify(atk));
atk = parse("攻击敌人英雄", { lexicon: bare })[0];
check("敌人：敌人英雄仍是英雄", atk?.kind === "order" && atk.target?.kind === "hero" && atk.target.side === "enemy", JSON.stringify(atk));
setLocale("enUS");
atk = parse("attack the enemy", { lexicon: bare })[0];
check("敌人：英文", atk?.kind === "order" && atk.order === "attack" && atk.target?.kind === "enemies", JSON.stringify(atk));
atk = parse("attack the enemy base", { lexicon: bare })[0];
check("敌人：敌方基地仍是基地", atk?.kind === "order" && atk.target?.kind === "base" && atk.target.side === "enemy", JSON.stringify(atk));

setLocale("enUS");

if (fails) { console.log(`\n${fails} FAILED`); process.exit(1); }
console.log("\nvoice parser: all ok");
