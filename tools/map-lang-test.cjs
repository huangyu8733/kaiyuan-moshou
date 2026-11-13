// Headless check of a map's Chinese language file (src/i18n/mapLanguage.ts).
// Run: npx tsc -p tools/tsconfig.sim.json && node tools/map-lang-test.cjs
//
// Pinned here, because each one is a silent failure in a running match:
//
//  1. **The file parses or it does not** — a broken `.zhCN.json` is a warning and the map as
//     its author wrote it, never a crash on the loading screen.
//  2. **Matching is deterministic**: CRLF and surrounding space do not matter, a whole line
//     wins over a fragment, and the LONGEST fragment wins inside a sentence (DotA composes its
//     announcements, so fragments are the normal case).
//  3. **wts answers by id first, then by the original line** — both spellings are in the field.
//  4. **Object overrides are level-aligned and reversible**: an empty entry keeps the original,
//     and clearing the language puts every field back (the registry outlives one match).
//  5. **English UI is a no-op** — the feature exists for Chinese players, not to translate.
//  6. **The map LIST reads the sidecar too** — a map's name and blurb are printed before any
//     match exists, and the w3i's TRIGSTR fields used to resolve out of the install's wts
//     (English). `MapInfo.sources` keeps the id; `localizedMapInfo` asks the sidecar by it.
const { join } = require("node:path");
const REPO = join(__dirname, "..");
require("node:fs").writeFileSync(join(REPO, ".sim-build", "package.json"), '{"type":"commonjs"}');
const lang = require(join(REPO, ".sim-build", "src", "i18n", "mapLanguage.js"));
const i18n = require(join(REPO, ".sim-build", "src", "i18n", "index.js"));
const { parseWts } = require(join(REPO, ".sim-build", "src", "jass", "wts.js"));

