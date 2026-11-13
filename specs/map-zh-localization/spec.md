# 规格：地图汉化（地图说明 + 脚本公告 + 对象名，同级语言文件）

> 目标地图：
> `Warcraft III zhCN/Maps/hhkj/DotA v6.83d.w3x`
> `Warcraft III zhCN/Maps/hhkj/DotA AI v6.90G PT-BR v4.1.w3x`
>
> 约束：**不修改 .w3x**。语言文件与地图同目录，引擎在加载该地图时读取。

## 1. 结论

可行，且不需要重新打包地图。两张图的可翻译文本分布在三个地方，各自由引擎现有的读取路径覆盖：

| 层 | 文本在哪 | 现状 | 覆盖方式 |
|----|----------|------|----------|
| A. 地图信息 | 地图内 `war3map.wts`（STRING 50000…） | 6.83d 16 条英文；6.90G 16 条 PT-BR | 按 STRING id 覆盖 |
| B. 屏幕公告 / 提示 | `scripts\war3map.j` 里的字符串字面量 | 6.83d 2,866 个唯一字面量（约 792 条成句）；6.90G 4,554 个（约 1,183 条，PT-BR，少量已有中文） | 只在“显示出口”按原文替换 |
| C. 单位 / 英雄 / 物品 / 技能名 | 6.83d、6.90G 都没有 `war3map.w3u/.w3t/.w3h/.w3q` → 名字来自安装的 zhCN 数据（日志里已是“火女/光法/宙斯”） | 已中文 | 可选：按 rawcode 覆盖 |

因此“生成中文语言文件放在地图同级目录”是正确做法；首版把 A 全量、B 常用条目翻好，C 留机制。

## 2. 实测取证（本规格的事实基础）

