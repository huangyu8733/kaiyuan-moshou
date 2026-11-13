# 地图内残留英文/葡文清理（DotA 6.90G PT-BR）

## 背景（实测证据）

dev 引导（`http://localhost:5175/?dev&map=DotA AI v6.90G&player=0`）的控制台已确认中文词典加载成功：

```
[i18n] map language: Maps\hhkj\DotA AI v6.90G PT-BR v4.1.w3x.zhCN.json (17 wts, 1328 text, 4622 object(s))
[i18n] map language: 7830 object field(s) overridden (4622 object(s) in the file).
```

所以“还是到处是英文”不是词典没加载，而是以下五类文本目前不在覆盖范围内：

| # | 位置 | 现象（实测） | 根因 |
|---|------|--------------|------|
| 1 | 加载画面 | 整段葡文：`Esc abre a Loja Rápida` / `Bugs e sugestões` / `Itens clássicos do DotA 1` / `Edição em Português (PT-BR)` / `-comandos lista de comandos` | 实测：w3i 的 `loadingScreenTitle/Subtitle/Text` 为空，加载画面是地图自带的 `LoadingScreen.mdx` 模型 + `LoadingScreen{TL,TR,BL,BR}.blp` 四张美术图，上述葡文**烘焙在图片里**，文本层没有可覆盖的内容。引擎自己绘制的文本（`按下任意键以继续`、地图名）已是中文。属美术限制，非目标。 |
| 2 | 英雄选择列表 | `Alchemist` / `Bloodrune` / `Bristleback` / `Disruptor` / `Earth Spirit`；`Dummy: FastTurn-Melee` 等 | `HERO_ZH` 只补了 9 个英雄；其余英雄类型名查不到中文，`addEntry` 就丢弃条目 |
| 3 | 商店/物品 | `Ancient Relic`、`Magic Dragon Gun` 的葡文属性说明等（生成器统计：94 条物品名无中文） | `ITEM_ZH` / `ITEM_TEXT_ZH` 未覆盖 6.90G 新增与改名条目；`Y0xx` 是 AI 指令标签，也走物品名通道 |
| 4 | 游戏内提示 | `Player 1 has defaulted to . You will get 175 gold refunded when you pick a hero.` | 该句由脚本拼接**单位名**（n06A `has defaulted to`、n06B `You will get 175 gold refunded when you pick a hero.`、n0CM 整句），这些单位名没有中文 |
| 5 | 引擎 UI | 观察者面板 `Auto Camera` | 引擎 `uiString("REPLAY_CAMERA", "Auto Camera")` 缺 zhCN 词条 |

## 目标

上述 5 类在中文界面下全部显示中文；英文原样保留在数据里，不修改 `.w3x`。

## 方案

### 1. w3i 文本走侧车 wts（加载画面）

