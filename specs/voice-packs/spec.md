# 语音包内容：战役 → 对战 → DotA 地图案例

## 1. 目标

在已完成的语音包框架（`src/voice/packs.ts`：base → kind → map 三层合并）之上，按用户指定顺序填入内容：

1. **战役语音包**：跳过过场、朗读当前任务目标、选择剧情的对话选项。
2. **对战语音包**：侦察、集火、推进、防守。
3. **DotA 地图语音包案例**：打野、清兵、推线、集火、守家，并示范“一张地图一个包”的注册方式。

约束：

- 只部署线上 `/play/`；**不生成更新包**、不改 `web/public/launcher/latest.json`，等用户确认后再打热更新。
- 不做存档 / 读档 / 重开：源码中没有存档系统，`src/ui/escMenu.ts` 的 Save/Load/Restart 是禁用态；不伪造。
- 所有新增文案中英双语（`src/i18n/index.ts` 的 en 与 zhCN 两段）。

## 2. 现有基础（已实现，不改动语义）

- `src/voice/packs.ts`
  - `VoiceMapKind = "campaign" | "melee" | "custom"`
  - `VoicePack { id; entries? }`，`BASE_PACK` / `MELEE_PACK` / `CAMPAIGN_PACK` / `MAP_PACKS`
  - `mapKey(name)`、`voicePacks(kind, mapName)`（base → kind → map）
- `src/game/voiceActions.ts`
  - `VoiceDriver.packs?()`；`lexicon()` 末尾合并 `pack.entries`（约 1086-1089 行）
  - 所有命令都走点击/热键同一条路径（`runCommand`、`orderClickAt`、`RtsController.execute`）
- `src/render/mapViewer.ts`
  - `installVoiceControl` 创建 host，`packs: () => voicePacks(this.campaign ? "campaign" : mapDataSet() === "melee" ? "melee" : "custom", this.mapDisplayName)`（约 10132 行）
  - 过场跳过已有：`beginCinematicSkip()`（约 19035 行）→ `EVENT_PLAYER_END_CINEMATIC`
  - 任务数据：`this.mapScript?.interp.rt.quests`（QuestObj：title/description/items/required/completed/failed/discovered/enabled）
  - 对话框：`GameDialogOverlay` + `rt.dialogs`（DialogObj.visibleFor/buttons），点击逻辑在 `new GameDialogOverlay(... onClick: ...)`（约 5438-5477 行）
- `src/voice/control.ts`：`VoiceHost`、`parse(heard, { lexicon })`、`promptFor`
- `src/voice/parser.ts`：`VoiceIntent`、`parseClause`、`describe`、`grammarWords`、中文映射表 `ZH`

## 3. 设计决定

### 3.1 语音包增加“短语”，仍不承载代码

`VoicePack` 增加：

```ts
export interface VoicePhrase {
  /** 归一化后的英文 token 序列（与 parser.words() 的输出同一套），匹配时忽略 FILLER。 */
  words: readonly string[];
  /** 命中后直接产出的既有/新增 intent。 */
  intent: VoiceIntent;
}
export interface VoicePack {
  id: string;
  entries?: ReadonlyArray<LexEntry>;
  phrases?: ReadonlyArray<VoicePhrase>;
}
```

- 短语是**数据**，只决定一句话是什么意思，不新增执行能力；执行仍走 `voiceActions.ts` 的统一入口。
- 匹配方式：`parseClause` 开头、`parseChat` 之后、面板/暂停判断之前，取当前 clause 的 token（去掉 `FILLER`）与每个短语的 `words`（同样去 FILLER）做**完全相等**匹配；命中即返回该 intent。
- 先到先得：`voicePacks()` 已保证 base → kind → map 的顺序；同一短语在更专一的包里可覆盖更宽的包。
- 动态部分（“选择第几个选项”）用有限的静态短语覆盖 1–3，不做占位符引擎。

### 3.2 解析器拿到当前生效的包

- `ParseContext` 增加 `packs?: ReadonlyArray<VoicePack>`。
- `VoiceHost` 增加 `packs?(): ReadonlyArray<VoicePack>`。
- `control.ts` 的 `run()` 调用 `parse(heard, { lexicon, packs: h.packs?.() ?? [] })`；菜单 host 不传包，行为不变。

### 3.3 新增三种 intent

```ts
| { kind: "cinematic"; skip: true }                       // 跳过过场
| { kind: "quest"; read: true }                           // 朗读当前任务目标
| { kind: "dialog"; index?: number }                      // 选择脚本对话框的第 index+1 个按钮；无 index = 第一个可用的非退出按钮
```

`describe()` 为三者各加一行回显；`i18n` 增加对应 `voice.d.*` 文案。

## 4. 逐文件改动