- 文件存在性（MPQ 探针，两张图一致）：`war3map.w3b/w3d/w3a/w3i/wts/wpm/mmp/doo` 有；`war3map.w3u/w3t/w3h/w3q` 无；脚本是 `scripts\war3map.j`（listfile 被剥离，按哈希可读）。
- `war3map.wts`：6.83d 3,763 字节 / 16 条（50000–50015）；6.90G 4,149 字节 / 16 条（50001–50016 起，含 BOM），内容为地图名、简介、作者联系方式、模式命令列表。
- `scripts\war3map.j`：6.83d 98,377 行；6.90G 133,967 行。字符串字面量统计见上表。
- `war3map.w3a`：1,031,633 字节 / 1,364 个对象，只有数值与目标类型字段（`Ocl3`/`aare`/`Uau1`/`atar`…），全文不存在 `anam`/`atp1`/`damage` 一类文本 → **技能名/说明不在 w3a 里**，来自其基础技能在安装数据中的名字。
- 引擎现成设施：
  - [wts.ts](file:///Users/huangyu/魔兽/开源魔兽争霸/src/jass/wts.ts) `parseWts`；
  - [index.ts](file:///Users/huangyu/魔兽/开源魔兽争霸/src/jass/index.ts#L146-L149) 读取 `war3map.wts` 并调用 `localizeWts`；
  - [campaignZh.ts](file:///Users/huangyu/魔兽/开源魔兽争霸/src/i18n/campaignZh.ts) 已有“按英文行查中文表”的先例（仅战役、仅 zhCN）；
  - [mapInfo.ts](file:///Users/huangyu/魔兽/开源魔兽争霸/src/world/mapInfo.ts#L210-L241) 地图名/简介的 TRIGSTR 解析；
  - [objectData.ts](file:///Users/huangyu/魔兽/开源魔兽争霸/src/data/objectData.ts#L618-L628) `makeTrigStr`；
  - [customKeys.ts](file:///Users/huangyu/魔兽/开源魔兽争霸/src/data/customKeys.ts) 已有“从安装目录读玩家可编辑松散文件并覆盖数据表”的做法 → 同级语言文件有先例。

## 3. 语言文件格式与命名

路径：与地图**同目录**，名字为 `地图文件名 + .zhCN.json`

```
Maps/hhkj/DotA v6.83d.w3x.zhCN.json
Maps/hhkj/DotA AI v6.90G PT-BR v4.1.w3x.zhCN.json
```

格式（UTF-8，JSON，`format` 版本号用于以后演进）：

```json
{
  "format": 1,
  "locale": "zhCN",
  "wts": {
    "50001": "在史诗般的战斗中从 112 位英雄中选择一位，守护远古遗迹。"
  },
  "text": {
    "First Blood": "第一滴血",
    "has just been killed by": "被以下玩家击杀："
  },
  "objects": {
    "abilities": { "A00Y": { "name": "弧形闪电", "tip": ["……"], "ubertip": ["……"] } },
    "units": { "h000": { "name": "……", "properNames": ["……"] } },
    "items": {},
    "upgrades": {}
  }
}
```

匹配规则（全部确定性、无机器翻译）：

- `wts`：先按 STRING id 覆盖；id 未命中时再用**原文**去 `text` 表查一次。
- `text`：键与值都做 CRLF→LF、去首尾空白后比较；先整行精确匹配，再按**最长键优先**做片段替换（键至少 4 个字符且含字母）。片段替换**只在显示出口**执行，绝不参与脚本逻辑（`-ap` 等命令解析不受影响）。
- `objects.*`：按 rawcode 覆盖；`tip`/`ubertip` 为按等级对齐的数组，空字符串/缺项保留原值。
- 仅当 `currentLocale() === "zhCN"` 且文件解析成功时生效；英文界面整段 no-op（与 `campaignZh` 一致）。

## 4. 应用点（精确到文件与函数）

1. 新增 [mapLanguage.ts](file:///Users/huangyu/魔兽/开源魔兽争霸/src/i18n/mapLanguage.ts)：
   - `parseMapLanguage(json: string): MapLanguage | null`
   - `setMapLanguage(lang: MapLanguage | null)` / `mapLanguage()`（模块单例，每场比赛设置一次，同 `customKeys` 的写法）
   - `localizeMapWtsTable(table: Map<number, string>): Map<number, string>`
   - `localizeMapWtsText(text: string): string`（给 `jass/index.ts` 用，重建 wts 文本的方式照抄 `campaignZh.localizeWts`）
   - `mapDisplayText(text: string): string`（整行 + 最长片段替换）
   - `applyMapInfoLanguage(info: MapInfo): void`（只改 `name` / `description`）
   - `applyMapObjectLanguage(regs: { registry: UnitRegistry; abilities: AbilityRegistry; items: ItemRegistry; upgrades: UpgradeRegistry }): void`
   - `loadMapLanguage(read: (path: string) => Promise<Uint8Array | null>, mapPath: string): Promise<MapLanguage | null>`
     - 候选路径：`<dir>/<mapFileName>.zhCN.json`，回退 `<dir>/<basename>.zhCN.json`；两条都不存在返回 null。
2. [main.ts](file:///Users/huangyu/魔兽/开源魔兽争霸/src/main.ts#L931) `startGame` 增加可选参数 `mapPath?: string`：在 `showLoadingScreen` 之前
   `setMapLanguage(mapPath ? await loadMapLanguage(installRead, mapPath) : null)`，随后 `applyMapInfoLanguage(info)`。
   调用点补 `mapPath`：`mapFileFor(path)`、LAN `onStart(path, …)`、dev boot（`DevBootHooks.startGame` 增 `mapPath` 参数）；战役/读取自归档的地图不传（无同级文件）。
3. [mapInfo.ts](file:///Users/huangyu/魔兽/开源魔兽争霸/src/world/mapInfo.ts) 的 `readMapInfo`（地图列表入口）在解析后尝试读同级语言文件并 `applyMapInfoLanguage`，按路径缓存，避免列表反复读盘。
4. [jass/index.ts](file:///Users/huangyu/魔兽/开源魔兽争霸/src/jass/index.ts#L146-L149)：`localizeWts(wtsText)` 之后再套一层 `localizeMapWtsText`。
5. [mapViewer.ts](file:///Users/huangyu/魔兽/开源魔兽争霸/src/render/mapViewer.ts#L4117-L4196) `loadMapObjectData`：
   - `wts` 字节解析成表后先 `localizeMapWtsTable`，再交给 `makeTrigStr` 与各 `applyMap*Data`；
   - 文件末尾调用 `applyMapObjectLanguage(...)`（必须在 w3a/w3u 之后，保证覆盖优先）。
6. [natives/text.ts](file:///Users/huangyu/魔兽/开源魔兽争霸/src/jass/natives/text.ts#L50-L120)：`DisplayTextToPlayer`（及其定时变体共用的路径）与 `SetTextTagText` 的文本参数过 `mapDisplayText`。聊天输入、命令解析、脚本内部比较一律不经过它。
7. 生命周期：`setMapLanguage(null)` 在每场比赛开始处调用，避免上一张图的词表泄漏。

## 5. 生成器：`tools/map-zh-extract.cjs`

- 输入一个 `.w3x`，输出/合并同目录 `.zhCN.json`：
  - `wts`：`{ id: 原文 }`
  - `text`：从 `scripts\war3map.j` 提取字面量，过滤纯 rawcode/路径/颜色码，按出现次数降序
  - `objects`：留空骨架（w3a 无文本，注释说明）
- 选项：
  - `--template`：把**全部**可提取键写成空值模板（供人工/批量翻译）
  - `--merge`（默认）：保留文件里已填的译文，只补新键
  - 打印统计：wts 条数、text 键数、已译/未译数
- 不覆盖已有译文；不写回 `.w3x`。

## 6. 首批内容（随规格一起交付）

- 两张图的 `wts` 16 条：全部译成中文（地图名保留原名，简介/作者/模式列表译出）。
- 6.83d `text`：击杀/连杀播报、模式提示、离开/暂停等常用系统行约 60 条。
- 6.90G `text`：PT-BR 常用系统行约 40 条（菜单、击杀播报、资源提示）。
- `objects`：机制就绪，内容后续按英雄/技能增量补。

## 7. 明确不做

- 不改 `.w3x`，不重新打包、不去除保护。
- 不翻译聊天命令 token（`-ap`/`-sd` 等）、不改变脚本逻辑。
- 不做自动机翻；技能说明等长文本由人工按模板增量填。
- 浏览器直接拖入本地 `.w3x`（拿不到同级目录）时无语言文件；安装目录、`?dev`、桌面应用三种入口可用。

## 8. 验收

1. `./node_modules/.bin/tsc --noEmit`；`node tools/import-cycle-test.mjs`。
2. 新增 `tools/map-lang-test.cjs`：解析/空文件/坏 JSON/CRLF/整行与片段匹配/最长优先/wts 按 id 与按原文/对象数组按等级/英文 locale no-op，全断言通过。
3. `node tools/map-zh-extract.cjs "<6.83d 路径>"` 生成文件，统计与 §2 一致；再跑一次确认 `--merge` 不丢译文。
4. `?dev&map=DotA v6.83d&player=1`：主菜单/加载画面地图名与简介为中文；开局屏幕公告为中文；技能名仍正常（安装数据）。
5. 同一 URL 跑 6.90G：PT-BR 系统行变中文，且两张图词表互不串（A 图译文不出现在 B 图）。
6. `.logs/` 无新增报错；`[jass]` 日志出现语言文件加载条数。

## 9. 第二轮：多面板标题（复活倒计时）与物品/技能介绍

### 9.1 已取证的事实

**A. 截图里那一行是什么**

是 DotA **最小化的多面板标题栏**（金边 + 右侧最小化按钮），不是提示文本、不是文本标签。标题由地图脚本每 0.1 秒重算一次：

| 图 | 函数 | 结构 |
|----|------|------|
| 6.83d | `function PXO`（`scripts\war3map.j`，约 762,045 字节处） | `local string PTO/PRO`，逐人累加计时；循环后**各只包一层** `[Allied: …]` / `[Enemy: …]`；末尾 `MultiboardSetTitleText(M0, PRO+" "+PTO+" "+s2)`，`s2 = " (K/D/A - LH/D - 金币)"` |
| 6.90G | 同名 HUD 函数（约 669,224 字节处） | 同上，变量名 `RV8/RU8` |

标题里的两个前缀来自 `GetObjectName(1848658514)` 与 `GetObjectName(1848658515)`：

- `1848658514` = `n0JR` → 地图内嵌 `Units\CampaignUnitStrings.txt` 的 `[n0JR] Name="Enemy:"`
- `1848658515` = `n0JS` → `[n0JS] Name="Allied:"`

`PTO`/`PRO` 是**局部变量**，每人只追加计时、整套只包一层 —— 地图逻辑本身不会产生 `[Enemy: [Enemy: …]]` 这种嵌套。

**B. 引擎侧不可能是“汉化改写”造成的**

| 环节 | 代码 | 是否改写文本 |
|------|------|--------------|
| `MultiboardSetTitleText` | [multiboard.ts](file:///Users/huangyu/魔兽/开源魔兽争霸/src/jass/natives/multiboard.ts#L154-L161) `mb.title = asStr(a[1])` | 否，纯赋值、不追加 |
| 标题渲染 | [render.ts](file:///Users/huangyu/魔兽/开源魔兽争霸/src/ui/fdf/render.ts#L1217-L1228) 每次 `el.innerHTML=""` 后重建 span | 否，无累积 |
| `GetObjectName` | [mapViewer.ts](file:///Users/huangyu/魔兽/开源魔兽争霸/src/render/mapViewer.ts#L3783) `registry.get(id)?.name ?? abilities… ?? items…` | 否，纯查表 |
| 我们的词表 | `mapDisplayText` 只在 [natives/text.ts](file:///Users/huangyu/魔兽/开源魔兽争霸/src/jass/natives/text.ts#L50-L120) 的 `DisplayTextToPlayer` / `SetTextTagText` 上用 | 多面板不经过 |

语言文件里也**没有** `n0JR` / `n0JS` 条目（`objects.units` 只有 `n0JO/n0JQ/n0JT` 等），所以标题那条路径上没有任何一处是我们的字符串。

⇒ 现状判断：**现有证据不支持“汉化导致标题错位/重影”**。`[[[` 只可能来自运行期 `GetObjectName` 的返回值（注册表里 `n0JR/n0JS` 的名字）或标题元素的叠影，必须用一次运行期日志定案（§9.2）。

**C. 物品/技能介绍为什么还是英文**

- 物品 tooltip 的正文取自对象数据：`items.description/summary/tip`，或其所挂物品技能的 `tip/ubertip`。
- DotA 自建物品/技能的英文说明**只存在于地图内嵌的 `Units\ItemStrings.txt` / `*AbilityStrings.txt`**；安装目录 `ExtractedData/merged/Units/*Strings.txt` 里没有这些自定义 rawcode（`A0xx`/`I0xx`），所以生成器拿不到中文可回退。
- 于是语言文件里：物品 993/1025 有**名字**，但只有 28 个原版物品有 `description`；技能 633/4495 有 `tip/ubertip`。UI 显示英文是**数据缺口**，不是 `.zhCN.json` 没被加载。
- 判定方法：在 dev 里悬停一个**原版**物品（如「治疗药膏」）——它的介绍应为中文；自建物品仍英文。

### 9.2 变更（T18 取证）

1. [mapViewer.ts](file:///Users/huangyu/魔兽/开源魔兽争霸/src/render/mapViewer.ts#L3783) `objectName` 钩子：当 `typeId` 是 `n0JR`/`n0JS` 时打印 `[mb] objectName <id> = <JSON.stringify(name)>`（仅 dev）。
2. [multiboard.ts](file:///Users/huangyu/魔兽/开源魔兽争霸/src/jass/natives/multiboard.ts#L154-L161) `MultiboardSetTitleText`：标题变化时打印 `[mb] title <JSON.stringify(text)>`（仅 dev）。
3. 判定规则：
   - 若 `objectName n0JR = "Enemy:"` 且 title 为单层 `[Enemy: 01 | 05] (…)` → 文本正确，问题在**渲染叠影**，按 T19-A 修 `src/ui/multiboard.ts`（标题单行不换行、旧 overlay 释放）。
   - 若 title 已嵌套 → `GetObjectName` 返回值异常，按 T19-B 追 `registry.get` 的名字来源（重点：地图内嵌 `Units\*Strings.txt` 的 INI 解析、`applyMapObjectLanguage` 是否把长串写进了标签单位）。

### 9.3 变更（T20 物品/技能介绍）

1. 生成器 `tools/map-zh-extract.cjs` 新增可选字典 `ITEM_TOOLTIP_ZH`（英文 tooltip 行 → 中文），写入 `objects.items.<rawcode>.description/summary` 与对应物品技能的 `uberTips`：键来自地图内嵌 `Units\ItemStrings.txt`（`Description`/`Tip`）与 `Units\*AbilityStrings.txt`（`Tip`/`Ubertip`）。
2. 首批补约 30 个最常用物品（治疗药膏、净化药水、魔瓶、速度之靴、回城卷轴、远行鞋、黑皇杖、跳刀、辉耀、撒旦、龙心、蝴蝶等）的中文介绍；其余留待人工增量。
3. 不做机器翻译；未收录的条目保持英文（现状）。

### 9.4 验收

1. `./node_modules/.bin/tsc --noEmit`。
2. dev 运行 6.83d：控制台出现 `[mb] title …` 与 `[mb] objectName …`；据判定规则落地 T19。
3. 最小化多面板标题为单行 `[Allied: …] [Enemy: …] (K/D/A - LH/D - 金币)`，不再出现 `[Enemy: [Enemy:` 嵌套或重影。
4. 悬停「治疗药膏」显示中文介绍；新补的 30 个物品在商店 tooltip 显示中文介绍。