- [src/i18n/mapLanguage.ts](file:///Users/huangyu/魔兽/开源魔兽争霸/src/i18n/mapLanguage.ts)：新增导出
  ```ts
  /** 当前生效的地图词典里的 wts 行（仅 zhCN 且已装载时）。 */
  export function mapWtsString(id: number): string | undefined
  ```
  实现为 `live()?.wts.get(String(id))`。
- [src/world/mapInfo.ts](file:///Users/huangyu/魔兽/开源魔兽争霸/src/world/mapInfo.ts)：`resolveName` 解析 `TRIGSTR_(\d+)` 时先取 `mapWtsString(id)`，再退回 `strings.get(id)`。这样 `name/description/loading.title/subtitle/text` 都会拿到侧车里的中文（50001 已是中文）。
- [src/main.ts](file:///Users/huangyu/魔兽/开源魔兽争霸/src/main.ts) `startMatch`：`setMapLanguage(language)` 之后、`showLoadingScreen` 之前，用 `parseMapInfo(mapBytes, <原 map 名>)` 重解析一次 `info`（w3i 解析很轻），再 `localizedMapInfo`。目的：让加载画面在词典生效后解析 TRIGSTR，而不是沿用地图列表阶段（无词典时）解析出的葡文。

### 2. 英雄类型名

- [tools/map-zh-extract.cjs](file:///Users/huangyu/魔兽/开源魔兽争霸/tools/map-zh-extract.cjs) 的 `HERO_ZH`：补齐 6.90G 全部英雄职业名（英文 → 标准 DotA 1 中文名）。
- 取全集方法：解析地图内 `Units\*UnitStrings.txt`，取带 `Propernames=` 的行，与现有侧车对比，凡 `name` 非中文的都补。
- 已确认缺失的 rawcode（实测抽到的）：
  `n0AI/h054/N01H/N01I/N01J/N01T/N0HT = Alchemist`、`H00M = Bloodrune`、`n0AC/H008/h04U = Bristleback`、`h0CD/E02J = Disruptor`、`n0MW/h0EX/N0MU/N0MV = Earth Spirit`，以及 `Dummy: FastTurn-*` / `Dummy: SlowTurn-*`（`E021/E01P` 等）。
- 验收：生成器报告 `units ... 0 English hero name(s) left`，选择界面抽查 5 个英雄为中文。

### 3. 物品名 / 物品说明

- `ITEM_ZH` 补齐 94 条中的**商店可见**条目：`phea` 治疗药水、`pman` 魔法药水、`shea` 治疗卷轴、`rnec` 亡灵权杖、`pams` 反魔法药水、`plcl` 小净化药水、`rej2` 小恢复药水、`sreg` 恢复卷轴、`skul` 献祭头骨、`moon` 月之石、`tgrh` 微型大厅、`tsct` 象牙塔、`spre` 保存法杖、`ssan` 圣域法杖、`shas` 加速卷轴、`TWN1/2/3`、`TALT`；`Y0xx` AI 指令标签按语义译成中文。
- `n2O0 = Ancient Relic`（商店假单位）与 `h0EO/I0Q9… = Magic Dragon Gun`（魔龙枪）已有中文名，检查是否因未进入 `objects.items` 而漏覆盖，必要时加 `UNIT_ZH`。
- 内部调试物品（`I0Fxx Lycan Damage`、`I0GM Version Check`、`I0KK Aegis Check`、`I00E Morphling BUG`、`I01N/I01O Freeze`）不译。
- 物品说明（葡文 `Ubertip`）继续走 `ITEM_TEXT_ZH` 的正文键；缺的用 `itemDescZh` 兜底，避免商店 hover 出现葡文。

### 4. 脚本拼接的提示（单位名通道）

- 新增 `UNIT_ZH`（英文名 → 中文，单位/提示假单位通用），在 `addEntry` 的兜底链里使用：`known = itemZh(english) || UNIT_ZH[english] || HERO_ZH[english] || messageZh(english)`。
- 至少包含：n06A `has defaulted to` → `默认选择了`、n06B `You will get 175 gold refunded when you pick a hero.` → `选择英雄后将返还 175 金币。`、n0CM 整句 → 对应中文。
- 其余 `n02xx` 提示句（`Inventory is full` 等）同样进 `UNIT_ZH`；内部消息（`are` / `OWNING!!!` 等碎片）可跳过。

### 5. 引擎 UI 词条

- 找到 zhCN 的 GlobalStrings 词表（`REPLAY_CAMERA` 的翻译来源，`ui/hud.ts:2972` 的 `uiString`），补 `REPLAY_CAMERA = 自动视角`。若词表来自安装目录的 `Units\CommandStrings.txt` 之外的引擎内置表，则加在引擎的 zhCN 字典文件里。

## 修改文件清单

| 文件 | 改动 |
|------|------|
| `src/i18n/mapLanguage.ts` | 新增 `mapWtsString(id)` |
| `src/world/mapInfo.ts` | `resolveName` 优先侧车 wts |
| `src/main.ts` | `startMatch` 在词典生效后重解析 w3i 信息 |
| `tools/map-zh-extract.cjs` | `HERO_ZH`/`ITEM_ZH` 补齐；新增 `UNIT_ZH` 并接入兜底链 |
| 引擎 zhCN 词表（`REPLAY_CAMERA` 所在文件） | 补“自动视角” |
| 两张图的 `.w3x.zhCN.json` | 重新生成 |

## 验证

1. `npx tsc --noEmit` 通过。
2. `node tools/map-zh-extract.cjs "<地图>"` ×2（zhCN/enUS），报告：hero 英文名 0、可见物品英文名 0。
3. dev 引导实测：
   - 加载画面**引擎文本**为中文（`按下任意键以继续`、地图名）；图中葡文为美术图片烘焙，非目标；
   - 控制台 `[i18n] ... object field(s) overridden` 数量正常；
   - 英雄选择抽查 `Alchemist→炼金术士`、`Bristleback→钢背兽`、`Disruptor→干扰者`、`Earth Spirit→大地之灵`、`Bloodrune→血魔`（名称以实际职业为准）；
   - 商店 hover：`Ancient Relic→远古遗物`、`Magic Dragon Gun→魔龙枪`；
   - 开局提示为 `玩家 1 默认选择了… 选择英雄后将返还 175 金币`。
4. 英文界面行为不变（`live()` 仍要求 zhCN）。

## 非目标

- 不翻译 DotA 英雄**专有名**（Mirana Nightshade 等，按既有设计保留）。
- 不翻译内部调试物品、占位/碎片字符串。
- 不改 `.w3x` 本体。
