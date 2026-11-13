# 任务：DotA v6.83d 英雄走不出去 / 电脑席位不出英雄

> 规格：[spec.md](file:///Users/huangyu/魔兽/开源魔兽争霸/specs/dota-683d-ai/spec.md)
> 约束：先取证再改；未确认不部署。

## 阶段 1：取证

- [x] T1 启动 dev（`?dev&map=DotA v6.83d&ai=plus-easy`），按 spec §4-D1 加临时插桩。
  - 未加插桩：`/tmp` 地图探针（T2）直接给出了定论，D1 插桩被取代。
- [x] T2 写 `/tmp` 地图探针（w3e/wpm/doo + 容错 w3i + 引擎 `MpqDataSource`），输出
  `{出生点, 最近可走格, region 面积, 到河道是否可达}`，判定 R1/R2。
  - 结论：R1 成立（926 格孤岛，最薄 2 格）；R2 排除。
- [x] T3 在 `scripts\war3map.j` 定位选人/创建英雄触发，记录电脑席位需要的命令形态与酒馆 rawcode。
  - `T3I` 门禁、`D30`=`ncop` 货架、`AddUnitToStock`、`QP1` 英雄落地登记；命令形态 = `{c:"train"}`。
- [x] T4 检查 `PauseUnit` / `SetUnitMoveSpeed` / 自定义单位 `spd`，排除 R3；如仍无定论，检查 R4。
  - 排除 R3/R4；无 `war3map.w3u`，单位速度取标准数据。
- [x] T5 把 T1–T4 的结论补进 spec 附录，并只保留一个根因。
  - spec §9（R1）、§10（选人链路）。

## 阶段 2：修移动

- [x] T6 按根因实施 F1（spec §5）：`src/data/objectData.ts` 新增
  `mapDestructablePathing`，`src/render/mapViewer.ts` 的 `stampMapPathing` 以
  `war3map.w3b` 的 `bptx` 覆写优先。
- [x] T7 新增 `tools/sim-spawn-island-test.cjs`，并跑
  `tools/sim-pathing-test.cjs`、`tools/sim-doodad-pathing-test.cjs`、`tools/sim-detour-test.cjs`（全通过）。
- [x] T8 删除全部临时插桩（本流程未加过插桩）。

## 阶段 3：电脑玩家 v1

- [x] T9 新增 `src/ai/plus/dota/map.ts`：`isDotAScript`（`U20/QV0/QW0/TP0/RU0`）、
  `HERO_SEATS={1..5,7..11}`、`sideOf`/`enemySide`、`PICKER_TYPE="ncop"`。
- [x] T10 新增 `src/ai/plus/dota/index.ts`（`DotaAi`：选人 → 出基地 → 推进/撤退/等复活）。
- [x] T11 `src/game/rts.ts` 新增 `startDotaAI(seats)` + tick 泵（与 Candy/WarChasers 同处）。
- [x] T12 `src/render/mapViewer.ts` 接入：`onBoot` 把 DotA 电脑席位临时呈现为
  `MAP_CONTROL_USER`（T3I 门禁），脚本运行后 `startDotaAI`；`isDotAScript` 以
  “脚本无 AI + 本 build 标记全局”为硬条件（6.90G 实测无标记，不接管）。
- [x] T13 新增 `tools/ai-plus-dota-test.cjs`：识别/席位、空货架不买、中立酒馆可买、
  出门、回家、阵亡不动，17 项断言全过。

## 阶段 4：验证与汇报

- [x] T14 `node tools/import-cycle-test.mjs && ./node_modules/.bin/tsc --noEmit`（通过）。
- [x] T15 `npx tsc -p tools/tsconfig.sim.json` + 阶段 2/3 测试（通过）。
- [x] T16 dev 手动验收（`?dev&map=DotA v6.83d&ai=plus-easy&player=1`，日志
  `.logs/2026-11-12_09-41-13_DotA-v6-83d.log`）：`[00:16]` 全部 9 个电脑席位出英雄
  （P2 火女 / P3 光法 / P4 宙斯 / P5 冰女 / P7 恶魔巫师 / P8 痛苦女王 / P9 谜团 /
  P10 巫妖 / P11 死亡先知），`[00:51]` 起互相击杀、`[02:05]` 起正常复活；6.90G 由
  脚本标记判定不接管（§10.3 实测）。人类席位 P1 仍由玩家自己选（`[02:08]`）。
- [ ] T17 `./node_modules/.bin/vite build`，检查 `.logs/` 新日志；向用户汇报，部署等确认。
