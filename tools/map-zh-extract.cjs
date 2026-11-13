// Extract a map's translatable text into the file the engine reads BESIDE it
// (src/i18n/mapLanguage.ts): `<map file name>.zhCN.json`.
//
//   node tools/map-zh-extract.cjs "Maps/hhkj/DotA v6.83d.w3x"            # merge, keep translations
//   node tools/map-zh-extract.cjs "Maps/hhkj/DotA v6.83d.w3x" --template # every key, blank values
//
// Two sources, because they are the two the engine can localize:
//
//   · `war3map.wts` — the map's STRING table (name, description, credits, mode list). Keys are
//     the STRING ids, exactly as the engine matches them.
//   · `scripts\war3map.j` — the string LITERALS the script prints (announcements, mode notices)…
//     …except the ones that are not prose: rawcodes, file paths, colour codes alone, command
//     tokens and format-only strings are dropped here so the file stays worth translating.
//
// The `.w3x` is only READ. Nothing is repacked; the language file is the whole deliverable.
//
// `--merge` (the default) never overwrites a translation already in the file — it adds new keys
// blank and reports how many entries are still empty.
//
// FOUR THINGS THIS SCRIPT DOES NOT DO, and the shipped files have all of them: it rebuilds
// `text` from the literals IT harvests (an entry added by hand for a line it filters out — every
// `-gold #` cheat line, say — disappears on the next run), it writes no `names` index, and it
// knows nothing of the two `war3mapSkin.txt` tables, `skin` ([FrameDef] keys such as `KEY_QUESTS`)
// and `errors` ([Errors] keys such as `Nolumber`). So treat the `.zhCN.json` as hand-maintained:
// run this only to see what is missing, and diff before committing.
// `tools/map-i18n-lint.cjs` is the check that matters after an edit — it fails when a translation
// changes a name the script tests, and when a skin/error key the map overrides goes unanswered.

const { readFileSync, writeFileSync, existsSync, readdirSync } = require("node:fs");
const { dirname, join } = require("node:path");
const mpq = require("mdx-m3-viewer/dist/cjs/parsers/mpq");
const Archive = (mpq.default ?? mpq).Archive;
const War3MapW3u = require("mdx-m3-viewer/dist/cjs/parsers/w3x/w3u/file").default;
const War3MapW3d = require("mdx-m3-viewer/dist/cjs/parsers/w3x/w3d/file").default;

/**
 * DotA's hero abilities, English name → Chinese name + tooltip. DotA defines its skills as NEW
 * ability objects, so neither the install table nor the map's own strings carry a Chinese copy;
 * this is the only place their text can come from. Hand-written, one entry per skill, so the
 * generated `.zhCN.json` stays the single thing the engine reads — no per-map code.
 */
const ABILITY_ZH = require("./dota-ability-zh.json");

/**
 * DotA's item tooltips, keyed by the map's OWN `Ubertip` text (English in 6.83d, Portuguese in
 * the 6.90G port). Keying on the text instead of the item name is what keeps this complete: the
 * map ships 1,021 item entries over 571 distinct bodies (muted copies, per-charge bottles, mode
 * buttons), and every one of them is the text a shop can actually raise — a name key would give
 * several of them the wrong body. Generated from `Units\ItemStrings.txt` by diffing against
 * `tools/dota-item-zh.json`; a section whose body is not in here simply keeps the map's English.
 */
const ITEM_TEXT_ZH = require("./dota-item-zh.json");

/** DotA's unit/building names the dictionaries above still cannot answer for (announcements the
 *  script prints through dummy units, tower/shop names, Portuguese leftovers). English → Chinese. */
const UNIT_EXTRA_ZH = require("./dota-unit-name-zh.json");

/** Unit `Tip` (hover title) and `Ubertip` (hover body) as the MAP wrote them → Chinese. DotA
 *  authors these in English/Portuguese, and the install row cannot stand in for them. */
const UNIT_TEXT_ZH = require("./dota-unit-text-zh.json");

/**
 * DotA's hero-skill bodies, keyed by SKELETON: the map's `Ubertip` with every number outside a
 * `<Token,Field>` reference replaced by `{N}`. DotA stores one body per rank and the rank's
 * numbers sit inside the sentence, so 736 of 977 skills only change numbers between ranks. One
 * translation per skeleton therefore covers every rank, and `fillBodyNumbers` pours the rank's
 * own numbers back in — no skill shows another rank's damage.
 */
const ABILITY_BODY_ZH = require("./dota-ability-body-zh.json");

/** Digits outside `<Token,Field>` become {N}; the reference's own digits are field names, not prose. */
function bodySkeleton(text) {
  return text
    .split(/(<[^>]*>)/g)
    .map((part) => (part.startsWith("<") ? part : part.replace(/\d+(?:\.\d+)?/g, () => "{N}")))
    .join("");
}

/** Put a rank's numbers back into its translated skeleton, in the same order they were removed. */
function fillBodyNumbers(translated, english) {
  const numbers = (english
    .split(/(<[^>]*>)/g)
    .filter((part) => !part.startsWith("<"))
    .join(" ")
    .match(/\d+(?:\.\d+)?/g) ?? []);
  let next = 0;
  return translated.replace(/\{N\}/g, () => numbers[next++] ?? "");
}

/**
 * DotA's hero names, English → Chinese. The map renames every hero in its own string table and
 * ships no translation for them, and the install's zhCN data has never heard of these names (they
 * are DotA's, not the base game's) — so the map list, the spawn list and the pick screen all stay
 * English without this. Names, not proper names: the proper name is the hero's own ("Kunkka"),
 * which every Chinese DotA keeps in English anyway.
 */
const HERO_ZH = {
  // The heroes 6.90G added or renamed — its rows say these exact names, and without them the
  // unit keeps an English type name ("等级 1 Netherdrake") even though every other hero is Chinese.
  "Netherdrake": "冥界亚龙",
  "Sand King": "沙王",
  "Faceless Void": "虚空假面",
  "Doom Bringer": "末日使者",
  "Broodmother": "育母蜘蛛",
  "Lightning Revenant": "闪电幽魂",
  "Lifestealer": "噬魂鬼",
  "Queen of Pain": "痛苦女王",
  "Lone Druid": "德鲁伊",
  "Ursa Warrior": "熊战士",
  "Paladin": "圣骑士",
  "Omniknight": "全能骑士",
  "Crystal Maiden": "水晶室女",
  "Lord of Olympus": "奥林匹斯之王",
  "Vengeful Spirit": "复仇之魂",
  "Bloodseeker": "嗜血狂魔",
  "Dragon Knight": "龙骑士",
  "Phantom Lancer": "幻影长矛手",
  "Axe": "斧王",
  "Far Seer": "先知",
  "Prophet": "先知",
  "Shadow Shaman": "暗影萨满",
  "Enigma": "谜团",
  "Nerubian Weaver": "地穴编织者",
  "Dwarven Sniper": "矮人狙击手",
  "Soul Keeper": "灵魂守卫",
  "Juggernaut": "剑圣",
  "Bounty Hunter": "赏金猎人",
  "Venomancer": "剧毒术士",
  "Troll Warlord": "巨魔战将",
  "Skeleton King": "骷髅王",
  "Demon Witch": "恶魔巫师",
  "Goblin Techies": "地精工程师",
  "Naga Siren": "娜迦海妖",
  "Stealth Assassin": "隐形刺客",
  "Centaur Warchief": "半人马酋长",
  "Morphling": "变体精灵",
  "Magnataur": "猛犸",
  "Necro'lic": "死灵飞龙",
  "Lycanthrope": "狼人",
  "Oblivion": "遗忘法师",
  "Death Prophet": "死亡先知",
  "Moon Rider": "月之骑士",
  "Rogue Knight": "流浪剑客",
  "Gorgon": "蛇发女妖",
  "Silencer": "沉默术士",
  "Slayer": "秀逗魔导士",
  "Holy Knight": "圣骑士",
  "Beastmaster": "兽王",
  "Obsidian Destroyer": "黑曜毁灭者",
  "Shadow Priest": "暗影牧师",
  "Storm Spirit": "风暴之灵",
  "Clockwerk Goblin": "发条地精",
  "Admiral": "海军上将",
  "Murloc Nightcrawler": "鱼人夜行者",
  "Guardian Wisp": "精灵守卫",
  "Grand Magus": "大魔导师",
  "Ember Spirit": "灰烬之灵",
  "Skywrath Mage": "天怒法师",
  "Edgewalker": "边际行者",
  "Mortar Team": "迫击炮小队",
  "Slardar": "鱼人守卫",
  // …and the rest of 6.90G's roster. These rows have Propernames in the map's own
  // `Units\*UnitStrings.txt`, so they are the pick list; without an entry the taverns print the
  // English class name ("Alchemist", "Bristleback") next to Chinese heroes.
  "Bristleback": "钢背兽",
  "Geomancer": "地卜师",
  // "Bloodrune" is deliberately NOT translated: that is the map's own name for Meepo's row, and
  // 6.90G's unit-entering hook tests it by name (`GetUnitName(it) != "Bloodrune"`). See
  // SCRIPT_SENTINEL below.
  "Sacred Warrior": "神灵武士",
  "Undying": "不朽尸王",
  "Invoker": "祈求者",
  "Keeper of the Light": "光之守卫",
  "Flesh Golem": "血肉傀儡",
  "Ice Blast": "寒冰爆",
  "Ghost Revenant": "幽魂怨灵",
  "Spiritbreaker": "裂魂人",
  "Batrider": "蝙蝠骑士",
  "Chaos Knight": "混沌骑士",
  "Necrolyte": "死灵法师",
  "Slithereen Guard": "鱼人守卫",
  "Butcher": "屠夫",
  "Stone Giant": "山岭巨人",
  "Bone Fletcher": "骷髅射手",
  "Spectre": "幽鬼",
  "Twin Head Dragon": "双头龙",
  "Warlock": "术士",
  "Templar Assassin": "圣堂刺客",
  "Dummy: SlowTurn-Range": "假人：慢转身（远程）",
  "Dummy: FastTurn-Melee": "假人：快转身（近战）",
  "Dummy: SlowTurn-Melee": "假人：慢转身（近战）",
  "Dummy: FastTurn-Range": "假人：快转身（远程）",
  "Phoenix": "凤凰",
  "Tuskarr": "巨牙海民",
  "Disruptor": "干扰者",
  "Legion Commander": "军团指挥官",
  "Fire Panda": "火焰熊猫",
  "Gyrocopter": "矮人直升机",
  "Goblin Shredder": "地精撕裂者",
  "Alchemist": "炼金术士",
  "Priestess of the Moon": "月之女祭司",
  "Pit Lord": "深渊领主",
  "Faerie Dragon": "精灵龙",
  "Windrunner": "风行者",
  "Sissy": "胆小鬼",
  "Winter Wyvern": "寒冬飞龙",
  "Wyvern Outrider": "飞龙骑手",
  "Oracle": "神谕者",
  "Earth Spirit": "大地之灵",
};

/**
 * Non-hero units whose NAME is a line a player reads. DotA keeps its status messages in dummy
 * units and prints them by unit name, so "Player 1 " + n06A + n06B is how "Player 1 has
 * defaulted to … You will get 175 gold refunded…" reaches the screen — translating the unit is
 * the only way to translate the sentence. Keyed by the English name, used for every kind.
 */
