# 任务：地图内残留英文/葡文清理

- [x] 1. `src/i18n/mapLanguage.ts` 新增 `mapWtsString(id: number): string | undefined`（仅 `live()` 时返回侧车 wts 行）。
- [x] 2. `src/world/mapInfo.ts` 的 `resolveName` 在解析 `TRIGSTR_<id>` 时优先用侧车 wts，再退回地图自身 wts。
- [x] 3. `src/main.ts` `startMatch`：`setMapLanguage(language)` 后、`showLoadingScreen` 前用 `parseMapInfo(mapBytes, …)` 重解析 `info`，使加载画面拿到中文。
- [x] 4. `tools/map-zh-extract.cjs`：
  - [x] 4a. `HERO_ZH` 补齐 6.90G 全部英雄职业名（含 Alchemist/Bloodrune/Bristleback/Disruptor/Earth Spirit/Dummy 行）。
  - [x] 4b. `ITEM_ZH` 补齐商店可见物品与 `Y0xx` AI 指令标签；内部调试物品不译。
  - [x] 4c. 新增 `UNIT_ZH` 并接入 `addEntry` 兜底链，覆盖 `n06A/n06B/n0CM` 及常见 `n02xx` 提示句。
- [x] 5. 引擎 zhCN 词表补 `REPLAY_CAMERA = 自动视角`（观察者面板）。
- [x] 6. 重新生成两张图的 `.zhCN.json`：`node tools/map-zh-extract.cjs "<map>"`（zhCN / enUS 各一份）。
- [x] 7. 验证：
  - [x] `npx tsc --noEmit`
  - [x] 生成器报告：英雄英文名 0、可见物品英文名 0
  - [x] dev 引导实测加载画面、英雄选择、商店、开局提示均为中文，截图留证