let failed = 0;
function check(what, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${what}`);
  if (!ok) console.log(`        want ${JSON.stringify(want)}\n        got  ${JSON.stringify(got)}`);
}

const DOC = {
  format: 1,
  locale: "zhCN",
  wts: { "50001": "地图简介" },
  text: {
    "First Blood": "第一滴血",
    "has just been killed by": "被以下玩家击杀：",
    "All Pick": "全选模式",
    "Pick": "选择",
    "Original line": "按原文命中",
  },
  objects: {
    units: { h000: { name: "测试英雄", properNames: ["甲", "乙"] } },
    abilities: { A00Y: { name: "弧形闪电", tips: ["", "二级"], uberTips: ["说明一", ""] } },
    items: { ratc: { name: "奶酪", description: "恢复生命" } },
    upgrades: { Rhme: { names: ["", "铁剑"], tips: ["", "二级提示"] } },
  },
};

// 1. parsing
const parsed = lang.parseMapLanguage(JSON.stringify(DOC));
check("parses a full file", [parsed.wts.size, parsed.text.size, parsed.objects.abilities.size], [1, 5, 1]);
check("bad JSON is null", lang.parseMapLanguage("{ nope"), null);
check("no format is null", lang.parseMapLanguage("{}"), null);
check("BOM is tolerated", lang.parseMapLanguage("\uFEFF" + JSON.stringify(DOC)).text.get("First Blood"), "第一滴血");

// 2/3. application, in Chinese (this build's default)
i18n.setLocale("zhCN");
lang.setMapLanguage(parsed);
check("whole line", lang.mapDisplayText("First Blood"), "第一滴血");
check("CRLF + spaces still match", lang.mapDisplayText("  First Blood\r\n"), "第一滴血");
check("fragment inside a built line", lang.mapDisplayText("|c00ff0303Bob|r has just been killed by Luna"), "|c00ff0303Bob|r 被以下玩家击杀： Luna");
check("longest fragment wins", lang.mapDisplayText("All Pick"), "全选模式");
check("unknown text passes through", lang.mapDisplayText("Nothing in the table"), "Nothing in the table");
check("empty stays empty", lang.mapDisplayText(""), "");

const table = new Map([[50001, "original description"], [50002, "Original line"], [50003, "untouched"]]);
check("wts by id + by source line", [...lang.localizeMapWtsTable(table)], [[50001, "地图简介"], [50002, "按原文命中"], [50003, "untouched"]]);
const rebuilt = parseWts(lang.localizeMapWtsText("STRING 50001\n{\noriginal description\n}\n"));
check("raw wts text is rebuilt", rebuilt.get(50001), "地图简介");

// 4. objects
const unit = { name: "Footman", properNames: ["Bob"] };
const ability = { name: "Chain Lightning", tips: ["一级", "原二级"], uberTips: ["原说明", "原二级说明"] };
const item = { name: "Cheese", description: "Heals" };
const upgrade = { names: ["原一级", "原二级"], tips: ["原提示", "原二级提示"] };
const regs = {
  registry: { get: (id) => (id === "h000" ? unit : undefined) },
  abilities: { get: (id) => (id === "A00Y" ? ability : undefined) },
  items: { get: (id) => (id === "ratc" ? item : undefined) },
  upgrades: { get: (id) => (id === "Rhme" ? upgrade : undefined) },
};
lang.applyMapObjectLanguage(regs);
check("unit name + proper names", [unit.name, unit.properNames], ["测试英雄", ["甲", "乙"]]);
check("ability name, level-aligned tips keep the original at rank 1", [ability.name, ability.tips, ability.uberTips], ["弧形闪电", ["一级", "二级"], ["说明一", "原二级说明"]]);
check("item fields", [item.name, item.description], ["奶酪", "恢复生命"]);
check("upgrade names aligned", [upgrade.names, upgrade.tips], [["原一级", "铁剑"], ["原提示", "二级提示"]]);
lang.setMapLanguage(null);
check("clearing restores every field", [unit.name, unit.properNames, ability.name, ability.tips, item.name, upgrade.names], ["Footman", ["Bob"], "Chain Lightning", ["一级", "原二级"], "Cheese", ["原一级", "原二级"]]);

// 5. The APP's own language is not the map's. A dictionary that is loaded speaks for the map
// whatever the menus are set to — it used to be gated on the UI being Chinese, so a Chinese
// install with the app in English played every map in the author's language, which is exactly
// the bug this rule was written for.
lang.setMapLanguage(parsed);
i18n.setLocale("enUS");
check("an English UI still gets the map's Chinese", lang.mapDisplayText("First Blood"), "第一滴血");
check("an English UI still gets the map's wts", [...lang.localizeMapWtsTable(new Map([[50001, "original description"]]))], [[50001, "地图简介"]]);
i18n.setLocale("zhCN");

// 6. A blank value in `text` means "not translated" (the generator leaves script-internal
// tokens like `Source`, `Caster`, `Invoker|Wex` empty). It must NOT become a substring rule:
// replacing one with "" deletes that word from any on-screen line containing it.
const BLANK = lang.parseMapLanguage(JSON.stringify({
  format: 1, locale: "zhCN",
  text: { "Source": "", "Caster": "", "Light": "", "First Blood": "第一滴血" },
}));
lang.setMapLanguage(BLANK);
check("blank entries do not delete on-screen words", lang.mapDisplayText("Source Light Caster"), "Source Light Caster");
check("blank entries leave real translations alone", lang.mapDisplayText("First Blood"), "第一滴血");
lang.setMapLanguage(parsed);

// 7. The map's own `war3mapSkin.txt` [FrameDef] layer (data/mapSkin.ts). DotA rewrites
// KEY_QUESTS to "Map Info (F9)" — a LITERAL the author typed, so the map's wts never carries
// it and the install's Chinese data cannot reach it: the top-left button bar read
// `Map Info | 菜单 | 盟友 | 聊天`. The sidecar's `skin` table answers by FrameDef KEY, and
// must NOT become a fragment rule ("Gold" inside a sentence would be rewritten everywhere).
const skinMod = require(join(REPO, ".sim-build", "src", "data", "mapSkin.js"));
const SKIN_LANG = lang.parseMapLanguage(JSON.stringify({
  format: 1, locale: "zhCN",
  skin: { KEY_QUESTS: "地图信息(|Cfffed312F9|R)" },
}));
lang.setMapLanguage(SKIN_LANG);
skinMod.setMapSkinOverlay(skinMod.parseMapSkin(
  "[FrameDef]\r\nKEY_QUESTS=Map Info (|Cfffed312F9|R)\r\nQUESTS=Map Info\r\nRESOURCES_COLUMN0=Gold\r\n",
));
check("a skin key the sidecar names reads Chinese", skinMod.mapFrameString("KEY_QUESTS"), "地图信息(|Cfffed312F9|R)");
check("a skin key it does not name keeps the author's text", skinMod.mapFrameString("QUESTS"), "Map Info");
check("skin values are not fragment rules", lang.mapDisplayText("Gold is given as a reward"), "Gold is given as a reward");
skinMod.setMapSkinOverlay(null);
check("no overlay, no override", skinMod.mapFrameString("KEY_QUESTS"), undefined);

// 8. The same file's [Errors] block. A map that RE-WORDS an engine refusal (DotA's `Nolumber`
// is "you do not need a recipe for this item", not "not enough lumber") leaves the install's
// own Chinese copy saying the WRONG sentence, so both the wording and its translation come from
// the map: `[Errors]` by key, the sidecar's `errors` table by the same key.
const ERR_LANG = lang.parseMapLanguage(JSON.stringify({
  format: 1, locale: "zhCN",
  errors: { Nolumber: "该物品不需要卷轴。请直接购买配方中列出的组件。" },
}));
lang.setMapLanguage(ERR_LANG);
skinMod.setMapSkinOverlay(skinMod.parseMapSkin(
  "[Errors]\r\nNeedemptytree=That tree already has eyes.\r\nNolumber=You do not need a recipe for this item.\r\n",
));
check("the map's re-worded refusal is read by key", skinMod.mapErrorString("Nolumber"), "该物品不需要卷轴。请直接购买配方中列出的组件。");
check("a key the sidecar leaves out stays in the author's words", skinMod.mapErrorString("needemptytree"), "That tree already has eyes.");
check("a key the map does not re-word is not an override", skinMod.mapErrorString("Targettree"), undefined);
check("error text is not a fragment rule either", lang.mapDisplayText("That tree already has eyes."), "That tree already has eyes.");
skinMod.setMapSkinOverlay(null);
check("no overlay, no error override", skinMod.mapErrorString("Nolumber"), undefined);
lang.setMapLanguage(parsed);

// 9. The map's own name and blurb, as the CUSTOM GAME LIST prints them. The list reads a map
// before any match exists, so no dictionary is `live()` and the w3i's TRIGSTR fields resolve
// out of the INSTALL's wts — English on a Chinese install. `MapInfo.sources` keeps the id the
// w3i named so the sidecar can be asked by it; a sidecar's `info` block answers first, and a
// literal name still works through `text`.
const SELECT_LANG = lang.parseMapLanguage(JSON.stringify({
  format: 1, locale: "zhCN",
  wts: { "50001": "从 112 位英雄中选择一位…" },
  text: { "Funny Bunny's Egg Hunt": "滑稽兔的寻蛋大赛" },
  info: { name: "DotA 6.83d 中文版" },
}));
const NO_INFO = lang.parseMapLanguage(JSON.stringify({
  format: 1, locale: "zhCN",
  wts: { "50001": "中文简介" },
  text: { "Funny Bunny's Egg Hunt": "滑稽兔的寻蛋大赛" },
}));
const mapInfoOf = (f) => ({
  name: "DotA v6.83d", description: "Choose from 112 unique heroes…", recommendedPlayers: "10",
  sources: { name: "TRIGSTR_50000", description: "TRIGSTR_50001", recommendedPlayers: "10" },
  tileset: "C", width: 96, height: 96, slots: [], neutralPlayers: [], maxPlayers: 10,
  minimap: null, previewImage: null, isMelee: false, forces: [], fixedPlayerSettings: false,
  loading: { screen: -1, model: "", title: "", subtitle: "", text: "" },
  classification: {}, format: {},
  ...f,
});
const dt = lang.localizedMapInfo(mapInfoOf({}), SELECT_LANG);
check("the blurb is asked of the sidecar by the w3i's STRING id", dt.description, "从 112 位英雄中选择一位…");
check("…and the info block wins over it for the name", dt.name, "DotA 6.83d 中文版");
const lit = lang.localizedMapInfo(mapInfoOf({
  name: "Funny Bunny's Egg Hunt",
  description: "Choose from 112 unique heroes…",
  // Both LITERAL: a map that writes its blurb into the w3i has no STRING id to ask by, and a
  // paragraph the file does not carry stays as the author wrote it.
  sources: { name: "Funny Bunny's Egg Hunt", description: "Choose from 112 unique heroes…", recommendedPlayers: "" },
}), NO_INFO);
check("a literal name is answered by the text table", lit.name, "滑稽兔的寻蛋大赛");
check("…and a literal blurb it does not carry is left alone", lit.description, "Choose from 112 unique heroes…");
const plain = mapInfoOf({ sources: undefined });
check("a MapInfo from before `sources` still reads", lang.localizedMapInfo(plain, NO_INFO).description, "Choose from 112 unique heroes…");
const same = mapInfoOf({ name: "Nothing", description: "in any table", sources: { name: "Nothing", description: "in any table", recommendedPlayers: "" } });
check("nothing answered hands back the SAME object (a cached MapInfo stays cached)", lang.localizedMapInfo(same, NO_INFO) === same, true);
check("no dictionary is a no-op", lang.localizedMapInfo(dt, null) === dt, true);

// …and the LOBBY's headings: a force's own name, printed over its rows. DotA's two are
// "The Sentinel" / "The Scourge", TRIGSTRs 50002/50003 — the row read that out of the INSTALL's
// wts and stayed English while the sidecar held both in Chinese.
const FORCE_LANG = lang.parseMapLanguage(JSON.stringify({
  format: 1, locale: "zhCN",
  wts: { "50002": "|c00ff0303近卫军团|r", "50003": "|c0020c000天灾军团|r" },
}));
const forces = mapInfoOf({
  forces: [
    { name: "|c00ff0303The Sentinel|r", nameSource: "TRIGSTR_50002", players: [1, 2], allied: true, sharedVision: true },
    { name: "|c0020c000The Scourge|r", nameSource: "TRIGSTR_50003", players: [3, 4], allied: true, sharedVision: true },
  ],
});
const zhForces = lang.localizedMapInfo(forces, FORCE_LANG);
check("the lobby's force heading is asked of the sidecar by id", zhForces.forces.map((f) => f.name),
  ["|c00ff0303近卫军团|r", "|c0020c000天灾军团|r"]);
check("…and the copy keeps the force's members and grants", zhForces.forces.map((f) => [f.players, f.allied]), [[[1, 2], true], [[3, 4], true]]);
check("a force the sidecar does not answer keeps the author's name",
  lang.localizedMapInfo(mapInfoOf({ forces: [{ name: "Monolithic Creeps", nameSource: "Monolithic Creeps", players: [1], allied: false, sharedVision: false }] }), FORCE_LANG).forces[0].name,
  "Monolithic Creeps");

// loading: first candidate missing, second present
(async () => {
  const tried = [];
  const read = async (path) => {
    tried.push(path);
    return path.endsWith("DotA v6.83d.zhCN.json") ? new TextEncoder().encode(JSON.stringify(DOC)) : null;
  };
  const loaded = await lang.loadMapLanguage(read, "Maps\\hhkj\\DotA v6.83d.w3x");
  check("loads the second candidate", loaded?.text.size, 5);
  check("tries both names, in backslash spelling", tried, ["Maps\\hhkj\\DotA v6.83d.w3x.zhCN.json", "Maps\\hhkj\\DotA v6.83d.zhCN.json"]);
  check("no file is null", await lang.loadMapLanguage(async () => null, "Maps\\hhkj\\Other.w3x"), null);

  console.log(failed ? `\n${failed} FAILED` : "\nall passed");
  process.exit(failed ? 1 : 0);
})();