const UNIT_ZH = {
  "Ancient Relic": "远古遗物",
  "has defaulted to": "默认选择了",
  "You will get 175 gold refunded when you pick a hero.": "选择英雄后将返还 175 金币。",
  "has defaulted to Normal Mode. You will get 175 gold refunded when you pick a hero.": "默认选择了普通模式。选择英雄后将返还 175 金币。",
  "has left the game": "已离开游戏",
  "has been automatically assigned": "已被自动分配",
  "has been randomly given": "已被随机分配",
  "has killed himself!": "击杀了他自己！",
  "has been killed by his teammate": "被队友击杀",
  "has been killed by Roshan": "被肉山击杀",
  "has been killed by Neutral Creeps": "被中立野怪击杀",
  "The Sentinel": "近卫军团",
  "The Scourge": "天灾军团",
  // Shop-interface sentences, also dummy-unit names.
  "Inventory is full": "物品栏已满",
  "Receita requirements not complete!": "合成卷轴需求未满足！",
  "You must have an empty slot to disassemble this item": "需要空物品栏才能拆分该物品",
  "Your hero is not allowed to wield this item": "你的英雄不能持有该物品",
  "Your crow is not allowed to wield this item": "你的信使不能持有该物品",
  "You are only allowed to carry one Armlet of Mordiggian": "只能携带一个莫尔迪基安的臂章",
  "You are only allowed to carry one Power Treads": "只能携带一双动力鞋",
  "You are not allowed to carry Observer Wards from enemy stores": "不能携带敌方商店的侦察守卫",
  "You do not need to purchase a recipe for this item": "该物品无需购买卷轴",
  "You do not have enough gold to select a Hero": "金币不足，无法选择英雄",
  "Do not use two avatars in right after each other, there is a warcraft engine bug with this": "不要连续使用两次分身，魔兽引擎存在相关缺陷",
  "Mekansm failed to heal": "梅肯斯姆治疗失败",
  "Can only target Heroes that have left the game": "只能选择已离开游戏的英雄",
  "Value valid between 10-46": "有效数值为 10-46",
  "Deathmatch is not compatible with these modes!": "死亡竞赛与这些模式不兼容！",
  "Invalid Game Mode Combination!": "无效的游戏模式组合！",
  "This code has already been activated": "该代码已被激活",
  "Only the person that picks game modes may enter this command": "只有选择游戏模式的玩家可以输入该命令",
  "Command must be entered between 15 and 60 seconds of gametime": "命令必须在游戏开始后 15 至 60 秒内输入",
  "Roll value must be between 1 and 2000": "掷骰数值必须在 1 到 2000 之间",
  "Invalid swap selection": "无效的交换选择",
  "Repicking has been disabled by the host": "房主已禁用重新选择",
  "League Mode is not compatible with these modes!": "联赛模式与这些模式不兼容！",
  "Melee Only": "仅近战",
  "The game must have an even number of players": "游戏人数必须为偶数",
  "You cannot attack Roshan from here": "无法从此处攻击肉山",
  "Cannot Teleport a unit casting Grapple": "无法传送正在施放钩链的单位",
  "Illusory Orb not found": "未找到幻象法球",
  "This target has disablehelp on": "该目标已开启禁止帮助",
  "Unable to Morph Replicate": "无法使用变体复制",
  "You have already voted": "你已经投过票了",
  "Cannot use nether swap here": "无法在此处使用幽冥交换",
  "Cannot target enemy units at level 1": "1 级时无法以敌方单位为目标",
  "Target unit is not valid or target is dead": "目标单位无效或已死亡",
  "Casting hero is not valid or is dead": "施法英雄无效或已死亡",
  "No nearby target found": "附近没有目标",
  "Cannot use Aphotic Shield on Doomed Unit": "无法对受到末日效果的单位使用无光之盾",
  "Must target allied building": "必须以友方建筑为目标",
  "Cannot use Vacuum here": "无法在此处使用真空",
  "Cannot use Lightning Grapple here": "无法在此处使用闪电钩链",
  "Spirit Bear is already summoned!": "灵熊已被召唤！",
  // The map's own creeps/dummies whose names a player can see on hover.
  "Spirit Bear": "灵熊",
  "Zone Indicator": "区域指示器",
  "Medivh": "麦迪文",
  "Defiled Fountain of Life": "被污染的生命之泉",
  "Serpent Ward": "蛇棒守卫",
  "Death Ward": "死亡守卫",
  "Weapons Dealer": "武器商人",
  "Demonic Artifacts": "恶魔神器",
  "Sena The Accessorizer": "塞纳·配饰师",
  "Fire": "火焰",
  "Earth": "大地",
  "Storm Nível 2": "风暴（2 级）",
  "Storm Nível 3": "风暴（3 级）",
  "Earth Nível 3": "大地（3 级）",
};

/** `|cAARRGGBB` / `|r` removed — DotA puts the colour inside the sentence, so the same line
 *  exists in a hundred colourings and a dictionary key has to ignore them. */
const plainText = (s) => s.replace(/\|c[0-9a-fA-F]{8}/gi, "").replace(/\|r/gi, "");

/**
 * The AI command interface's own sentences: dummy items whose NAME is the line the player reads
 * (the AI chat report, the `-o` help list). Chinese here is keyed with the colour codes removed,
 * because the same sentence carries different highlight colours in different rows.
 */
const REPORT_ZH = {
  "Empty Bottle Store": "空瓶（商店）",
  "Indo atacarRoshan": "前往攻击肉山",
  "Pede para ativarRuna de defesa": "请求激活防御符文",
  "Recusado:(Roshanainda não recarregou)": "已拒绝：（肉山尚未刷新）",
  "Negative (Morto)": "负面（已死亡）",
  "Negative (Vida baixa)": "负面（生命值低）",
  "Negative (Em combate)": "负面（战斗中）",
  "Negative (Longe demais)": "负面（距离太远）",
  ": Informação de visão": "视野信息",
  ": Miss Informação": "未命中信息",
  "'s ": "的",
  " está no círculo.": "在圆圈内。",
  "AI Relatório miss Sistema de heróis jáDesligado": "AI 报告/未命中系统：已关闭",
  "-aimsgmiss para reativar.": "-aimsgmiss 以重新启用。",
  "adicionou inimigo AI Comando: -osden, -oden, -oaen": "已添加敌方 AI 命令：-osden, -oden, -oaen",
  "Você pode dar aos aliados AI comandos especiais (veja a ajuda).": "你可以给友方 AI 下达特殊命令（见帮助）。",
  "AI avisa o jogador para ativar a runa, não usa sozinhoRuna de defesa": "AI 会提醒玩家激活防御符文，不会自行使用",
  "Todos os aliados AI vai escolher sozinho qual rota empurrar": "所有友方 AI 将自行选择推进路线",
  'Digite antes dos comandos abaixo \\"-o\\",\\"-c\\" ou \\" c\\" :': "在下列命令前输入 \"-o\"、\"-c\" 或 \" c\"：",
  "pn - Deixe AI escolher sozinho qual rota empurrar": "pn - 让 AI 自行选择推进路线",
  "pl - Todos AI vai empurrar o topo": "pl - 所有 AI 推进上路",
  "pr - Todos AI vai empurrar baixo": "pr - 所有 AI 推进下路",
  "pm - Todos AI vai empurrar o meio": "pm - 所有 AI 推进中路",
  "Todos os aliados AI vai empurrar o topo": "所有友方 AI 将推进上路",
  "Todos os aliados AI vai empurrar baixo": "所有友方 AI 将推进下路",
  "Todos os aliados AI vai empurrar o meio": "所有友方 AI 将推进中路",
  'Digite antes dos comandos abaixo \\"-o\\",\\"-c\\" ou \\" c\\': "在下列命令前输入 \"-o\"、\"-c\" 或 \" c\"",
  'Você também pode usar \\",\\"para comandar vários AI:': "你也可以用 \",\" 同时指挥多个 AI：",
  "t <Número do jogador a>[,<Número do jogador b>] <número do jogador alvo>- Emboscar herói alvo": "t <玩家 A>[,<玩家 B>] <目标玩家> - 伏击目标英雄",
  "t a <número do jogador alvo>- Todos os aliados vão emboscar esse herói": "t a <目标玩家> - 所有友方将伏击该英雄",
  'Digite antes dos comandos abaixo \\"-o\\",\\"-c\\" ou \\" c\\" ,': "在下列命令前输入 \"-o\"、\"-c\" 或 \" c\"，",
  "gl<Número do jogador> - Comando AI Ir ao topo": "gl<玩家> - 命令 AI 前往上路",
  "gl<Número do jogador> - Comando AI Ir para baixo": "gl<玩家> - 命令 AI 前往下路",
  "gl<Número do jogador> - Comando AI Ir ao meio": "gl<玩家> - 命令 AI 前往中路",
  "AI jogador comprou para você umAnimal Couriere colocou no seu círculo": "AI 玩家为你购买了动物信使并放入了你的圆环",
  "Magical Bottle- Bounty": "魔瓶（赏金神符）",
};

/**
 * DotA's items, English → Chinese. The map defines every item as a NEW object, so the install's
 * own item table answers for almost none of them (28 of 1025 in 6.83d). This is the shop: the
 * names a player reads on every visit, so they are worth a dictionary while their tooltips are not.
 *
 * Variants are composed, not listed: "X Recipe" → "X卷轴", "X (ranged)" → "X（远程）",
 * "Dagon Level 3" → "达贡之神力（3级）", "Aghanim's Scepter (Pudge)" → "阿哈利姆神杖".
 */
