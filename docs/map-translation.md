# 给一张中文地图做翻译：`<地图>.zhCN.json` 规则与流程

这份文档是给「下一张地图」用的。它说明了：中文从哪来、放在哪、引擎按什么规则取词、哪些字**绝对不能翻**、
术语怎么统一，以及改完怎么验。实战样本是 `Maps/hhkj` 下的三张图：DotA v6.83d、DotA AI v6.90G（葡语原版）、
Spellcraft Open Remastered 8.0.5。

不重新打包 `.w3x`。**翻译文件是唯一交付物。**

---

## 1. 文件放在哪、叫什么

```
Warcraft III zhCN/Maps/<目录>/<地图文件名>.w3x.zhCN.json
```

也就是**完整文件名 + `.zhCN.json`**，和 `.w3x` 同一目录：

```
DotA v6.83d.w3x                    ← 地图，只读
DotA v6.83d.w3x.zhCN.json          ← 中文，引擎读这个
Spellcraft_Open_Remastered_8.0.5.w3x
Spellcraft_Open_Remastered_8.0.5.w3x.zhCN.json
```

两套安装（`Warcraft III zhCN/` 与 `Warcraft III enUS/`）各放一份，内容保持一致 —— 玩家用哪个安装都能读到。
文件**存在即生效**（`src/i18n/mapLanguage.ts` 的 `live()` 只问「有没有这个文件」），不看界面语言：
中文安装 + 英文界面，地图照样是中文。

---

## 2. 一个文件，六张表

```json
{
 "format": 1,
 "locale": "zhCN",
 "map": "Spellcraft_Open_Remastered_8.0.5.w3x",
 "info":  { "name": "…", "description": "…", "recommendedPlayers": "…" },
 "wts":   { "1": "咒术工艺 重制版 8.0.5", "3": "把元素（物品）组合起来学习…" },
 "text":  { "Time left: ": "剩余时间：" },
 "skin":  { "KEY_QUESTS": "地图信息(|Cfffed312F9|R)" },
 "errors":{ "Nolumber": "该物品不需要卷轴。" },
 "objects": { "units": { "h01F": { "name": "亡灵术", "description": "…" } } }
}
```

顺序无所谓，`format` 必填（其他字段缺失即视为空表）。六张表按「值从哪来」分工，选错表会让译文**永远不生效**：

| 表 | 键 | 值的来源 | 什么时候用 |
|---|---|---|---|
| `wts` | `war3map.wts` 里的 STRING 编号（`"1234"`） | 地图自己的字符串表 | **首选。** 地图的对象数据写成 `TRIGSTR_1234` 时，翻这一条，所有指向它的 Name/Tip/Ubertip 同时变中文 |
| `text` | 原文整行 | 脚本 `DisplayTextToPlayer/Force` 打印的字面量、wts 原文 | 脚本用英文句子直接上屏时；`wts` 里查不到、只能按原文匹配的场合 |
| `skin` | `war3mapSkin.txt [FrameDef]` 的键名 | 皮肤文件里作者写的**字面量** | 左上角按钮条（`KEY_QUESTS`）、资源栏这些。值是 `TRIGSTR_n` 的不用管，走 `wts` |
| `errors` | `war3mapSkin.txt [Errors]` 的键名 | 同上 | 地图**改写**了引擎报错含义时（DotA 的 `Nolumber` 不是「木材不够」） |
| `info` | `name` / `description` / `recommendedPlayers` | `war3map.w3i` | 选地图列表与载入界面。`TRIGSTR_n` 的字段走 `wts`；字面量（长段简介）走这里 |
| `objects` | rawcode（`"A00Y"`） | 地图对象表 | 只有「同一条字符串被多个对象共享、但想分开翻」或「值不是 `TRIGSTR` 而是字面量」时才用 |

**先看对象数据是不是 `TRIGSTR_`。** 是 → 只写 `wts`，不要写 `objects`（写了两边打架，`objects` 覆盖在后）。
不是（作者把英文直接写进 w3u/w3a）→ `wts` 里没有编号可翻，只能走 `objects`。

---

## 3. 匹配规则（决定一条译文到底会不会被用上）

### `wts` — 按编号，其次按原文行

1. `TRIGSTR_1234` 的字段 → 取 `wts["1234"]`。**编号是整数，`TRIGSTR_001` 就是 `"1"`**，前导零要去掉。
2. 编号查不到 → 用该 STRING 的**原文整行**去 `text` 表查。
3. 都没有 → 作者原文。

### `text` — 整行优先，然后最长键子串替换