### 4.1 `src/voice/packs.ts`

1. 从 `./parser` 追加类型导入 `VoiceIntent`；新增 `VoicePhrase` 接口与 `phrases?` 字段。
2. `CAMPAIGN_PACK` 填充：

| 说 | token | intent |
|---|---|---|
| skip the cinematic / 跳过过场 | `["skip","cinematic"]` | `{kind:"cinematic",skip:true}` |
| skip the cutscene / 跳过动画 | `["skip","cutscene"]` | 同上 |
| skip the intro / 跳过剧情 | `["skip","intro"]` | 同上 |
| objectives / 任务目标 | `["objectives"]` | `{kind:"quest",read:true}` |
| current objective / 现在要做什么 | `["objective"]` | 同上 |
| first option / 选择第一个选项 | `["option","1"]` | `{kind:"dialog",index:0}` |
| second option / 选择第二个选项 | `["option","2"]` | `{kind:"dialog",index:1}` |
| third option / 选择第三个选项 | `["option","3"]` | `{kind:"dialog",index:2}` |
| accept / 接受 | `["accept"]` | `{kind:"dialog"}` |

3. `MELEE_PACK` 填充：

| 说 | token | intent |
|---|---|---|
| scout / 侦察 | `["scout"]` | `{kind:"order",order:"move",target:{kind:"base",side:"enemy"}}` |
| focus fire / 集火 | `["focus","fire"]` | `{kind:"order",order:"attack",target:{kind:"hero",side:"enemy"}}` |
| push / 推进 | `["push"]` | `{kind:"order",order:"attackmove",target:{kind:"base",side:"enemy"}}` |
| defend / 防守 | `["defend"]` | `{kind:"order",order:"move",target:{kind:"base",side:"mine"}}` |

4. `MAP_PACKS` 注册两个真实存在于本仓库的地图 key（`mapKey()` 结果）：

- `dota-v6-83d`（`Warcraft III */Maps/hhkj/DotA v6.83d.w3x`）
- `dota-ai-v6-90g-pt-br-v4-1`（`DotA AI v6.90G PT-BR v4.1.w3x`）

两 key 共用同一个 `VoicePack` 对象：

| 说 | token | intent |
|---|---|---|
| jungle / 打野 | `["jungle"]` | `{kind:"order",order:"attackmove",target:{kind:"creeps"}}` |
| clear creeps / 清兵 | `["clear","creeps"]` | `{kind:"order",order:"attackmove",target:{kind:"region",region:{x:0,y:0}}}` |
| push the lane / 推线 | `["push","lane"]` | 同上（中路区域） |
| focus fire / 集火 | `["focus","fire"]` | `{kind:"order",order:"attack",target:{kind:"hero",side:"enemy"}}` |
| defend / 守家 | `["defend"]` | `{kind:"order",order:"move",target:{kind:"base",side:"mine"}}` |

DotA 的英雄/肉山等名字不写死 id：地图自定义单位进入视野或成为我方单位后，`lexicon()` 已自动收进地图自己的名字（`mine()` / `unitDef()` 两处）；示例包只演示“地图级短语”。

### 4.2 `src/voice/parser.ts`

1. `VoiceIntent` 增加 `cinematic` / `quest` / `dialog`（见 3.3）。
2. `ParseContext` 增加 `packs?`。
3. 新增 `packIntent(ws, ctx): VoiceIntent | null`：
   - `const norm = (a: readonly string[]) => a.filter((w) => !FILLER.has(w));`
   - 遍历 `ctx.packs ?? []` 的 `phrases`，`norm(ws)` 与 `norm(p.words)` 完全相等则返回 `p.intent`。
4. `parseClause` 在 `parseChat` 之后、面板检测之前调用 `packIntent`。
5. `ZH` 增加中文入口（长词优先）：
   - `跳过过场 → skip cinematic`、`跳过动画 → skip cutscene`、`跳过剧情 → skip intro`
   - `跳过 / 略过 / 快进 → skip`
   - `过场 / 过场动画 / 动画 / 剧情 / 影片 → cinematic`
   - `任务目标 / 当前任务 / 现在要做什么 / 要做什么 / 该做什么 / 下一步 → objective`
   - `选项一 / 第一个选项 → option 1`，`选项二 / 第二个选项 → option 2`，`选项三 / 第三个选项 → option 3`
   - `接受 / 同意 → accept`
   - `侦察 → scout`、`集火 → focus fire`、`推进 → push`、`防守 / 回防 → defend`
   - `打野 → jungle`、`清兵 → clear creeps`、`推线 → push lane`、`守家 → defend`
   - 注意：`继续` 已用于“继续建造 → finish”；不要新增裸 `继续`，避免抢走 finish。