const ITEM_ZH = {
  "Blades of Attack": "攻击之爪",
  "Broadsword": "大剑",
  "Claymore": "阔剑",
  "Mithril Hammer": "秘银锤",
  "Ogre Axe": "食人魔之斧",
  "Blade of Alacrity": "欢欣之刃",
  "Boots of Elvenskin": "精灵皮靴",
  "Staff of Wizardry": "法师长袍",
  "Robe of the Magi": "巫师法袍",
  "Slippers of Agility": "敏捷便鞋",
  "Mantle of Intelligence": "智力斗篷",
  "Gauntlets of Strength": "力量手套",
  "Circlet of Nobility": "贵族圆环",
  "Ironwood Branch": "铁树枝干",
  "Quelling Blade": "压制之刃",
  "Stout Shield": "圆盾",
  "Poor Man's Shield": "穷鬼盾",
  "Ring of Protection": "守护指环",
  "Ring of Regeneration": "恢复指环",
  "Ring of Health": "治疗指环",
  "Ring of Basilius": "圣殿指环",
  "Ring of Aquila": "天鹰之戒",
  "Energy Booster": "能量之球",
  "Vitality Booster": "活力之球",
  "Point Booster": "精气之球",
  "Soul Booster": "灵魂之球",
  "Ultimate Orb": "极限法球",
  "Mystic Staff": "神秘法杖",
  "Eaglehorn": "鹰歌弓",
  "Sacred Relic": "圣者遗物",
  "Demon Edge": "恶魔刀锋",
  "Messerschmidt's Reaver": "掠夺者之斧",
  "Hyperstone": "振奋宝石",
  "Javelin": "标枪",
  "Quarterstaff": "短棍",
  "Sobi Mask": "索比面具",
  "Void Stone": "虚无宝石",
  "Gloves of Haste": "加速手套",
  "Belt of Giant Strength": "巨人力量腰带",
  "Boots of Speed": "速度之靴",
  "Chainmail": "锁子甲",
  "Chain Mail": "锁子甲",
  "Plate Mail": "板甲",
  "Helm of Iron Will": "铁意头盔",
  "Mask of Death": "死亡面具",
  "Talisman of Evasion": "闪避护符",
  "Ghost Scepter": "幽魂权杖",
  "Magic Stick": "魔法棒",
  "Magic Wand": "魔杖",
  "Clarity Potion": "净化药水",
  "Healing Salve": "治疗药膏",
  "Ancient Tango of Essifation": "艾西菲的远古祭祀",
  "Dust of Appearance": "显影之尘",
  "Smoke of Deceit": "诡计之雾",
  "Observer Wards": "侦察守卫",
  "Sentry Wards": "岗哨守卫",
  "Gem of True Sight": "真视宝石",
  "Animal Courier": "动物信使",
  "Flying Courier": "飞行信使",
  "Boots of Travel": "远行鞋",
  "Phase Boots": "相位鞋",
  "Power Treads": "动力鞋",
  "Arcane Boots": "秘法鞋",
  "Tranquil Boots": "静谧之鞋",
  "Hand of Midas": "迈达斯之手",
  "Battle Fury": "狂战斧",
  "Black King Bar": "黑皇杖",
  "Blade Mail": "刃甲",
  "Bloodstone": "血精石",
  "Buriza-do Kyanon": "大炮",
  "Cranium Basher": "碎颅锤",
  "Crimson Guard": "赤红甲",
  "Crystalys": "水晶剑",
  "Dagon": "达贡之神力",
  "Diffusal Blade": "散失之刃",
  "Divine Rapier": "圣剑",
  "Ethereal Blade": "虚灵之刃",
  "Eul's Scepter of Divinity": "尤尔的神圣法杖",
  "Eye of Skadi": "斯嘉蒂之眼",
  "Force Staff": "原力法杖",
  "Glimmer Cape": "微光披风",
  "Guinsoo's Scythe of Vyse": "邪恶镰刀",
  "Headdress of Rejuvenation": "恢复头巾",
  "Heart of Tarrasque": "恐鳌之心",
  "Heaven's Halberd": "天堂之戟",
  "Helm of the Dominator": "支配头盔",
  "Hood of Defiance": "挑战头巾",
  "Kelen's Dagger": "科勒的匕首",
  "Khadgar's Pipe of Insight": "卡嘉长笛",
  "Linken's Sphere": "林肯法球",
  "Linkin's Sphere": "林肯法球",
  "Lothar's Edge": "洛萨之锋",
  "Maelstrom": "漩涡",
  "Manta Style": "分身斧",
  "Mask of Madness": "疯狂面具",
  "Medallion of Courage": "勇气勋章",
  "Mekansm": "梅肯斯姆",
  "Mjollnir": "雷神之锤",
  "Monkey King Bar": "金箍棒",
  "Moon Shard": "银月之晶",
  "Nathrezim Buckler": "纳斯雷兹姆护腕",
  "Necronomicon": "死灵书",
  "Null Talisman": "空灵挂件",
  "Oblivion Staff": "遗忘法杖",
  "Orchid Malevolence": "紫怨",
  "Perseverance": "坚韧球",
  "Planeswalker's Cloak": "位面法衣",
  "Radiance": "辉耀",
  "Refresher Orb": "刷新球",
  "Rod of Atos": "阿托斯之棍",
  "Sange": "散华",
  "Sange and Yasha": "散夜对剑",
  "Yasha": "夜叉",
  "Satanic": "撒旦之邪力",
  "Scroll of Town Portal": "回城卷轴",
  "Shadow Amulet": "暗影护符",
  "Shiva's Guard": "希瓦的守护",
  "Soul Ring": "灵魂之戒",
  "Stygian Desolator": "黯灭",
  "The Butterfly": "蝴蝶",
  "Urn of Shadows": "影之灵龛",
  "Vanguard": "先锋盾",
  "Veil of Discord": "纷争面纱",
  "Vladmir's Offering": "弗拉迪米尔的祭品",
  "Wand of Illusion": "幻影魔杖",
  "Wraith Band": "怨灵系带",
  "Bracer": "护腕",
  "Aegis of the Immortal": "不朽之守护",
  "Cheese": "奶酪",
  "Ancient Janggo of Endurance": "韧鼓",
  "Armlet of Mordiggian": "莫尔迪基安的臂章",
  "Orb of Venom": "毒液之球",
  "Orb of Corruption": "腐蚀之球",
  "Orb of Lightning": "闪电之球",
  "Orb of Fire": "火焰之球",
  "Bottle": "魔瓶",
  "Empty Bottle": "空瓶",
  "Magic Bottle": "魔瓶",
  "Magical Bottle": "魔瓶",
  "Divine Rapier ": "圣剑",
  "Abyssal Blade": "深渊之刃",
  "Assault Cuirass": "强袭胸甲",
  "Arcane Ring": "秘法指环",
  "Ancient Medallion": "远古勋章",
  "Corruptor": "腐蚀者",
  "Ghost Potion": "幽魂药水",
  "Poison Powder": "剧毒粉末",
  "Blade of the Reaper": "死神之刃",
  "Basic Peach": "小蜜桃",
  "Greater Peach": "大蜜桃",
  "Disassembler": "拆分器",
  "Retaliation": "报复",
  "The Leveler": "平衡者",
  "Totem of Earth": "大地图腾",
  "Totem of Fire": "火焰图腾",
  "Totem of Water": "水之图腾",
  "Totem of Wind": "风之图腾",
  "Aghanim's Scepter": "阿哈利姆神杖",
  "Double Damage": "双倍伤害",
  "Haste": "急速",
  "Bounty": "赏金神符",
  "Illusion": "幻象",
  "Invisibility": "隐身",
  "Regeneration": "恢复",
  "Heart of Tarrasque": "恐鳌之心",
  "Observer Ward": "侦察守卫",
  "Sentry Ward": "岗哨守卫",
  "Blight Stone": "枯萎之石",
  "BloodThorn": "血棘",
  "Enchanted Mango": "魔法芒果",
  "Faerie Fire": "仙灵之火",
  "Guardian Greaves": "卫士胫甲",
  "Iron Claw": "铁爪",
  "Octarine Core": "玲珑心",
  "Silver Edge": "白银之锋",
  "Solar Crest": "炎阳纹章",
  "Spirit Of The Wind": "风之精灵",
  "Magic Dragon Gun": "魔龙枪",
  "Ntome Of Knowledge": "知识之书",
  "Tome Of Knowledge": "知识之书",
  "Item temporário": "临时物品",
  "Lâmina Ceifadora": "死神之刃",
  "Retaliação": "报复",
  // The PT-BR port's rune names.
  "Dano dobrado": "双倍伤害",
  "Ligado": "开",
  "Desligado": "关",
  "Velocidade": "急速",
  "Recompensa": "赏金神符",
  "Ilusão": "幻象",
  "Recupera": "恢复",
  "Invisibilidade": "隐身",
  // The AI command menu. Its buttons are dummy items, so their names are what a player reads.
  "AI Comando": "AI 命令",
  "Cancelar": "取消",
  "Cancelar emboscada": "取消伏击",
  "Comandar quem:": "指挥谁：",
  "Comando:": "命令：",
  "Defender": "防守",
  "Defender a base": "防守基地",
  "Defender área alterada": "防守指定区域",
  "Definir rota para empurrar": "设置推进路线",
  "Desligar farm na selva": "关闭打野",
  "Desligar troca automática de rota": "关闭自动换线",
  "Digite": "输入",
  "Emboscada": "伏击",
  "Emboscada.": "伏击。",
  "Escolher Salve em vez de Tango": "选择治疗药膏而非艾西菲",
  "Escolher Tango em vez de Salve": "选择艾西菲而非治疗药膏",
  "Farm na selva já": "已在打野",
  "Ficar na base": "留在基地",
  "Indo emboscar": "前往伏击",
  "Ir para baixo": "前往下路",
  "Ir para baixo(Automático)": "前往下路（自动）",
  "Ir para baixo(Substituir)": "前往下路（替换）",
  "Ir para o meio": "前往中路",
  "Ir para o meio(Automático)": "前往中路（自动）",
  "Ir para o meio(Baixo está longe demais)": "前往中路（下路太远）",
  "Ir para o meio(Topo está longe demais)": "前往中路（上路太远）",
  "Ir para o topo": "前往上路",
  "Ir para o topo(Automático)": "前往上路（自动）",
  "Ir para o topo(Substituir)": "前往上路（替换）",
  "Ligar farm na selva": "开启打野",
  "Ligar troca automática de rota": "开启自动换线",
  "Meio": "中路",
  "Topo": "上路",
  "Qual rota:": "哪条路：",
  "Rota aleatória": "随机路线",
  "Todos os aliados": "所有盟友",
  "Voltando para casa": "返回基地",
  "Voltar à fonte": "返回泉水",
  "Voltar a empurrar": "恢复推进",
  "Ataque": "攻击",
  "Ataque Roshan": "攻击肉山",
  "Alvo inválido": "目标无效",
  "Alvo invisível": "目标隐身",
  "Alvo morto": "目标已死亡",
  "Alvo não é inimigo": "目标不是敌人",
  "Alvo não pode ser ilusão": "目标不能是幻象",
  "Negative (Em combate)": "负面（战斗中）",
  "Negative (Longe demais)": "负面（距离太远）",
  "Negative (Morto)": "负面（已死亡）",
  "Negative (Vida baixa)": "负面（生命值低）",
  "Já está nesta rota": "已在该路线",
  "foi escolhido capitão; time:": "被选为队长；队伍：",
  // Basic shop stock (6.90G defines these as new objects, so the install table never answers).
  "Potion of Healing": "治疗药水",
  "Potion of Mana": "魔法药水",
  "Scroll of Healing": "治疗卷轴",
  "Rod of Necromancy": "亡灵权杖",
  "Anti-magic Potion": "反魔法药水",
  "Lesser Clarity Potion": "小净化药水",
  "Lesser Replenishment Potion": "小恢复药水",
  "Scroll of Regeneration": "恢复卷轴",
  "Sacrificial Skull": "献祭头骨",
  "Moonstone": "月之石",
  "Tiny Great Hall": "微型大厅",
  "Ivory Tower": "象牙塔",
  "Staff of Preservation": "保存法杖",
  "Staff of Sanctuary": "圣域法杖",
  "Scroll of Speed": "加速卷轴",
  "Medusa Pebble": "美杜莎之石",
  "Altar": "祭坛",
  "Town Hall or Great Hall or Tree of Life or Necropolis": "城镇大厅或大厅或生命之树或亡者大厅",
  "Keep or Stronghold or Tree of Ages or Halls of the Dead": "主城或要塞或远古之树或亡者大厅",
  // AI status lines — the same dummy items, printed in chat while the AI plays.
  "Empurrando": "推进中",
  "Indo atacar Roshan": "前往攻击肉山",
  "Pede para ativar Runa de defesa": "请求激活防御符文",
  "Modo de esquiva baixa ligado": "闪避模式：低（开）",
  "Modo de esquiva baixa desligado": "闪避模式：低（关）",
  "Recusado:(Roshan ainda não recarregou)": "已拒绝：（肉山尚未刷新）",
  "Informação de visão": "视野信息",
  "Miss Informação": "未命中信息",
  "Voltar": "返回",
  "Recuar": "撤退",
  "Trocar de rota": "换线",
  "Outros comandos..": "其他命令…",
  "Baixo": "下路",
  "Troca automática de rota já": "自动换线已",
  "AI Relatório miss Sistema de heróis já": "AI 报告/未命中系统已",
  "para reativar.": "以重新启用。",
  "Digite antes dos comandos abaixo \"-o\",\"-c\" 或 \" c\" :": "在下列命令前输入 \"-o\"、\"-c\" 或 \" c\"：",
  "Deixe AI escolher sozinho qual rota empurrar": "让 AI 自行选择推进路线",
  "Todos AI vai empurrar o topo": "所有 AI 将推进上路",
  "Todos AI vai empurrar baixo": "所有 AI 将推进下路",
  "Todos AI vai empurrar o meio": "所有 AI 将推进中路",
  "Comando:Alvo -": "命令：目标 -",
  "Comando: Ação -": "命令：行动 -",
  "t <Jogador A>[,<Jogador B>] <Alvo jogador>": "t <玩家 A>[,<玩家 B>] <目标玩家>",
  "t a <Alvo jogador>": "t a <目标玩家>",
  "gl<Jogador>": "gl<玩家>",
  "gm<Jogador>": "gm<玩家>",
  "gb<Jogador>": "gb<玩家>",
  "Você também pode comandar vários AI juntos usando \",\"": "你也可以用 \",\" 同时指挥多个 AI",
  "AI Comprar: Animal de carga para": "AI 购买：动物信使给",
  "e colocou no seu círculo": "并放入了你的圆环",
  "Jogador": "玩家",
  "Morto": "已死亡",
};

