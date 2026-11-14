# 任务：语音包内容（战役 → 对战 → DotA）

> 依据 `specs/voice-packs/spec.md`。按顺序执行；每完成一项勾选一项。

## T1 语音包短语层

- [x] `src/voice/packs.ts`：新增 `VoicePhrase`、`VoicePack.phrases`，仅类型导入 `VoiceIntent`。
- [x] `src/voice/parser.ts`：`ParseContext.packs?`；新增 `packIntent(ws, ctx)`；`parseClause` 在 `parseChat` 后、面板检测前调用。
- [x] `src/voice/control.ts`：`VoiceHost.packs?()`；`run()` 传 `packs`；menu 分支不传。

验收：`npx tsc --noEmit` 通过。

## T2 战役语音包

- [x] `parser.ts`：新增 `cinematic` / `quest` / `dialog` intent；`describe()` 三个 case。
- [x] `ZH`：加入“跳过过场 / 现在要做什么 / 第 N 个选项 / 接受”等中文入口（注意不要新增裸“继续”）。
- [x] `grammarWords()`：加入 skip/cinematic/cutscene/intro/objective(s)/option/accept。
- [x] `packs.ts`：填充 `CAMPAIGN_PACK.phrases`（跳过过场、任务目标、选项 1–3、接受）。
- [x] `voiceActions.ts`：`VoiceDriver` 增加 `cinematicPlaying` / `skipCinematic` / `questBrief` / `dialogChoices` / `chooseDialog`；`run()` 增加三个 case。
- [x] `mapViewer.ts`：抽出 `clickDialogButton(button)`；新增 `visibleDialog()`；实现五个 driver 方法（`skipCinematic` 复用 `beginCinematicSkip`，`questBrief` 读 `rt.quests`）。
- [x] `i18n/index.ts`：en + zhCN 增加 10 个 `voice.d.*` 键。

验收：解析器用例（T4）中战役四条通过。

## T3 对战与 DotA 包

- [x] `packs.ts`：填充 `MELEE_PACK.phrases`（侦察 / 集火 / 推进 / 防守）。
- [x] `packs.ts`：`MAP_PACKS` 注册 `dota-v6-83d` 与 `dota-ai-v6-90g-pt-br-v4-1`，共用 DotA 包（打野 / 清兵 / 推线 / 集火 / 守家）。
- [x] `ZH` 与 `grammarWords()`：补齐对战/DotA 中文词与英文 token。

验收：解析器用例（T4）中对战、DotA 各条通过。

## T4 解析器回归

- [x] `tools/voice-parser-test.cjs`：追加三组包用例 + “未启用包时跳过过场不生效”用例。
- [x] 运行 `npx tsc -p tools/tsconfig.sim.json && node tools/voice-parser-test.cjs`，全绿。

## T5 识别提示词

- [x] `src/voice/control.ts`：`COMMAND_EXAMPLES` / `COMMAND_EXAMPLES_ZH` 追加战役、对战、DotA 示例句。

验收：`npx tsc --noEmit` 通过。

## T6 构建与部署（仅 /play/）

- [x] `~/.local/bin/pnpm build:web`。
- [x] `tar czf /tmp/play-dist.tgz -C dist .`，scp 到 `root@120.26.173.20`，解压到 `/var/www/warcraft/play`（保留 `play.old`）。
- [x] 确认 `web/public/launcher/latest.json` 与 `web-1.0.x.zip` 未改动；**不生成更新包**。

## T7 手动验证

- [x] 战役：解析器用例与桌面/浏览器冒烟已通过；过场/任务/对话框的实际听音待用户在游戏内确认。
- [x] 对战：解析器用例已通过；实际听音待用户在游戏内确认。
- [x] DotA v6.83d：解析器用例已通过（打野 / 推线 / 守家）；控制台复现待用户确认。
- [x] 向用户汇报，并提醒“确认后再打热更新”。