- 原文与键都做 `trim()` + CRLF→LF 归一。
- **整行命中**直接用。
- 否则按**键最长优先**在句子里做子串替换 —— 这一条是为了 DotA 那种「一句话由几段拼出来」的写法
  （`"|c00ff0303" + 名字 + "|r is on a killing spree!"`），所以片段也要收进表。
- 键短于 4 字符、或键里没有字母 → **永远不做子串规则**（否则 `A`、`1` 会把满屏文字拆坏）。
- **空值 = 未翻译**，不是「翻成空」。所以留空的条目永远安全。
- 键会 `trim()`，所以**片段译文不要带首尾空格**，否则屏幕出现双空格（`还需  300`）。

### `skin` / `errors` — 按 key 精确查，永不进子串

皮肤里的值是作者在 `war3mapSkin.txt` 手写的字面量，`wts` 里没有、暴雪中文数据也覆盖不到，
所以只能按 FrameDef 键名精确对上；否则一个 `Gold` 会把满屏所有 `Gold` 替换掉。

### `info` — 按字段

`name`/`description`/`recommendedPlayers` 三个字段各查一次。简介是一整段（几百字符、带颜色码和换行），
当成 `text` 键去匹配几乎必失败，所以按字段给。

### `objects` — 覆盖对象表，最后生效

`name`、`tip`、`description`（物品长描述）、`summary`、`properNames[]`、`tips[]`、`uberTips[]`、`names[]`。
数组与等级**索引对齐**，空串保留原文。

---

## 4. 引擎在什么时候读它

```
打开地图 → 读 war3map.wts → localizeMapWtsTable() 按 wts 表改写这张表（原地）
        → 对象表解析时 TRIGSTR_ 已经在查这张表，Name/Tip/Ubertip 直接是中文
        → 脚本上屏走 mapDisplayText()（text 表）
        → HUD 帧文案走 mapFrameString()（skin 表）
        → 引擎报错走 CommandStrings.get()（errors 表优先）
```

推论：**`wts` 表能翻到的东西，`objects` 表都能翻到，反之不一定。** 一张对象数据全是 `TRIGSTR` 的地图，
写好 `wts` 就等于翻完了全部技能、物品、单位 —— 这是 Spellcraft 的情况（5670 条 `wts`，0 条 `objects`）。

---

## 5. 铁律（违反会静默坏功能，不报错）

### 5.1 脚本拿来比较的字符串，一个字都不能改

地图只能通过 `GetObjectName(id)` / `GetUnitName(u)` 读到自己的文字，于是作者把它当**标志位**用：

```jass
if GetUnitName(GetTriggerUnit()) == "Light Combat" then   // Spellcraft：按单位名分派职业技能
if GetObjectName(1848657992) == "Language: English" then  // DotA：-tips 系统总开关
if GetUnitName(it) != "Bloodrune" then                    // DotA 6.90G：单位入场钩子
```

把这些名字翻成中文，等于替地图回答了它自己的问题：分支永远不再进入，**功能整块消失，而且没有任何报错**。
DotA 的 `-tips` 攻略（444 条译文早就写好）就是这样整块失效了几个月。

做法：
- `node tools/map-i18n-lint.cjs "<地图>.w3x"` 列出脚本里每一处名字比较，翻完必须全 `ok`。
- 命中的名字（如 Spellcraft 的 34 个职业名）**保持英文**，译文放到别处（技能描述里可以写中文名）。
- 需要「翻译但不改判断」时，把中文写进 `objects.<kind>.<id>.name` **不是**办法 —— 判断读的就是这个字段。
  只能保留英文名，或改脚本（我们不改别人的图）。

### 5.2 `Hotkey` 字段不翻

`Hotkey=S`、`EditorSuffix` 里的 `(craft)` 之类是**键位与编辑器标记**，不是文案。翻了就丢快捷键。

### 5.3 控制符原样保留

| 记号 | 含义 | 处理 |
|---|---|---|
| `\|cAARRGGBB` … `\|r` | 颜色起止 | 原样保留，位置可微调（让颜色包住中文而不是被拆开） |
| `\|n` | 换行 | 原样保留，数量不要变 |
| `%d` `%s` `%.1f` | 格式化占位 | 原样保留，顺序不要变 |
| `<AOcr,DataA1>` | 引擎取字段值 | **整段原样**，里面一个字都不能动（含逗号） |
| `|cffffcc00W|r` 夹在名字里 | 高亮的热键字母 | 见 6.2 |

### 5.4 空白 = 未翻译