/** Parenthetical/suffix words a composite item name can carry, and their Chinese. */
const ITEM_TAGS = {
  "melee": "近战",
  "ranged": "远程",
  "empty": "空",
  "broken": "破损",
  "courier": "信使",
  "courier edition": "信使版",
  "on": "开",
  "off": "关",
  "on,courier": "开·信使",
  "off,courier": "关·信使",
  "negative": "负",
  "heroes": "仅英雄",
  "agility": "敏捷",
  "intelligence": "智力",
  "strength": "力量",
  "normal": "普通",
  "active": "激活",
  "inactive": "未激活",
  "single": "单个",
  "bounty": "赏金神符",
  "double damage": "双倍伤害",
  "haste": "急速",
  "illusion": "幻象",
  "invisibility": "隐身",
  "regeneration": "恢复",
  "disabled": "禁用",
  "genuine": "珍藏版",
  // The PT-BR port spells its item modes in Portuguese.
  "desativado": "禁用",
  "ligado": "开",
  "desligado": "关",
  "agilidade": "敏捷",
  "força": "力量",
  "inteligência": "智力",
  "herói": "仅英雄",
  "runa de defesa": "防御符文",
  "automático": "自动",
  "substituir": "替换",
  "baixo está longe demais": "下路太远",
  "topo está longe demais": "上路太远",
};

/**
 * DotA's item tooltips, English item name → Chinese. The map keeps every tooltip in its own
 * `Units\ItemStrings.txt` (`Ubertip=…`), so the item hover has text — just no Chinese anywhere:
 * these are new items, and the install's zhCN item table has never seen their rawcodes. Keys are
 * the plain item names (`itemParts` normalises "Power Treads (Agility)" → "Power Treads").
 *
 * Written for the shop hover only; it never touches the item's stats. `|n` is a line break and
 * `|cffffff00…|r` is the game's "use" colour, same markup the map itself uses.
 */
const ITEM_DESC_ZH = {
  "Healing Salve": "|cff87ceeb非战斗消耗品|r|n在 10 秒内为单位恢复 400 点生命。受到攻击会中断效果。",
  "Clarity Potion": "|cff87ceeb非战斗消耗品|r|n在 30 秒内恢复 100 点魔法。受到攻击会中断效果。",
  "Empty Bottle": "|cff87ceeb消耗品|r|n可储存 3 次恢复充能（每次 135 生命、70 魔法），也能装下神符。靠近友方泉水会自动补满。",
  "Magic Bottle": "|cff87ceeb消耗品|r|n可储存 3 次恢复充能（每次 135 生命、70 魔法），也能装下神符。靠近友方泉水会自动补满。",
  "Magical Bottle": "|cff87ceeb消耗品|r|n可储存 3 次恢复充能（每次 135 生命、70 魔法），也能装下神符。靠近友方泉水会自动补满。",
  "Boots of Speed": "+50 移动速度。|n|n|c00ff0303移动速度加成不与其他鞋类叠加。|r",
  "Gloves of Haste": "+15 攻击速度。",
  "Boots of Elvenskin": "+6 敏捷。",
  "Power Treads": "+60 移动速度，+30 攻击速度。|n|cffffff00切换：|r在力量、敏捷、智力之间切换，并附加对应属性。",
  "Phase Boots": "+55 移动速度，+24 攻击力。|n|cffffff00激活：|r提升 16% 移动速度并可穿越单位，持续 4 秒。",
  "Arcane Boots": "+65 移动速度。|n|cffffff00使用：|r为周围友军恢复 135 点魔法。",
  "Tranquil Boots": "+85 移动速度，+3 护甲，+10 生命恢复。攻击或受到攻击后短暂失效。",
  "Boots of Travel": "+100 移动速度。|n|cffffff00使用：|r传送到友方建筑或友方小兵。",
  "Scroll of Town Portal": "|cffffff00使用：|r传送到友方建筑，引导 3 秒。",
  "Ancient Tango of Essifation": "|cffffff00使用：|r吃掉一棵树，在 16 秒内恢复 115 点生命。可使用 4 次。",
  "Magic Stick": "|cffffff00使用：|r每点充能恢复 15 点生命与魔法（最多 10 点）。附近有敌人施法时获得充能。",
  "Magic Wand": "+3 全属性。|n|cffffff00使用：|r每点充能恢复 15 点生命与魔法（最多 15 点）。",
  "Observer Wards": "|cffffff00使用：|r在指定地点放置一个侦察守卫，提供视野，持续 6 分钟。",
  "Sentry Wards": "|cffffff00使用：|r在指定地点放置一个岗哨守卫，可看见隐身单位，持续 3 分钟。",
  "Animal Courier": "|cffffff00使用：|r召唤一只信使，可在商店与英雄之间运送物品。",
  "Flying Courier": "|cffffff00使用：|r让信使获得飞行能力，移动更快并可穿越地形。",
  "Black King Bar": "+10 力量，+24 攻击力。|n|cffffff00激活：|r获得技能免疫，持续 10 秒；每次使用后持续时间递减。",
  "Kelen's Dagger": "|cffffff00激活：|r传送到 1200 距离内的指定地点。受到伤害后 3 秒内无法使用。",
  "Radiance": "+65 攻击力，+17% 闪避。|n|cffffff00被动：|r每秒对周围 650 范围内的敌人造成 50 点伤害。",
  "Satanic": "+25 力量，+50 攻击力。|n|cffffff00激活：|r5 秒内吸血提升至 175%。",
  "Heart of Tarrasque": "+40 力量。|n|cffffff00被动：|r极大提升生命恢复速度。",
  "The Butterfly": "+30 敏捷，+30 攻击力，+35% 闪避。",
  "Monkey King Bar": "+88 攻击力。|n|cffffff00被动：|r攻击有 35% 几率造成 100 点额外伤害，并无视闪避。",
  "Divine Rapier": "+330 攻击力。|n|cffffff00被动：|r持有者死亡时掉落。",
  "Aegis of the Immortal": "|cffffff00被动：|r死亡后 5 秒在原地复活，并恢复全部生命与魔法；使用一次后消失。",
  "Cheese": "|cffffff00使用：|r恢复 2500 点生命与 1500 点魔法。",
  "Aghanim's Scepter": "+10 全属性，+200 生命，+150 魔法。|n|cffffff00被动：|r强化部分英雄的终极技能。",
  "Manta Style": "+26 敏捷，+10 力量，+15 攻击速度。|n|cffffff00激活：|r制造两个幻象并解除部分负面效果。",
  "Sange and Yasha": "+16 力量，+16 敏捷，+16 攻击力，+16 攻击速度，+12% 移动速度。",
  "Battle Fury": "+65 攻击力，+6 生命恢复。|n|cffffff00被动：|r攻击对周围单位造成 35% 溅射伤害。",
  "Cranium Basher": "+40 攻击力，+6 力量。|n|cffffff00被动：|r攻击有 25% 几率造成 1.4 秒眩晕。",
  "Eye of Skadi": "+25 全属性，+200 生命，+200 魔法。|n|cffffff00被动：|r攻击使敌人减速。",
  "Guinsoo's Scythe of Vyse": "+10 力量，+10 敏捷，+35 智力。|n|cffffff00使用：|r将目标变成绵羊，持续 3.5 秒。",
  "Shiva's Guard": "+30 智力，+15 护甲。|n|cffffff00激活：|r对周围敌人造成 200 点伤害并减速。",
  "Linken's Sphere": "+15 全属性，+6 生命恢复。|n|cffffff00被动：|r每 14 秒抵挡一次指向性法术。",
  "Mjollnir": "+80 攻击速度，+35 攻击力。|n|cffffff00被动：|r攻击有 25% 几率释放连锁闪电。",
  "Assault Cuirass": "+10 护甲，+35 攻击速度。|n|cffffff00光环：|r周围友军 +5 护甲、+20 攻击速度，敌人 -5 护甲。",
  "Vanguard": "+250 生命，+6 生命恢复。|n|cffffff00被动：|r受到攻击时有 70% 几率格挡 40 点伤害。",
  "Hand of Midas": "+30 攻击速度。|n|cffffff00使用：|r瞬间杀死一个非英雄单位，并获得 190 金币。",
  "Force Staff": "+10 智力，+10 攻击力。|n|cffffff00使用：|r将目标向其面朝方向推进 600 距离。",
  "Orchid Malevolence": "+25 智力，+30 攻击速度。|n|cffffff00使用：|r使目标沉默 5 秒，结束后受到 20% 额外伤害。",
  "Eul's Scepter of Divinity": "+10 智力，+35 移动速度。|n|cffffff00使用：|r将目标吹上天空 2.5 秒。",
  "Medallion of Courage": "+6 护甲。|n|cffffff00使用：|r降低目标 6 点护甲，自身也降低 6 点护甲。",
  "Urn of Shadows": "+6 力量。|n|cffffff00使用：|r对敌人造成 150 点伤害，或为友军恢复 400 点生命。",
  "Blade Mail": "+22 攻击力，+5 护甲。|n|cffffff00激活：|r将受到的伤害反弹给攻击者，持续 4 秒。",
  "Hood of Defiance": "+30% 魔法抗性，+8 生命恢复。",
  "Vladmir's Offering": "|cffffff00光环：|r周围友军获得吸血、攻击力、护甲与魔法恢复加成。",
  "Mekansm": "+5 全属性，+5 护甲，+5 生命恢复。|n|cffffff00使用：|r为周围友军恢复 250 点生命并提升 2 点护甲。",
  "Khadgar's Pipe of Insight": "+30% 魔法抗性，+10 生命恢复。|n|cffffff00使用：|r为周围友军提供 400 点魔法伤害护盾。",
  "Soul Ring": "+3 生命恢复。|n|cffffff00使用：|r牺牲 150 点生命换取 150 点魔法。",
  "Ring of Basilius": "+2 护甲。|n|cffffff00光环：|r周围友军获得护甲与魔法恢复。",
  "Ring of Aquila": "+18 攻击力，+2 护甲，+1 魔法恢复。",
  "Stout Shield": "|cffffff00被动：|r受到攻击时有 60% 几率格挡 20 点伤害。",
  "Poor Man's Shield": "+6 敏捷。|n|cffffff00被动：|r受到攻击时有 100% 几率格挡 20 点伤害（英雄为 10 点）。",
  "Quelling Blade": "+24% 对非英雄单位伤害。|n|cffffff00使用：|r砍倒一棵树。",
  "Helm of the Dominator": "+20 攻击力。|n|cffffff00使用：|r支配一个非英雄单位。",
  "Armlet of Mordiggian": "+25 攻击力，+5 护甲，+7 生命恢复。|n|cffffff00激活：|r提升 25 力量，但每秒流失生命。",
  "Diffusal Blade": "+22 敏捷，+6 智力。|n|cffffff00使用：|r净化目标，对幻象造成额外伤害。",
  "Necronomicon": "+6 力量。|n|cffffff00使用：|r召唤死灵战士与死灵射手为你作战。",
  "Refresher Orb": "+5 生命恢复，+200% 魔法恢复。|n|cffffff00使用：|r重置所有技能与物品的冷却时间。",
  "Veil of Discord": "+6 全属性，+6 护甲。|n|cffffff00使用：|r降低周围敌人的魔法抗性。",
  "Rod of Atos": "+25 智力，+250 生命。|n|cffffff00使用：|r使目标减速，持续 4 秒。",
  "Glimmer Cape": "+20% 魔法抗性。|n|cffffff00使用：|r使目标隐身并提升魔法抗性，持续 5 秒。",
  "Octarine Core": "+25 智力，+450 生命，+400 魔法。|n|cffffff00被动：|r所有技能与物品的冷却时间降低 25%。",
  "Moon Shard": "+120 攻击速度。",
  "Abyssal Blade": "+100 攻击力，+10 力量。|n|cffffff00被动：|r攻击有 25% 几率造成 1.4 秒眩晕（无视技能免疫）。",
  "Crimson Guard": "+5 护甲，+250 生命。|n|cffffff00激活：|r为周围友军提供抵挡 55 点伤害的护盾，持续 2 秒。",
  "Ghost Scepter": "+7 全属性。|n|cffffff00使用：|r使目标虚无 4 秒，免疫物理攻击但受到额外魔法伤害。",
  "Ethereal Blade": "+40 敏捷，+10 智力。|n|cffffff00使用：|r使目标虚无，并造成其主属性 75% 的魔法伤害。",
  "Dust of Appearance": "|cffffff00使用：|r使周围隐身单位现形并减速，持续 12 秒。",
  "Smoke of Deceit": "|cffffff00使用：|r使周围友军隐身，持续 30 秒。",
  "Gem of True Sight": "|cffffff00被动：|r看见周围 1100 范围内的隐身单位。",
  "Talisman of Evasion": "+25% 闪避。",
  "Hyperstone": "+55 攻击速度。",
  "Sacred Relic": "+60 攻击力。",
  "Demon Edge": "+46 攻击力。",
  "Messerschmidt's Reaver": "+25 力量。",
  "Ultimate Orb": "+10 全属性。",
  "Mystic Staff": "+25 智力。",
  "Eaglehorn": "+25 敏捷。",
};

