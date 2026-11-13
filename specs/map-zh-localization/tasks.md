# 任务：地图汉化（同级 `.zhCN.json`）

> 规格：[spec.md](file:///Users/huangyu/魔兽/开源魔兽争霸/specs/map-zh-localization/spec.md)
> 约束：不改 `.w3x`；先机制后内容；未确认不构建/不部署。

## 阶段 1：语言文件与匹配

- [x] T1 新增 `src/i18n/mapLanguage.ts`：`MapLanguage` 类型、`parseMapLanguage`、单例
  `setMapLanguage`/`mapLanguage`。
- [x] T2 同文件：`localizeMapWtsTable` / `localizeMapWtsText`（按 id + 按原文，重建文本照
  `i18n/campaignZh.ts` 的写法）、`mapDisplayText`（整行精确 → 最长片段，仅 zhCN）。
- [x] T3 同文件：`localizedMapInfo(info, lang)`（`name`/`description`，返回副本）、
  `applyMapObjectLanguage({registry, abilities, items, upgrades})`（name/properNames/tips/ubertips，
  数组按等级对齐，空值不覆盖）。
- [x] T4 同文件：`loadMapLanguage(read, mapPath)`，候选 `<dir>/<文件名>.zhCN.json` 与
  `<dir>/<basename>.zhCN.json`；解析失败只 warn。

## 阶段 2：接入引擎

- [x] T5 `src/main.ts`：`startGame(..., mapPath?)`，加载语言文件并 `setMapLanguage`；
  三个已知路径的调用点传 `mapPath`（`mapFileFor(path)`、LAN `onStart`、dev boot hook）。
- [x] T6 `src/ui/mapBrowser.ts`（含 `ui/fdfLan.ts`）：`readMapInfo` 解析后读同级语言文件并覆盖
  名称/简介（缓存保留原始 w3i）。
- [x] T7 `src/jass/index.ts`：`localizeWts` 之后再走 `localizeMapWtsText`。
- [x] T8 `src/render/mapViewer.ts` `loadMapObjectData`：wts 表先本地化再交 `makeTrigStr`；
  末尾调用 `applyMapObjectLanguage`。
- [x] T9 `src/jass/natives/text.ts`：`DisplayTextToPlayer`（含定时变体）与 `SetTextTagText`
  过 `mapDisplayText`；聊天输入/命令解析不经过。

## 阶段 3：生成器与内容

- [x] T10 新增 `tools/map-zh-extract.cjs`：提取 wts + `scripts\war3map.j` 字面量，
  `--template`/`--merge`，打印已译/未译统计。
- [x] T11 生成两份语言文件到 `Maps/hhkj/`：`DotA v6.83d.w3x.zhCN.json`（16 wts / 677 text）、
  `DotA AI v6.90G PT-BR v4.1.w3x.zhCN.json`（17 wts / 1,818 text）。

## 阶段 4：验证与汇报

- [x] T12 新增 `tools/map-lang-test.cjs`：解析/坏 JSON/CRLF/整行与片段/最长优先/
  id 与原文/对象数组/英文 no-op，全部断言通过。
- [x] T13 `./node_modules/.bin/tsc --noEmit`、`node tools/import-cycle-test.mjs`。
- [x] T14 安装目录纳入 sidecar：`opfs.ts`（目录选择 + `installLooseFiles`）、`vfs/loader.ts`
  （CASC/MPQ 松散层）、dev 插件与 `electron/install.mjs` 的 manifest `languageFiles`、
  `remoteInstall.ts`、`devBoot.ts`、`nativeInstall.ts`。
- [x] T15 dev 验收：`?dev&map=DotA v6.83d&player=1` 与 `?dev&map=DotA AI v6.90G&player=1`
  各跑一次，控制台分别打印
  `[i18n] map language: Maps\hhkj\DotA v6.83d.w3x.zhCN.json (16 wts, 677 text, 0 object(s))`
  与 `…DotA AI v6.90G PT-BR v4.1.w3x.zhCN.json (17 wts, 1818 text, 0 object(s))`，两图互不串。
  构建/部署等用户确认后再做。
- [x] T16 英雄名：两图都没有 `war3map.w3u`，英雄名在**地图内嵌的 `Units\CampaignUnitStrings.txt`**
  （`[H06S] Name="Admiral"`）。生成器改为读该表（有 w3u 时仍读 w3u），按 rawcode 写入
  `objects.units.<rawcode>.name`，并内置 DotA 英雄名英中对照表；6.83d 70 个、6.90G 71 个英雄已译，
  dev 生成列表实测显示「矮人狙击手 / 暗影牧师 / 暗影萨满 / 奥林匹斯之王 / 半人马酋长」。
  仍为英文：兵种/建筑/野怪名、物品名、技能名与说明、英雄个人名（按惯例保留英文）。
- [x] T17 全量盘点与自动补齐：
  - 安装目录 `ExtractedData/merged/Units/*Strings.txt`（官方中文，按 rawcode）作为回退；
    地图自身内嵌的 `Units\*Strings.txt` 全部纳入（不再只收英雄），因此兵种/建筑/野怪、
    官方物品、官方技能与升级名自动变中文。
  - 新增 `ITEM_ZH` 与变体规则（Recipe / Level N / 远程·近战 / 禁用·启用 / 葡萄牙语模式名），
    覆盖 DotA 自建物品与商店；新增 `TEXT_ZH` 与模板规则（召唤、多杀、换人、AI 菜单）覆盖播报
    与 6.90G 的 AI 界面；`prose()` 收紧，剔除 `TargetIndex`、`MorphAgi` 之类的标识符噪音。
  - 结果（Chinese / objects）：6.83d wts 16/16、text 562/592、units 637/1927、items 993/1025、
    abilities 633/4495、upgrades 64/85；6.90G wts 17/17、text 1070/1328、units 790/2042、
    items 1104/1172、abilities 620/4272、upgrades 64/85。
  - 仍英文：DotA 自定义技能名与多级 Tip/Ubertip（A0xx 等约 2,800 个，需人工词表）、
    约千条以「假单位名」形式存放的 DotA 播报/内部串、英雄个人名、内部调试物品。

## 阶段 5：显示缺陷与介绍文本（第二轮）

- [ ] T18 运行期取证（spec §9.2）：
  - `src/render/mapViewer.ts` `objectName` 钩子在 `n0JR`/`n0JS` 时打印 `[mb] objectName …`（仅 dev）；
  - `src/jass/natives/multiboard.ts` `MultiboardSetTitleText` 标题变化时打印 `[mb] title …`（仅 dev）；
  - dev 跑 6.83d，记录两行日志，判定“文本嵌套”还是“渲染叠影”。
- [ ] T19 按判定修复多面板标题：
  - A（文本正确、渲染叠影）→ `src/ui/multiboard.ts`：标题单行（`white-space: pre`）、超宽裁剪、
    每次 mount 释放旧 overlay；
  - B（标题已嵌套）→ 追 `GetObjectName` 名字来源（地图内嵌 `Units\*Strings.txt` 解析 /
    `applyMapObjectLanguage` 写入），修到返回纯 `Enemy:` / `Allied:`。
- [x] T20 物品介绍与技能介绍：`tools/map-zh-extract.cjs` 新增 `ITEM_DESC_ZH`（常用物品中文
  tooltip）与 `tools/dota-ability-zh.json`（496 个 DotA 英雄技能：中文名 + 中文 Ubertip），
  写入 `objects.items.description` 与 `objects.abilities.name/tips/uberTips`；重跑生成器（默认 merge）。
  - 结果：6.83d items 720/1025 有中文 description、英雄技能 495/495 中文名与 Tip、474/495 中文 Ubertip；
    6.90G 同步，英雄技能 496/496 中文名与 Tip、477/496 中文 Ubertip（其余技能在地图里本身没有 tooltip 文本）。
  - dev 实测：`6438 object field(s) overridden (3305 object(s) in the file)`，地图正常启动，无语言文件错误。
  - 物品技能 `uberTips` 未单独写：物品 tooltip 在引擎中读 `items.description`，不是物品技能。
  - `dota-ability-zh.json` 是工具侧数据文件；运行时仍只读地图旁的 `.zhCN.json`，换图不需要改引擎代码。
- [x] T22 物品与技能介绍改为「从地图读取」：
  - 物品源：地图自带 `Units\ItemStrings.txt`（6.83d 1,025 节 / 571 段唯一 `Ubertip`；6.90G 1,173 节）。
    生成器 items 分支改为优先取该表原文的译文，其次安装目录中文行，最后 `ITEM_DESC_ZH`。
    新增 `tools/dota-item-zh.json`：按 `Ubertip` 原文（而非物品名）为键的 571 条中文译文，
    避免「静音副本 / 充能瓶 / 模式按钮」等同名不同文的条目串用同一段说明。
  - 技能源：地图自带的 `Tip`/`Ubertip` 每档一条（`"a","b","c"`）。新增
    `tools/dota-ability-body-zh.json`：以「数字→`{N}` 的骨架」为键的 1,178 条译文，
    生成时按每档原文把数字填回，得到 `uberTips` 的**逐档**中文（此前按技能名只存一条，
    满级技能会显示 1 级数字）。名字仍按 `dota-ability-zh.json` 的英文名对照。
  - 引擎补齐：`src/data/objectData.ts` `applyItemMods` 增加 `utip`（Tooltip - Basic），
    此前地图的该字段被忽略。
  - 结果：两张图所有「地图里有正文」的物品条目都有中文 description（6.83d 894、6.90G 928）；
    英雄技能 6.83d 487/487、6.90G 490/490 有逐档中文正文，每档数字与地图原文完全一致；
    JSON 中无残留 `{N}`，非中文 description 为 0 条。
  - dev 实测：`[i18n] map language: Maps\hhkj\DotA v6.83d.w3x.zhCN.json (16 wts, 592 text, 3312 object(s))`，
    地图正常启动，无 i18n 报错；`tsc --noEmit` 通过。
- [ ] T21 验收：`tsc --noEmit`；dev 中标题单行无嵌套；悬停「治疗药膏」等原作物品显示中文介绍。
