# 任务：地图列表偶发为空（Safari）

依据 [spec.md](./spec.md)。按顺序执行，每步可独立验证。

## T1. 导入兜底不再盲丢根段
- [x] 在 `src/assets/opfs.ts` 新增 `stripPickedRoot(parts: string[]): string[]`：第一段是已知安装顶层名（`maps`/`data`/`customkeybindings`/`.build.info`/`customkeys.txt`/归档名）时不丢，否则丢弃。
- [x] `pickViaInput()` 用它替换 `file.webkitRelativePath.split("/").slice(1)`。

## T2. 目录解析与大小写不敏感比较
- [x] `src/ui/mapBrowser.ts` 增加 `resolveFolder(entries, want)` 与 `sameFolder(a, b)`。
- [x] 构造函数用 `resolveFolder(entries, "frozenthrone")` 得到真实大小写的 `cwd`，找不到则为 `""`。
- [x] `readFolder()` 的过滤、`folderRows()` 的 `inCwd`/`subFolders` 比较改为大小写不敏感。
- [x] `openFolder()` 先用 `resolveFolder` 归一化，解析不到时回落到 `""`。

## T3. 地图表增长时刷新 entries
- [x] `MapBrowser` 记录 `mapsSeen`，新增 `syncEntries()`（复用 `addMap()` 的合并逻辑）。
- [x] `fill()` 开头调用 `syncEntries()`；有新增时清掉对应文件夹的 `readFolders` 记录并重读当前文件夹（`reloadFolder`）。
- [x] `addMap()` 改为复用 `syncEntries()` 的合并路径。

## T4. 空白就绪的诊断日志
- [x] `fillList()` 在 `ready && rows.length === 0` 时打印一次 `console.info("[Warcraft Open] map list is empty", {...})`。

## T5. 构建、回归与部署
- [x] `./node_modules/.bin/tsc --noEmit`（通过，无输出）
- [x] `./node_modules/.bin/vite build`（通过，`index-CCN1Teo_.js`）
- [x] 线上 Chromium 实测：单人 → 自定义游戏列表有 `FrozenThrone` / `Scenario` 文件夹与地图行；多人模式 → 创建游戏列表有 `Download` / `ENGLISH v1.30 (default)` / `FRANCAIS v1.27b` 文件夹行；两屏控制台均无报错。
- [x] 部署到 `120.26.173.20`：`dist` 已解包到 `/var/www/warcraft`，线上 bundle 含新代码（`map list is empty`）。

> Safari 无法在本机自动化驱动（无法代选游戏文件夹），但两条 Safari/WebKit 相关根因（`webkitRelativePath` 根段、目录大小写）已分别按 T1/T2 修复，且同一套代码在线上 Chromium 通过。