/** The plain item name and its mode tags, e.g. "Power Treads (Agility)" → { name: "Power Treads",
 *  tags: ["敏捷"] }. Shared by the name table and the tooltip table so a variant of the same item
 *  reads the same key in both. */
function itemParts(english) {
  // "Monkey King Bar(Ligado)|nMonkey King Bar": the map names the same item twice, once with a
  // status tag and once plain. The plain one is the name; the tag is read off the first half.
  let name = english.replace(/\|c[0-9a-fA-F]{8}/g, "").replace(/\|r/gi, "").split("|n").pop().trim();
  const tags = [];
  // "Magical Bottle - 1/3" / "Magical Bottle - Bounty": charge count or the rune it holds.
  const bottle = /^(Magical Bottle|Magic Bottle) - (.+)$/i.exec(name);
  if (bottle) {
    name = "Magical Bottle";
    tags.push(/^\d\/\d$/.test(bottle[2]) ? bottle[2] : ITEM_TAGS[bottle[2].toLowerCase()] ?? "");
  }
  // Trailing parentheticals, innermost last: "Diffusal Blade Level 2(Empty)".
  for (let m = /\s*\(([^()]*)\)\s*$/.exec(name); m; m = /\s*\(([^()]*)\)\s*$/.exec(name)) {
    const inner = m[1].replace(/[|][a-zA-Z0-9]+/g, "").trim();
    name = name.slice(0, m.index).trim();
    tags.unshift(/^\d+$/.test(inner) ? `${inner}级` : ITEM_TAGS[inner.toLowerCase()] ?? "");
  }
  // " - Inactive" / " - 1/3".
  const dash = /^(.*?) - (.+)$/.exec(name);
  if (dash) {
    const tag = /^\d+$/.test(dash[2]) ? `${dash[2]}级` : ITEM_TAGS[dash[2].toLowerCase()] ?? "";
    if (tag) { name = dash[1]; tags.unshift(tag); }
  }
  // " Recipe" and " Level N".
  if (/ Recipe$/i.test(name)) { name = name.replace(/ Recipe$/i, ""); tags.push("卷轴"); }
  const level = /^(.*?) Level (\d+)$/i.exec(name);
  if (level) { name = level[1]; tags.unshift(`${level[2]}级`); }
  if (/ Single$/i.test(name)) { name = name.replace(/ Single$/i, ""); tags.push("单个"); }
  // A leading mode ("Disabled Heart of Tarrasque") or a trailing one ("Quelling Blade Ranged").
  const lead = /^(Disabled|Genuine) (.+)$/i.exec(name);
  if (lead) { name = lead[2]; tags.unshift(ITEM_TAGS[lead[1].toLowerCase()]); }
  const tail = /^(.*?) (Ranged|Melee|Disabled)$/i.exec(name);
  if (tail) { name = tail[1]; tags.push(ITEM_TAGS[tail[2].toLowerCase()]); }
  return { name, tags };
}

/** The Chinese for a DotA item name (including its Recipe / level / mode variants), or "". */
function itemZh(english) {
  const { name, tags } = itemParts(english);
  const base = ITEM_ZH[name];
  if (!base) return "";
  return base + tags.filter(Boolean).map((t) => `（${t}）`).join("");
}

/** The Chinese tooltip for a DotA item, or "" when we have not written one yet. */
function itemDescZh(english) {
  return ITEM_DESC_ZH[itemParts(english).name] ?? "";
}

/**
 * Script strings the map prints, English → Chinese, where no automatic source exists: the AI
 * version's HUD is Portuguese ("Killed", "Died To", gold/lumber, its cheat list), and DotA
 * concatenates most of its announcements from fragments, so each fragment is a key of its own.
 * Keys are the literal exactly as it appears in scripts\war3map.j.
 */
const TEXT_ZH = {
  // The AI multiboard (PT-BR in the 6.90G port).
  "Killed ": "击杀 ",
  "Died To ": "死于 ",
  "Renasce em ": "重生倒计时 ",
  " segundos": " 秒",
  " Ouro|r": " 金币|r",
  " ouro[F]": " 金币[F]",
  " ouro[H]": " 金币[H]",
  " ouro ": " 金币 ",
  " madeira[G]": " 木材[G]",
  " madeira[I]": " 木材[I]",
  "200% Vida": "200% 生命",
  " Mapa[A]": " 地图[A]",
  " Aliança[A]": " 联盟[A]",
  "subiu para ": "升至 ",
  "Selecionar ": "选择 ",
  " Controlar": " 控制",
  "Dar ": "给予 ",
  " Controle": " 控制",
  " cheat": " 作弊",
  " cheat:": " 作弊：",
  "Cheats DOTA": "DOTA 作弊命令",
  "versão host": "主机版本",
  " Retreating": " 撤退",
  "Ataque ": "攻击 ",
  "Def Tower": "防守防御塔",
  "Empurrando ": "推进 ",
  "Defendendo ": "防守 ",
  "Na base ": "在基地 ",
  "Emboscada ": "伏击 ",
  " Item Drop ": " 物品掉落 ",
  " Sem runas ": " 无神符 ",
  " Easy Mode ": " 简单模式 ",
  " Same Hero ": " 相同英雄 ",
  // Shared HUD vocabulary.
  "+1 Strength": "+1 力量",
  "+1 Agility": "+1 敏捷",
  " Strength": " 力量",
  " Agility": " 敏捷",
  "No Mode": "无模式",
  "Tip 1: ": "提示 1：",
  "Tip 2: ": "提示 2：",
  "Tip 3: ": "提示 3：",
  "Tip 4: ": "提示 4：",
  "Tip 5: ": "提示 5：",
  "About AI": "关于 AI",
  "Hero K/D/A": "英雄 K/D/A",
  "Creep Stats": "小兵统计",
  "Best Spree": "最高连杀",
  "AI Actions": "AI 行为",
  "Exp.|r - ": "经验|r - ",
  " Assists: ": " 助攻：",
  "Ogre Magi": "食人魔法师",
  "Dark Seer": "黑暗贤者",
  "Morphling": "变体精灵",
  // Mode names and the neutrals/ancient creeps DotA names itself.
  "All Pick": "全选模式",
  "All Random": "全部随机",
  "Single Draft": "单一征召",
  "Random Draft": "随机征召",
  "Least Played": "最少场次",
  "Team Random": "团队随机",
  "Death Match": "死亡竞赛",
  "Mirror Match": "镜像模式",
  "Reverse Mode": "反转模式",
  "Captains Mode": "队长模式",
  "Captains Draft": "队长征召",
  "Item Drop": "物品掉落",
  "Easy Mode": "简单模式",
  "Same Hero": "相同英雄",
  "Ancient Hydra": "远古九头蛇",
  "Scary Fish": "恐怖鱼",
  "Siege Golem": "攻城傀儡",
  "Alpha Wolf": "头狼",
  "Ancient of Wonders": "奇迹古树",
  "Ancient Protector": "远古守护者",
  "Arcane Sanctum": "秘法圣所",
  "Arc Warden": "天穹守望者",
  "Ancient Apparition": "远古冰魄",
  "Ancestral Spirit": "先祖之魂",
  "Ancient Weaponry": "远古兵器",
  // IceFrog's easter egg and the 6.83 mode list.
  "|r's never gonna give you up": "|r 永远不会放弃你",
  "|r's never gonna let you down": "|r 永远不会让你失望",
  "|r's never gonna run around": "|r 永远不会四处奔跑",
  "|r's never gonna desert you": "|r 永远不会抛弃你",
  "|r's never gonna make you cry": "|r 永远不会让你哭泣",
  "|r's never gonna say goodbye": "|r 永远不会说再见",
  "|r's never gonna tell a lie": "|r 永远不会说谎",
  "|r's never gonna hurt you": "|r 永远不会伤害你",
  "off, random, nightelf1, nightelf2, nightelf3, human1, human2, human3, orc1, orc2, orc3, undead1, undead2, undead3, other1, other2, other3, other4, other5, other6, other7, other8, other9, special":
    "关闭、随机、暗夜精灵1、暗夜精灵2、暗夜精灵3、人族1、人族2、人族3、兽族1、兽族2、兽族3、不死族1、不死族2、不死族3、其他1、其他2、其他3、其他4、其他5、其他6、其他7、其他8、其他9、特殊",
  "|cffff0000Left: ": "|cffff0000左：",
  "|cffff0000Right: ": "|cffff0000右：",
  "|cffff0000Down: ": "|cffff0000下：",
  // The AI version's own menus (PT-BR in this port) and the compact mode tokens.
  "Habilidades::": "技能::",
  "Automação[B]": "自动化[B]",
  "Ajuda[E]": "帮助[E]",
  "Invencível[A]": "无敌[A]",
  "Evasão[B]": "闪避[B]",
  "Bash[C]": "重击[C]",
  "Crítico[D]": "暴击[D]",
  "Refletir(Carapaça)[E]": "反射（尖刺外壳）[E]",
  "Controlar[H]": "控制[H]",
  "Recursos[A]": "资源[A]",
  "Alianças[B]": "联盟[B]",
  "(Jogador)": "（玩家）",
  "(Computador)": "（电脑）",
  "(mochilas)|CFFFF0000BAG|R=": "（背包）|CFFFF0000背包|R=",
  "(Meio)": "（中路）",
  "(Topo)": "（上路）",
  "(Baixo)": "（下路）",
  " Sem troca ": " 不可交换 ",
  "|c00555555End|r": "|c00555555结束|r",
  ">|c00ffcc00Roshan|r": ">|c00ffcc00肉山|r",
  "Store": "商店",
  "Purple": "紫色",
  "Yellow": "黄色",
  "Orange": "橙色",
  "Brown": "棕色",
  "Wisp/Io": "精灵守卫/艾欧",
  "Learn": "学习",
  "Default": "默认",
  "Music": "音乐",
  "Avatar": "头像",
  "Disenchant": "驱散",
  "Sleep": "睡眠",
  "Feedback": "反馈",
  "Warning": "警告",
  "Instant": "瞬发",
  "Target": "目标",
  "Leaguemode": "联赛模式",
  "Randomdraft": "随机征召",
  "Captainsdraft": "队长征召",
  "Mirrormatch": "镜像模式",
  "Deathmatch": "死亡竞赛",
  "Reverse": "反转模式",
  "Allpick": "全选模式",
  "Allrandom": "全部随机",
  "Teamrandom": "团队随机",
  "Moderandom": "模式随机",
  "Voterandom": "投票随机",
  "Singledraft": "单一征召",
  "Captainsmode": "队长模式",
};