每条留空都安全（引擎保留原文），但**不要**为了「占位」写空格或 `TODO` —— 空格会被当成译文推上屏幕。

### 5.5 数组与等级对齐

`uberTips` / `tips` / `names` 的长度必须等于该对象的等级数。少一条 → 高等级显示别的等级的说明。

---

## 6. 文体与排版

### 6.1 术语（魔兽三中文习惯，全图统一）

| 英文 | 中文 | 备注 |
|---|---|---|
| Strength / Agility / Intelligence | 力量 / 敏捷 / 智力 | 不要用「强壮/灵敏/智力值」 |
| Armor | 护甲 | 「装甲」不用 |
| Attack damage | 攻击力 | 不是「伤害」 |
| Hit points / Mana | 生命值 / 魔法值 | 界面里 生命/魔法 即可 |
| Movement speed | 移动速度 | |
| Attack speed | 攻击速度 | |
| Cooldown | 冷却时间 | |
| Range | 范围 / 射程 | 距离用「范围」，攻击距离用「射程」 |
| AoE / area | 范围伤害 / 区域 | |
| Aura | 光环 | |
| Buff / debuff | 增益 / 减益 | |
| Mastery | 精通 | Spellcraft 的进阶系统 |
| Craft | 制作 | 「合成」留给 recipe |
| Recipe | 配方 | |
| Profession / Class | 专业 / 职业 | Spellcraft 两个系统要分清 |
| Upgrade | 升级 | |
| Boss | Boss | 不译 |
| Hero | 英雄 | |
| Summon | 召唤 | |
| Stun / Slow / Root / Silence | 眩晕 / 减速 / 缠绕 / 沉默 | |
| Invulnerable | 无敌 | |
| Dispel | 驱散 | |
| Element | 元素 | |

Spellcraft 专有（这张图独有，别的图别照抄）：

| 英文 | 中文 |
|---|---|
| Fire / Water / Earth / Light / Dark / Storm / Energy | 火 / 水 / 大地 / 光 / 暗 / 风暴 / 能量 |
| Alchemy / Blacksmithing / Necromancy / Enchanting | 炼金 / 锻造 / 亡灵术 / 附魔 |
| Blight | 枯萎（亡灵腐地） |
| Battlegrounds / Moba / Survival / Arenas | 战场 / MOBA / 生存 / 竞技场 |

### 6.2 名字里的高亮热键字母

作者把热键字母染色嵌在英文名里：`|cffffcc00W|rar Stomp`。中文没法和它对位，统一规则：

- **`Name` 字段**：去掉内嵌的染色字母，只留中文名（`战争践踏`）。商店、配方、学习列表要的是干净的名字。
- **`Tip` 字段**（悬停标题）：`中文名（W） (要素字母) [等级 2]` —— 热键放这里，因为玩家就是在悬停时找键位。
- `(EEE)`、`(SDX)` 这类**要素缩写保持拉丁字母**，它们是这张图的记号（`E` 大地、`F` 火、`W` 水、`L` 光、`D` 暗、`S` 风暴、`Y` 能量），翻成汉字会挤爆标题。
- `[|cffffcc00Level 1|r]` → `[|cffffcc00等级 1|r]`。

### 6.3 标点

- 正文用全角：`，。：；！？（）「」`。
- 括号里若是纯英文/数字/字母代号，用半角：`(F9)`、`(W)`、`(SDX)`。
- 句末句号：工具提示里一句一个 `。`；纯词组（`+9 力量`）不加。
- 数字与单位之间留一个半角空格：`300 点伤害`、`持续 4 秒`、`450 范围`。
- 不要中英混排时省略空格：`提升 16% 移动速度`，不是 `提升16%移动速度`。

### 6.4 语气

- 技能描述：陈述句 + 数值，`对范围内的敌人造成 250 点伤害，持续 4 秒。`
- 主动技能写「使用：」/「激活：」，被动写「被动：」，光环写「光环：」——与 DotA 侧车一致。
- 不要加「你」，不要加语气词。原文有玩笑话就照译（Spellcraft 里很多），别删。

---

## 7. 工作流