6. `grammarWords()` 增加：`skip`、`cinematic`、`cutscene`、`intro`、`objective`、`objectives`、`option`、`accept`、`scout`、`push`、`defend`、`focus`、`fire`、`jungle`、`clear`、`lane`（`creeps`、`hero`、`base`、`attackmove` 已在表中）。
7. `describe()` 增加：
   - `cinematic` → `D("voice.d.cinematic")`
   - `quest` → `D("voice.d.quest")`
   - `dialog` → `i.index === undefined ? D("voice.d.dialogFirst") : D("voice.d.dialog", { n: i.index + 1 })`
8. `panelName` 不需要改；`quest` 与 `panel.quests` 不混淆。

### 4.3 `src/game/voiceActions.ts`

1. `VoiceDriver` 增加：

```ts
/** 现在是否在过场里（屏幕接口被收起）。 */
cinematicPlaying(): boolean;
/** 请求跳过过场；地图没有注册跳过触发器时返回 false。 */
skipCinematic(): boolean;
/** 当前任务目标（第一条未完成的任务）；没有任务时为 null。 */
questBrief(): { title: string; description: string; items: string[] } | null;
/** 当前脚本对话框的按钮，按屏幕顺序；没有对话框时为空。 */
dialogChoices(): Array<{ text: string; disabled: boolean }>;
/** 按下对话框的第 index 个按钮；不可用或越界返回 false。 */
chooseDialog(index: number): boolean;
```

2. `run()` 增加三个 case：
   - `cinematic`：`d.skipCinematic()` 为真则 `d.message(t("voice.d.cinematic"))`；否则 `d.error(t("voice.d.noCinematic"))`。
   - `quest`：`const q = d.questBrief()`；无则 `d.error(t("voice.d.noQuest"))`；有则先确保 F9 面板打开（复用 `panel` 的 `d.panelOpen("quests") / d.togglePanel("quests")`），再 `d.message(t("voice.d.questBrief", { text: [q.title, q.description, ...q.items].filter(Boolean).join("；") }))`。
   - `dialog`：`index = i.index ?? d.dialogChoices().findIndex((b) => !b.disabled)`；没有对话框 → `voice.d.noDialog`；`d.chooseDialog(index)` 为假 → `voice.d.dialogUnavailable`；成功则 `d.message(t("voice.d.dialogDone", { text: d.dialogChoices()[index]?.text ?? "" }))`（按下后对话框通常已关闭，文案用按下前的文本，需在调用前取）。
3. 返回的 host 增加 `packs: () => d.packs?.() ?? []`。
4. 不需要改 `lexicon()`（entries 合并逻辑已存在）。

### 4.4 `src/voice/control.ts`

1. `VoiceHost` 增加 `packs?(): ReadonlyArray<VoicePack>`（从 `./packs` 仅类型导入）。
2. `run()`：`const intents = parse(heard, { lexicon, packs: h.packs?.() ?? [] });`
3. menu 的 console 分支（约 391 行）保持 `parse(heard, { lexicon: new Lexicon([]) })`，不传包。
4. `promptFor` 的示例句增加三类说法（中英各一段）：
   - 英文追加：`Skip the cinematic. What is my objective? Choose the first option. Scout. Focus fire. Jungle. Push the lane.`
   - 中文追加：`跳过过场。现在要做什么。选择第一个选项。侦察。集火。打野。推线。`
   只在示例里，不影响解析。

### 4.5 `src/render/mapViewer.ts`

1. 类型导入补 `DialogButtonObj`（与现有 `DialogObj` 同一行，约 32 行）。
2. 把 `GameDialogOverlay` 的 `onClick` 闭包（约 5444-5475 行）里“点击之后做什么”抽成私有方法：

```ts
private clickDialogButton(button: DialogButtonObj): void
```

   闭包只保留 `onClick: (button) => this.clickDialogButton(button)`。方法体与现有逻辑逐行一致（replay 分支、`visibleFor.delete`、`remoteDialog = null`、`showDialog(null)`、`fireDialogClick`、quit 的 `leave`）。
3. 新增 `private visibleDialog(): DialogObj | null`：`this.remoteDialog ?? this.mapScript?.interp.rt.dialogs.find((d) => d.visibleFor.has(this.localPlayer)) ?? null`。
4. 在 `installVoiceControl` 的 driver 对象里增加：