const args = process.argv.slice(2);
const template = args.includes("--template");
const missingArg = args.find((a) => a.startsWith("--missing="));
const missingPath = missingArg ? missingArg.slice("--missing=".length) : null;
const mapPath = args.find((a) => !a.startsWith("--"));
if (!mapPath) {
  console.error("usage: node tools/map-zh-extract.cjs <map.w3x> [--template] [--missing=out.json]");
  process.exit(2);
}

const outPath = `${mapPath}.zhCN.json`;

/** Open the map the same way the engine does: an MPQ, files by hash even with no listfile. */
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
        /* try the next spelling */
      }
    }
    return null;
  };
  /** Every one of these tables the map ships (a map may carry several races' copies). */
  const readAll = (...names) => names.map((n) => read(n)).filter(Boolean);
  return {
    read,
    script: read("scripts\\war3map.j", "war3map.j", "Scripts\\war3map.j"),
    wts: read("war3map.wts", "scripts\\war3map.wts"),
    tables: {
      units: read("war3map.w3u"),
      items: read("war3map.w3t"),
      abilities: read("war3map.w3a"),
      upgrades: read("war3map.w3h", "war3map.w3q"),
    },
    // DotA ships its own copy of the string tables, which is where hero names actually come
    // from (the map has no war3map.w3u at all): `[H06S] Name="Admiral" Propernames="…"`.
    strings: {
      units: readAll(
        "Units\\CampaignUnitStrings.txt", "Units\\UnitStrings.txt",
        "Units\\HumanUnitStrings.txt", "Units\\OrcUnitStrings.txt",
        "Units\\UndeadUnitStrings.txt", "Units\\NightElfUnitStrings.txt",
        "Units\\NeutralUnitStrings.txt",
      ),
      items: readAll("Units\\ItemStrings.txt"),
      abilities: readAll(
        "Units\\CampaignAbilityStrings.txt", "Units\\AbilityStrings.txt",
        "Units\\HumanAbilityStrings.txt", "Units\\OrcAbilityStrings.txt",
        "Units\\UndeadAbilityStrings.txt", "Units\\NightElfAbilityStrings.txt",
        "Units\\NeutralAbilityStrings.txt", "Units\\CommonAbilityStrings.txt",
        "Units\\ItemAbilityStrings.txt",
      ),
      upgrades: readAll(
        "Units\\CampaignUpgradeStrings.txt", "Units\\UpgradeStrings.txt",
        "Units\\HumanUpgradeStrings.txt", "Units\\OrcUpgradeStrings.txt",
        "Units\\UndeadUpgradeStrings.txt", "Units\\NightElfUpgradeStrings.txt",
        "Units\\NeutralUpgradeStrings.txt",
      ),
    },
  };
}

/** An INI-shaped Warcraft III string table (`[rawcode]` + `Key=value` lines). */
function parseIni(buf, encoding) {
  // The map's own tables are ASCII in English maps but UTF-8 in translated ones (the PT-BR port
  // names its runes "Ilusão"), and a strict UTF-8 decode is the only way to tell.
  let text;
  if (encoding) text = buf.toString(encoding);
  else {
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(buf); }
    catch { text = buf.toString("latin1"); }
  }
  text = text.replace(/^\uFEFF/, "");
  const out = new Map();
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const head = /^\s*\[([^\]]+)\]\s*$/.exec(line);
    if (head) {
      current = { key: head[1].trim(), fields: {} };
      out.set(current.key, current.fields);
      continue;
    }
    const pair = /^\s*([^=]+?)\s*=(.*)$/.exec(line);
    if (pair && current) current.fields[pair[1].trim().toLowerCase()] = pair[2].trim();
  }
  return out;
}

/** One INI value without its surrounding quotes. */
function unquote(value) {
  return typeof value === "string" ? value.replace(/^"|"$/g, "").trim() : "";
}

/**
 * A per-level INI list (`Tip=a,b`, `Ubertip="a, b",c`). Split on commas OUTSIDE quotes, because
 * every Ubertip is a quoted sentence with commas of its own — a plain `split(",")` cuts them in
 * half and the engine's level alignment then shows the wrong body on every rank.
 */
function splitList(value) {
  const out = [];
  let current = "";
  let quoted = false;
  for (const ch of typeof value === "string" ? value : "") {
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === "," && !quoted) { out.push(current.trim()); current = ""; continue; }
    current += ch;
  }
  out.push(current.trim());
  return out;
}

/** A field still inside an unclosed `<…>` reference: its comma is part of the reference, not a separator. */
function endsInsideReference(text) {
  return text.lastIndexOf("<") > text.lastIndexOf(">");
}

/**
 * DotA's string tables write the comma inside a `<Token,Field>` reference as the list's own
 * separator (`" <AHav","DataC1> …`), so even a quote-aware split cuts the reference in half and
 * the tooltip reads `获得 DataC1> 点额外伤害`. Piece the reference back together: everything up to
 * the closing `>` belongs to the same entry, commas included.
 *
 * Rows where the reference's HEAD was eaten (the entry starts with `DataC1>`) cannot be recovered —
 * nothing in the file says which field it belonged to — so that entry is dropped rather than shown
 * as garbage. The sentence itself is the map's own text and reads the same in the base game.
 */
function ubertipList(value) {
  return sanitizeBodies(mergedBodies(value));
}

/** The repair above, before the separator clean-up moves anything: one entry per LEVEL SLOT. */
function mergedBodies(value) {
  const merged = [];
  let pending = null;
  for (const part of splitList(value)) {
    pending = pending === null ? part : `${pending},${part}`;
    if (!endsInsideReference(pending)) { merged.push(pending); pending = null; }
  }
  if (pending !== null) merged.push(pending);
  return merged
    .filter((part) => !/^[A-Za-z0-9]{1,8}>/.test(part))
    .map((part) => (/^[,，;、\s]*$/.test(part) || part === "text" ? "" : part));
}

/**
 * What is left after repair: entries that are only a separator (`","`, the same escaping bug's
 * leftovers) or the literal placeholder `text` say nothing, so they become blank. And DotA often
 * wrote a whole body into a slot PAST the ability's last level, where no rank can ever read it —
 * when that single surviving body is the only text in the list, it is moved to rank 1 instead of
 * staying invisible.
 */
function sanitizeBodies(parts) {
  const bodies = parts.map((part) => (/^[,，;、\s]*$/.test(part) || part === "text" ? "" : part));
  const first = bodies.findIndex((body) => body !== "");
  if (first < 0) return bodies;
  const filled = bodies.filter(Boolean).length;
  return filled === 1 && first > 0 ? [bodies[first]] : bodies;
}

/**
 * A body from a previous run is worth keeping only when it is WHOLE: Chinese, every reference
 * closed, and no unfilled `{N}` template — a fragment (the old `","`-split damage) is not.
 */
function reusableBody(text) {
  return typeof text === "string"
    && /[\u4e00-\u9fff]/.test(text)
    && (text.match(/</g) ?? []).length === (text.match(/>/g) ?? []).length
    && !/\{N\}/.test(text);
}

/**
 * The map's own slips inside a reference, repaired only on the way OUT (the dictionaries are keyed
 * on the text as written, so repairing before a lookup would miss every key):
 *
 *   `<AHad,DataA1,.>`  the period was swept into the reference → `<AHad,DataA1>.`
 *   `<<ANso,DataA2>`   a doubled opener → `<ANso,DataA2>`
 *   `<ANab,DataC2点`   the closer was dropped before Chinese text → `<ANab,DataC2>点`
 */
function repairRefs(text) {
  return text
    .replace(/,([.。])>/g, ">$1")
    .replace(/<<([A-Za-z0-9]{4},)/g, "<$1")
    .replace(/<([A-Za-z0-9]{4}),([A-Za-z0-9]+)(?=[^\x00-\x7F])/g, "<$1,$2>");
}

/**
 * The INSTALL's own string tables, which are Chinese — `ExtractedData/merged/Units/*Strings.txt`
 * beside the maps. Same rawcodes as the map's copy, so a building or a creep whose name DotA never
 * touched can be translated by looking the id up instead of guessing at the English.
 *
 * Found relative to the MAP, not to this repo: the install is whatever folder the map lives under,
 * and a map from somewhere else simply gets no fallback.
 */
function installStrings(mapPath) {
  const empty = { units: new Map(), items: new Map(), abilities: new Map(), upgrades: new Map() };
  let dir = dirname(mapPath);
  for (let i = 0; i < 5; i++) {
    if (existsSync(join(dir, "ExtractedData", "merged", "Units"))) {
      const units = join(dir, "ExtractedData", "merged", "Units");
      const index = { units: new Map(), items: new Map(), abilities: new Map(), upgrades: new Map() };
      for (const name of readdirSync(units).sort()) {
        if (!name.endsWith(".txt")) continue;
        const kind = name === "ItemStrings.txt" ? "items"
          : name.endsWith("UnitStrings.txt") ? "units"
          : name.endsWith("AbilityStrings.txt") ? "abilities"
          : name.endsWith("UpgradeStrings.txt") ? "upgrades"
          : null;
        if (!kind) continue;
        for (const [id, fields] of parseIni(readFileSync(join(units, name)), "utf8")) index[kind].set(id, fields);
      }
      return index;
    }
    dir = dirname(dir);
  }
  console.warn("[map-zh] no ExtractedData beside the map — names stay English where the map's own table is");
  return empty;
}

/**
 * The map's own object table (`war3map.w3u` and friends), reduced to the fields that carry TEXT:
 * a unit's name (`unam`), a hero's given names (`upro`), an ability's (`anam`), an item's
 * (`unam`), an upgrade's (`gnam`).
 *
 * Parsed with the viewer's own reader rather than by hand: `w3a`/`w3q` carry the optional
 * level/data-pointer pair per modification and `w3u`/`w3t` do not, and that difference is the one
 * thing a hand-rolled reader gets wrong (it desynchronises 8 bytes in and reads garbage types).
 */
function objectRows(buf, kind) {
  const levelIndexed = kind === "abilities" || kind === "upgrades";
  const file = levelIndexed ? new War3MapW3d() : new War3MapW3u();
  file.load(buf);
  const rows = [];
  for (const obj of [...file.customTable.objects, ...file.originalTable.objects]) {
    const fields = {};
    for (const mod of obj.modifications) if (typeof mod.value === "string") fields[mod.id] = mod.value;
    const id = obj.newId && obj.newId !== "\0\0\0\0" ? obj.newId : obj.oldId;
    rows.push({ id, fields });
  }
  return rows;
}

/** `STRING 50000\n{\n…\n}` — the same shape data/mapInfo.ts reads. */
function parseWts(buf) {
  const text = buf.toString("utf8").replace(/^\uFEFF/, "");
  const out = new Map();
  const re = /STRING\s+(\d+)\s*\r?\n\s*\{\s*\r?\n([\s\S]*?)\r?\n\}/g;
  let m;
  while ((m = re.exec(text))) out.set(m[1], m[2].trim());
  return out;
}