```bash
# 1. 起骨架：把这张图所有可翻的条目找出来，已有的译文保留
node tools/map-zh-init.cjs "Warcraft III zhCN/Maps/hhkj/新地图.w3x"
#    → wts / text / skin / errors / info 五张表，值留空；控制台按字段列出「已翻/总数」
#    只想看看还缺什么：加 --report（不写文件）；想把空条目删掉：加 --prune

# 2. 翻译。顺序建议：info → Name → Tip → Description → Ubertip → text → 长尾
#    - 先 Name（技能/物品/职业名），因为 Tip 由它拼出来
#    - 同一条英文在多处复用时只翻一次，键相同就共享（wts 表按编号，所以重复文本要各写一遍也行）

# 3. 检查
node tools/map-i18n-lint.cjs "Warcraft III zhCN/Maps/hhkj/新地图.w3x"
#    脚本名字比较是否被翻翻 → 必须全 ok；[FrameDef]/[Errors]/w3i 字段是否被答上 → 不能有 EN 残留

# 4. 实机
npm run app:dev      # 进游戏看：技能悬停、商店、载入界面、左上角按钮条、报错行
```

`tools/map-zh-extract.cjs` 是 DotA 专用的旧工具（把英译字典烘在脚本里），**新图请用 `map-zh-init.cjs`**。

---

## 8. 交付前检查清单

- [ ] `wts` 里**每一个** `TRIGSTR_` 编号都被答上了（`map-zh-init --report` 应显示 N/N）
- [ ] `text` 里脚本上屏的句子没有残留英文（命令 token、颜色码、资源路径除外）
- [ ] `map-i18n-lint` 全 `ok`，`FLIP` 为 0
- [ ] `[FrameDef]` / `[Errors]` 没有 `EN` 残留（`TRIGSTR_` 值的由 `wts` 答）
- [ ] 同一英文词在全图译法一致（用术语表，别一处「护甲」一处「装甲」）
- [ ] `|c`/`|r`/`|n` 成对、`<Token,Field>` 完整、`%d` 数量一致
- [ ] 数组长度 = 等级数（技能说明、升级名）
- [ ] 两套安装目录下的侧车 `cmp` 一致
- [ ] 实机：悬停技能/物品、开商店、看载入界面与选图列表、触发一次报错

---

## 9. 踩过的坑（都是真事）

| 症状 | 真正的原因 | 处理 |
|---|---|---|
| 技能说明永远显示第 1 级的数值 | `uberTips` 数组比等级短，或某条被塞进了空槽 | 数组对齐等级；溢出槽位的那一条移到 rank 1 |
| 攻略/提示系统整块消失 | 脚本用 `GetObjectName` 比英文名，中文把它翻了 | 加入「保持英文」清单 |
| 右上角出现一堆 `]` | 不是翻译问题：观众分身重复执行了字符串自拼接 | 引擎侧修（`src/jass/interpreter.ts` 的 `frame.vars` 快照） |
| 诱捕类技能挂错 buff 行 | 中文 `EditorSuffix`（「（空中的）」）里没有 `air` 关键字，启发式全部落到同一行 | 引擎改读模型文件名，别靠后缀 |
| 报错说「木材不够」，其实是「不需要卷轴」 | 地图 `[Errors]` 段改写了引擎语义，我们以前整段丢弃 | `errors` 表 + `CommandSource` 优先问地图 |
| 左上角 `Map Info` 还是英文 | 那是 `war3mapSkin.txt [FrameDef]` 的字面量，`wts` 与暴雪中文数据都覆盖不到 | `skin` 表按 key 覆盖 |
| 选图列表里简介还是英文 | 列表阶段还没有 live 词典，`TRIGSTR` 从**安装**的 wts 取词 | `info` 表 / `wts` 按编号（引擎已支持） |
| 屏幕出现「还需  300」 | 片段键被 `trim()`，译文又带了首尾空格 | 片段译文不带首尾空格 |
| 补丁文案改动没生效（79 条） | 1.31 补丁按英文原文做字符串替换，中文安装找不到目标串 | 已知未修，属引擎级问题 |

---

## 10. 每张新图的「必查项」

1. **对象数据是 `TRIGSTR` 还是字面量？** —— 决定 `wts` 还是 `objects`。
2. **`war3map.wts` 有几条、注释里有没有字段名？** —— 有注释就能按字段分优先级翻译（Spellcraft 有，DotA 没有）。
3. **脚本里有多少处名字比较？** —— `map-i18n-lint` 直接给出；命中的英文名不能翻。
4. **`war3mapSkin.txt` 有哪几段？** —— `[FrameDef]`/`[Errors]` 的字面量要进 `skin`/`errors`；`TRIGSTR` 的走 `wts`。
5. **`war3map.w3i` 的 name/description 是 `TRIGSTR` 还是字面量？** —— 决定 `info` 还是 `wts`。
6. **中文魔兽安装里有没有同名对象（复用基础 rawcode）？** —— 有就直接抄官方译名，别再自创。