```ts
cinematicPlaying: () => !this.interfaceShown,
skipCinematic: () => {
  if (this.interfaceShown) return false;
  const interp = this.mapScript?.interp;
  if (!interp?.playerEventAnswered(this.localPlayer, EVENT_PLAYER_END_CINEMATIC)) return false;
  this.beginCinematicSkip();
  return true;
},
questBrief: () => {
  const rt = this.mapScript?.interp.rt;
  if (!rt) return null;
  const live = rt.quests.filter((q) => q.enabled && q.discovered && !q.completed && !q.failed);
  const q = live.find((x) => x.required) ?? live[0];
  if (!q) return null;
  const clean = (s: string): string => rt.resolveTrigStr(s).replace(/\|[cC][0-9a-fA-F]{8}|\|[rR]/g, "").trim();
  return {
    title: clean(q.title),
    description: clean(q.description),
    items: q.items.filter((it) => !it.completed).map((it) => clean(it.description)).filter(Boolean),
  };
},
dialogChoices: () => this.visibleDialog()?.buttons.map((b) => ({ text: b.text, disabled: !!b.disabled })) ?? [],
chooseDialog: (index) => {
  const d = this.visibleDialog();
  const b = d?.buttons[index];
  if (!b || b.disabled) return false;
  this.clickDialogButton(b);
  return true;
},
```

   注意：`questBrief` 的文本清理只去颜色码，不翻译 TRIGSTR（`resolveTrigStr` 已解析占位符）。

### 4.6 `src/i18n/index.ts`

英文段（约 439-462 行）与中文段（约 953-976 行）各加：

| key | en | zhCN |
|---|---|---|
| `voice.d.cinematic` | Skip cinematic | 跳过过场 |
| `voice.d.quest` | Read objectives | 朗读任务目标 |
| `voice.d.dialog` | Choose option {n} | 选择第 {n} 个选项 |
| `voice.d.dialogFirst` | Choose first option | 选择第一个可用选项 |
| `voice.d.dialogDone` | Chose: {text} | 已选择：{text} |
| `voice.d.questBrief` | Objectives: {text} | 任务目标：{text} |
| `voice.d.noCinematic` | No cinematic is playing. | 现在没有过场动画。 |
| `voice.d.noQuest` | No objectives yet. | 现在还没有任务目标。 |
| `voice.d.noDialog` | No dialog is open. | 现在没有对话选项。 |
| `voice.d.dialogUnavailable` | That choice is not available. | 这个选项现在不可用。 |

### 4.7 `tools/voice-parser-test.cjs`

在现有用例末尾追加，均用显式传入的包：

1. `CAMPAIGN_PACK`：`跳过过场` → `{kind:"cinematic"}`；`现在要做什么` → `{kind:"quest"}`；`选择第一个选项` → `{kind:"dialog",index:0}`；`接受` → `{kind:"dialog"}`。
2. `MELEE_PACK`：`集火` → attack enemy hero；`侦察` → move enemy base；`推进` → attackmove enemy base；`防守` → move my base。
3. `MAP_PACKS["dota-v6-83d"]`：`打野` → attackmove creeps；`推线` → attackmove middle region；`守家` → move my base。
4. 未启用任何包时，`跳过过场` 不应产生 command（回退到基础文法后无动词），确保包是唯一来源。

（测试脚本如何构造 `Lexicon`/`parse` 以现有文件为准，只需在 `parse` 的上下文对象里加 `packs`。）

## 5. 验收标准

1. `npx tsc --noEmit` 无错误。
2. `npx tsc -p tools/tsconfig.sim.json && node tools/voice-parser-test.cjs` 全部通过（含新增用例）。
3. `pnpm build:web` 成功。
4. 只部署 `/play/`；`web/public/launcher/latest.json` 与 `web-1.0.x.zip` 均无变化（`git status` 可验证）。
5. 手动验证：
   - 战役章节：过场中按住 `.` 说“跳过过场”，画面按现有 ESC 跳过流程淡出并触发章节跳过；说“现在要做什么”打开 F9 并回显任务目标；“选择第一个选项”按下对话框第一个按钮。
   - 对战：选中单位说“侦察 / 集火 / 推进 / 防守”，回显正确且行为等同鼠标下令。
   - DotA v6.83d：说“打野 / 推线 / 守家”，回显与行为正确；控制台 `window.warcraftOpen.voiceSay("打野")` 可复现。
6. 更新包：**不生成**，完成后向用户汇报并等待确认。

## 6. 风险与边界

- 包短语是**整句精确匹配**（忽略 please/the/and 等填充词），不支持“侦察右边”这类带目标的扩展；需要时再按地图加短语。
- “接受”只按第一个可用的非退出按钮，避免误按“退出/放弃”。
- 过场跳过仍受地图自身限制：章节没有注册 `EVENT_PLAYER_END_CINEMATIC` 触发器时返回“现在没有过场动画”，不会黑屏。
- 存档 / 读档 / 重开不在本包内：引擎无存档实现。
- 不新增任何作弊路径：三个新 intent 分别只调用已有的 ESC 跳过、F9 面板、对话框点击入口。