/** A string literal the player actually reads, or null for machine text. */
function prose(literal) {
  if (literal.length < 4 || literal.length > 400) return null;
  if (!/[A-Za-z]{3,}/.test(literal)) return null;
  // SOMETHING must survive once colour codes, format verbs, numbers and punctuation are
  // stripped: "|r |c00ffff00" is a colour reset, not a sentence.
  const content = literal
    .replace(/\|c[0-9a-fA-F]{2,8}/g, "")
    .replace(/\|r|\|n/gi, "")
    .replace(/%[-0-9.]*[sd]/g, "")
    .replace(/[\s0-9.,:;!%+\-/()'"=<>[\]{}]/g, "");
  if (content.length < 3) return null;
  if (/^[A-Za-z0-9_]{4}$/.test(literal)) return null; // a rawcode
  if (/^TRIGSTR_\d+$/.test(literal)) return null; // resolved through the wts, not shown as itself
  // A single-token IDENTIFIER: "TargetIndex", "MorphAgi", "Kobold0", "SWAP_". Prose has spaces.
  if (!/\s/.test(literal) && (/[a-z][A-Z]/.test(literal) || /^[A-Z_]{4,}$/.test(literal) || /^[A-Za-z]+[0-9]+$/.test(literal))) return null;
  if (/^(war3map|Scripts|Units|Abilities|UI|Sound|Fonts)[\\/]/i.test(literal)) return null; // a path
  if (/\.(mdx|mdl|blp|tga|wav|mp3|slk|txt|fdf|toc)$/i.test(literal)) return null; // an asset
  // Animation and sound-cue names ("stand victory", "Stand Work Gold", "spell slam") are
  // read by the engine's own animation code, never by a player.
  if (/^(stand|walk|attack|spell|birth|death|morph|dissipate|portrait|gold|lumber|weapon|hand|overhead|origin|chest)\b/i.test(literal)) return null;
  if (/EAX/i.test(literal)) return null; // sound-environment suffixes ("...EAXON")
  if (/^(right|left)[ ,]?hand$/i.test(literal)) return null; // attachment points
  // A command token or a command's usage line ("-ap", "-weather snow") is not prose.
  if (literal.trim().startsWith("-")) return null;
  // A script PLACEHOLDER ("$dead", "$hero", "$team") is substituted, never shown as itself.
  if (literal.trim().startsWith("$")) return null;
  // One bare lowercase word is an id, not a sentence ("chainlightning", "bloodlust").
  if (!/\s/.test(literal) && !/[!?:%]/.test(literal) && /^[a-z]+$/.test(literal)) return null;
  return literal;
}

/** String literals of a JASS script, unescaped just enough to be readable. */
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
  return [...counts].sort((a, b) => b[1] - a[1]);
}

const map = openMap(mapPath);
const wts = map.wts ? parseWts(map.wts) : new Map();
const literals = map.script ? scriptLiterals(map.script.toString("utf8")) : [];

let existing = null;
if (existsSync(outPath)) {
  try {
    existing = JSON.parse(readFileSync(outPath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    console.warn(`[map-zh] existing file is not JSON, rewriting: ${outPath}`);
  }
}
const priorWts = existing && typeof existing.wts === "object" ? existing.wts : {};
const priorText = existing && typeof existing.text === "object" ? existing.text : {};

/** `--missing`: every source line the dictionaries could NOT answer for, so a translator can
 *  work from the map's own words instead of guessing from a blank slot in the sidecar. Ability
 *  bodies are keyed by their number-free SKELETON, matching `dota-ability-body-zh.json`. */
const missing = { abilities: {}, items: {}, unitTips: {}, unitBodies: {}, text: [] };
const zhWts = {};
for (const [id, line] of wts) {
  zhWts[id] = template ? "" : typeof priorWts[id] === "string" ? priorWts[id] : "";
}
const zhText = {};
for (const [line] of literals) {
  const before = typeof priorText[line] === "string" ? priorText[line] : "";
  zhText[line] = template ? "" : before || TEXT_ZH[line] || "";
  if (!zhText[line].trim()) missing.text.push(line);
}

// The map's object table (names only) plus the map's OWN copy of the game's string tables — DotA
// has no war3map.w3u/w3t at all, so `Units\*Strings.txt` inside the .w3x is the only place a hero,
// an item or an ability is named. Every rawcode gets an entry when we can make it Chinese, and a
// blank field is ignored by the engine, so a half-done file never blanks anything on screen.
const KINDS = { units: "unam", items: "unam", abilities: "anam", upgrades: "gnam" };
const zhObjects = { units: {}, items: {}, abilities: {}, upgrades: {} };
const priorObjects = (existing && typeof existing.objects === "object" && existing.objects) || {};
const inventory = [];
const inventorySeen = new Set();

/**
 * The INSTALL's Chinese string tables, keyed by rawcode. A creep, a building or a stock item keeps
 * the base game's id inside a custom map, so its name can be filled from official Chinese data
 * instead of being translated by hand. DotA's own heroes/items use made-up ids and miss here, which
 * is exactly right: those are the ones the dictionaries (`HERO_ZH`, below) exist for.
 */
const install = installStrings(mapPath);

/** Fill a level-aligned list field; entries already translated in the file win over ours. */
function mergeList(entry, field, values) {
  if (!values.some((v) => v)) return;
  const prior = Array.isArray(entry[field]) ? entry[field] : [];
  const out = values.map((v, i) => (typeof prior[i] === "string" && prior[i].trim() ? prior[i] : v));
  if (out.some((v) => v)) entry[field] = out;
}

/** Team names inside DotA's colour-coded announcements. */
const teamsZh = (text) => text.replace(/Scourge/g, "天灾").replace(/Sentinel/g, "近卫");

const DIR_ZH = { east: "东路", middle: "中路", west: "西路" };

/**
 * Announcements that are BUILT, not looked up: one English template, several colour-coded hero or
 * team names in it. A dictionary key cannot match them because the embedded names vary.
 */
const MESSAGE_RULES = [
  [/^(.*?) has spawned for the (.*?) and is taking the (east|middle|west) path$/i,
    (m) => `${teamsZh(m[1])} 已为 ${teamsZh(m[2])} 出现，正在前往${DIR_ZH[m[3].toLowerCase()]}`],
  [/^'s courier has been killed by$/, () => " 的信使被击杀，凶手："],
  [/^\$dead has been killed by his teammate \$killer!$/, () => "$dead 被队友 $killer 击杀！"],
  [/^\$dead's courier has been killed!$/, () => "$dead 的信使已被击杀！"],
  [/^\$hero has revived \(buy back\)$/, () => "$hero 已复活（买活）"],
  [/^\$p1 \$c1has rejected the switch offer\.$/, () => "$p1 $c1拒绝了换人请求。"],
  [/^An enemy player has repicked$/, () => "一名敌方玩家重新选择了英雄"],
  [/^(\d+) minute$/, (m) => `${m[1]} 分钟`],
  [/^(\d+) minutes$/, (m) => `${m[1]} 分钟`],
  [/^(\d+) seconds remaining for your stolen spell$/, (m) => `窃取技能剩余 ${m[1]} 秒`],
  [/^after (\d+) seconds have elapsed\.$/, (m) => `${m[1]} 秒后。`],
  [/^(\d+)x Casts:$/, (m) => `${m[1]} 次施法：`],
  [/^(\d+)x MULTICAST!+$/, (m) => `${m[1]} 次多重施法！`],
  [/^A captain from each side will ban and pick heroes\.$/, () => "双方各有一名队长禁用并挑选英雄。"],
  [/^A different system for spawning runes$/, () => "不同的神符刷新机制"],
  [/^A Scourge Player$/, () => "一名天灾玩家"],
  [/^A Sentinel Player$/, () => "一名近卫玩家"],
  [/^All players will be given the same hero that$/, () => "所有玩家将获得相同的英雄，该英雄"],
  [/^All players will be shuffled across both sides\.$/, () => "所有玩家将在双方之间随机打乱。"],
  [/^Allowing help from certain abilities\.$/, () => "允许特定技能提供帮助。"],
  [/^Allows allies to pool each other items$/, () => "允许盟友互相给予物品"],
  [/^Any text displayed on the screen will be cleared\.$/, () => "屏幕上的所有文字都会被清除。"],
  [/^Ban Phase #(\d+)$/, (m) => `禁用阶段 #${m[1]}`],
  [/^Pick Phase #(\d+)$/, (m) => `挑选阶段 #${m[1]}`],
  [/^Arrow Accuracy:$/, () => "箭矢精确度："],
  [/^All Agility$/, () => "全部敏捷英雄"],
  [/^All Intelligence$/, () => "全部智力英雄"],
  [/^All Strength$/, () => "全部力量英雄"],
  [/^(Agility|Intelligence|Strength) \((Scourge|Sentinel) - (\d)\)$/i,
    (m) => `${({ agility: "敏捷", intelligence: "智力", strength: "力量" })[m[1].toLowerCase()]}（${teamsZh(m[2])} - ${m[3]}）`],
];

function messageZh(text) {
  const t = text.trim();
  for (const [re, make] of MESSAGE_RULES) {
    const m = re.exec(t);
    if (m) return make(m);
  }
  return "";
}

/**
 * One object: its English name (from the map), its level lists when it has any, and the Chinese
 * the install table can answer for it. `proper` marks a HERO row — the only rows whose English
 * name is DotA's own invention.
 */
/**
 * A NAME THE MAP'S SCRIPT TESTS STAYS AS THE AUTHOR WROTE IT.
 *
 * A map can only reach its own text through `GetObjectName`/`GetUnitName`, and DotA uses those as
 * flags, not as prose:
 *
 *   if GetObjectName(1848657992) == "Language: English" then …   -- the -tips system (n0HH)
 *   if GetObjectName(1848658741) != "Only Translate This String…"  -- "is this a translated build"
 *   if GetUnitName(it) != "Bloodrune" then …                      -- 6.90G's unit-entering hook
 *
 * Renaming one of those objects answers the map's own question for it. Nothing errors: the branch
 * is simply never taken again, and a feature disappears — the -tips pages, or the guard that keeps
 * the AI from treating Meepo's tombstone row as a freshly picked hero. Every tip sentence below
 * was translated and could never be reached, which is how this was found.
 *
 * `tools/map-i18n-lint.cjs` lists every name comparison in a map, so the rest can be checked
 * mechanically; the strings here are the ones we already know the script tests.
 */
const SCRIPT_SENTINEL = /^(Language: English|Only Translate This String If Simplified Chinese|Bloodrune)$/;

function addEntry(kind, id, english, proper, fields) {
  const entry = zhObjects[kind][id] ?? (zhObjects[kind][id] = {});
  const base = install[kind].get(id);
  const authoredOnly = SCRIPT_SENTINEL.test(english);
  let known = "";
  if (kind === "units" && proper && proper.length) known = HERO_ZH[english] ?? "";
  // DotA REUSES base-game ability rawcodes for its own skills (AHbz is "Blizzard" in the install
  // and Pugna's "Nether Blast" here), so the map's own English name must be looked up in the DotA
  // dictionary BEFORE the install's Chinese row — otherwise the skill wears the wrong name.
  if (!known && kind === "abilities") known = ABILITY_ZH[english]?.name ?? "";
  if (!known && base) known = unquote(base.name);
  if (!known && kind === "items") known = itemZh(english);
  // DotA stores its announcements in the names of dummy units, so the same sentence is often
  // already translated once as a script literal (`zhText`) — reuse it instead of translating twice.
  if (!known) known = TEXT_ZH[english] ?? "";
  if (!known) known = zhText[english] ?? "";
  if (!known) known = itemZh(english) || UNIT_ZH[english] || UNIT_EXTRA_ZH[english] || HERO_ZH[english] || messageZh(english);
  // AI interface lines pack their colour codes INSIDE the sentence, so they are matched with
  // the codes stripped (REPORT_ZH) rather than against the raw literal.
  if (!known) known = REPORT_ZH[plainText(english)] ?? "";
  // An ability's Chinese name is dictionary-derived, so it is rewritten every run: an earlier
  // run that could only see the install row (Blizzard) must not pin the wrong name forever.
  // A script sentinel is the exception in both directions — the map compares that exact string.
  if (known && !authoredOnly && (kind === "abilities" || entry.name === undefined || entry.name === "")) entry.name = known;

  if (kind === "units" && proper && proper.length) {
    const properZh = base ? splitList(base.propernames) : [];
    mergeList(entry, "properNames", properZh.length ? properZh : proper.map(() => ""));
  }
  if (kind === "units") {
    // The map's own hover text. `Tip` is the title line, `Ubertip` the body; both are authored by
    // DotA (English, or Portuguese in this port) and the install row cannot answer for them.
    const tip = unquote(fields?.tip);
    const tipZh = tip ? UNIT_TEXT_ZH.tips[tip] : "";
    if (tipZh && !entry.tip) entry.tip = tipZh;
    const ubertip = unquote(fields?.ubertip);
    const ubertipZh = ubertip ? UNIT_TEXT_ZH.bodies[ubertip] : "";
    if (ubertipZh && !entry.description) entry.description = ubertipZh;
    if (tip && !/[\u4e00-\u9fff]/.test(entry.tip ?? "")) missing.unitTips[tip] = tip;
    if (ubertip && !/[\u4e00-\u9fff]/.test(entry.description ?? "")) missing.unitBodies[ubertip] = ubertip;
  }
  if (kind === "items") {
    // The map's own ItemStrings is the text the shop shows TODAY (DotA rewrote most stock items),
    // so its translation comes first; the Chinese install row and the hand-written name table are
    // the fallbacks for sections it has no body for.
    const mapBody = unquote(fields?.ubertip);
    const bodyZh = mapBody ? ITEM_TEXT_ZH[mapBody] : "";
    if (!entry.description) {
      if (bodyZh) entry.description = bodyZh;
      else if (base) entry.description = unquote(base.ubertip);
      else {
        const descZh = itemDescZh(english);
        if (descZh) entry.description = descZh;
      }
    }
    if (mapBody && !/[\u4e00-\u9fff]/.test(entry.description ?? "")) missing.items[mapBody] = mapBody;
    if (base) {
      if (!entry.summary) entry.summary = unquote(base.description);
      if (!entry.tip) entry.tip = unquote(base.tip);
    }
  }
  if (kind === "abilities") {
    // The map's own `Ubertip` fixes both an ability's RANK COUNT and each rank's body. DotA reuses
    // base-game rawcodes with a different number of ranks (AHbz = Pugna's "Nether Blast", four
    // ranks, vs "Blizzard" at three), so a list borrowed from the install row can be another skill
    // entirely. `bodies.length` is what every array below is aligned to.
    const merged = mergedBodies(fields?.ubertip ?? "");
    const bodies = sanitizeBodies(merged);
    const ranks = bodies.some((b) => b.trim() !== "") ? bodies.length : 0;
    const zh = ABILITY_ZH[english];
    // A hand-written body is either one sentence for every rank or a comma list of per-rank bodies.
    // A single sentence must NOT go through `splitList`: DotA's sentences carry commas inside their
    // `<Token,Field>` references (`<AOwk,DataB1,%>`), which a comma split would cut into pieces.
    const dictBodies = zh
      ? (Array.isArray(zh.ubertips) && zh.ubertips.length ? zh.ubertips
        : zh.ubertip ? ubertipList(zh.ubertip) : [])
      : [];
    const dictAligned = dictBodies.length === ranks ? dictBodies : [];
    // When the only body sat PAST the last level, `sanitizeBodies` moved it to rank 1; a
    // translation the previous run wrote in that old slot belongs with it.
    const priorBodies = Array.isArray(entry.uberTips) ? entry.uberTips : [];
    const movedFrom = ranks === 1 && merged.length > 1 ? merged.indexOf(bodies[0]) : -1;
    // A previous run that already collapsed this skill to ONE body may have stored it at rank 1
    // (that is what the move above does), so its single entry answers for the single entry here.
    const priorAt = (i) => (priorBodies.length === 1 && ranks === 1 ? priorBodies[0]
      : priorBodies[movedFrom >= 0 ? (i === 0 ? movedFrom : -1) : i]);
    const fresh = [];
    for (let i = 0; i < ranks; i++) {
      const body = bodies[i] ?? "";
      const bySkeleton = body ? ABILITY_BODY_ZH[bodySkeleton(body)] : undefined;
      // Repair first: a translation the map's own `DataC2点` slip unbalanced is still whole once
      // that closer is put back, and it is the only copy of that rank's Chinese.
      const priorText = priorAt(i);
      const prior = typeof priorText === "string" ? repairRefs(priorText) : "";
      const kept = body && reusableBody(prior) ? prior : "";
      const picked = bySkeleton ? fillBodyNumbers(bySkeleton, body) : (dictAligned[i] ?? kept);
      if (!picked && body) missing.abilities[bodySkeleton(body)] = body;
      fresh.push(picked);
    }
    if (ranks && fresh.some(Boolean)) {
      // OVERWRITE, never merge with the previous file: an array of the wrong length (or one whose
      // rank 1 sits behind an empty slot) is exactly what an earlier run left behind, and a merge
      // would keep it forever.
      entry.uberTips = fresh;
    } else if (base && (!ranks || ubertipList(base.ubertip).length === ranks)) {
      // Nothing rank-faithful to translate: a stock ability, whose install row IS the same skill.
      // Only trusted when the rank counts agree, so a reused rawcode is never given its old body.
      // Overwrite (not merge): the install row is Chinese and already correct, while a copy an
      // earlier run wrote may still hold the `","`-split reference fragments this repair removes.
      const baseBodies = ubertipList(base.ubertip);
      if (baseBodies.some(Boolean)) entry.uberTips = baseBodies;
    } else if (dictBodies.some(Boolean)) {
      // One sentence covers every rank (its `<Token,Field>` references resolve per level), so it is
      // repeated; a per-rank list is taken as written.
      entry.uberTips = ranks
        ? (ranks > dictBodies.length ? Array.from({ length: ranks }, () => dictBodies[0]) : dictBodies.slice(0, ranks))
        : dictBodies;
    } else if (fields?.ubertip !== undefined) {
      // The row exists but says nothing once the separators and the `text` placeholder are gone, so
      // whatever an earlier run wrote there is stale junk: blank it instead of carrying it forward.
      entry.uberTips = [""];
    }
    if (zh) {
      // Rank titles we can build ourselves, wide enough for whichever rank the hero has learnt.
      const width = Math.max(10, ranks || 1);
      entry.tips = Array.from({ length: width }, (_, i) => `${entry.name || zh.name} - [|cffffcc00等级 ${i + 1}|r]`);
    } else if (base) {
      mergeList(entry, "tips", splitList(base.tip));
    }
  }
  if (kind === "upgrades" && base) {
    mergeList(entry, "names", splitList(base.name));
    mergeList(entry, "tips", splitList(base.tip));
    mergeList(entry, "uberTips", splitList(base.ubertip));
  }
  // A rawcode may be named in several tables in the same map; the inventory is one row per object.
  const seen = `${kind}\t${id}`;
  if (!inventorySeen.has(seen)) {
    inventorySeen.add(seen);
    inventory.push([kind, id, english]);
  }
}

// 1. The map's object tables — the fields it renames itself.
for (const [kind, field] of Object.entries(KINDS)) {
  zhObjects[kind] = { ...((priorObjects[kind] && typeof priorObjects[kind] === "object") ? priorObjects[kind] : {}) };
  const rows = map.tables[kind] ? objectRows(map.tables[kind], kind) : [];
  for (const row of rows) {
    const name = row.fields[field];
    if (!name || typeof name !== "string" || name.trim() === "") continue;
    const proper = kind === "units" && row.fields.upro
      ? row.fields.upro.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;
    addEntry(kind, row.id, name, proper, row.fields);
  }
}

// 2. The map's embedded string tables — every unit, item, ability and upgrade it names, whether
//    DotA renamed it or not. This is what makes the shop, the creep names and the ability tooltips
//    Chinese wherever the base game already has a Chinese name for the same rawcode.
for (const kind of ["units", "items", "abilities", "upgrades"]) {
  for (const table of map.strings[kind] ?? []) {
    for (const [id, fields] of parseIni(table)) {
      const name = unquote(fields.name);
      if (!name) continue;
      const proper = kind === "units" ? splitList(fields.propernames).filter(Boolean) : undefined;
      addEntry(kind, id, name, proper, fields);
    }
  }
}

// 3. Drop entries that ended up empty: a rawcode we know by name but have no Chinese for is noise
//    in the file (the engine skips blanks anyway), and the inventory below reports it instead.
for (const kind of Object.keys(zhObjects)) {
  for (const [id, entry] of Object.entries(zhObjects[kind])) {
    if (!Object.keys(entry).length) delete zhObjects[kind][id];
  }
}

// 4. The references the map itself wrote wrong are repaired here, on the finished text — after
//    every dictionary lookup, so a slip in the English key never costs a translation.
for (const entry of Object.values(zhObjects.abilities)) {
  if (Array.isArray(entry.uberTips)) entry.uberTips = entry.uberTips.map(repairRefs);
}

const doc = {
  format: 1,
  locale: "zhCN",
  map: mapPath.replace(/\\/g, "/").replace(/^.*\//, ""),
  wts: zhWts,
  text: zhText,
  objects: zhObjects,
};
writeFileSync(outPath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
if (missingPath) {
  writeFileSync(missingPath, `${JSON.stringify(missing, null, 2)}\n`, "utf8");
  console.log(`[map-zh] missing -> ${missingPath}: ${Object.keys(missing.abilities).length} ability skeleton(s), `
    + `${Object.keys(missing.items).length} item body/bodies, ${Object.keys(missing.unitTips).length} unit tip(s), `
    + `${Object.keys(missing.unitBodies).length} unit body/bodies, ${missing.text.length} script line(s)`);
}

const translated = (o) => Object.values(o).filter((v) => typeof v === "string" && v.trim() !== "").length;
/** An upgrade's name is a per-level list; everything else has one `name`. */
const zhName = (kind, entry) => (kind === "upgrades" ? (entry.names ?? []).find((v) => v) ?? "" : entry.name ?? "");
console.log(`[map-zh] ${outPath}`);
console.log(`[map-zh] wts ${Object.keys(zhWts).length} translated ${translated(zhWts)}`);
console.log(`[map-zh] text ${Object.keys(zhText).length} translated ${translated(zhText)}`);
for (const [kind] of Object.entries(KINDS)) {
  const rows = Object.values(zhObjects[kind]);
  const named = rows.filter((e) => zhName(kind, e).trim() !== "").length;
  const missing = inventory.filter(([k, id]) => k === kind && zhName(kind, zhObjects[kind][id] ?? {}).trim() === "");
  const names = new Set(missing.map(([, , english]) => english));
  console.log(`[map-zh] ${kind} ${named} Chinese / ${inventory.filter(([k]) => k === kind).length} objects, ${names.size} English name(s) left`);
}
if (args.includes("--names")) {
  for (const [kind, code, name] of inventory) {
    const entry = zhObjects[kind][code] ?? {};
    console.log(`${kind}\t${code}\t${name}\t${zhName(kind, entry) || "-"}`);
  }
}
