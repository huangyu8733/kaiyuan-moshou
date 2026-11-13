# 规格：修复「创建游戏 / 自定义游戏」地图列表偶发为空（Safari 更明显）

## 1. 现象与复现

- 位置：LAN → 创建游戏（`LocalMultiplayerCreate.fdf`），以及单人 → 自定义游戏。
- 表现：「选择地图」框内只有搜索框，列表一行都没有，也没有加载转圈；服务器下拉显示 `warcraft.hhkj.me`。
- 触发：偶发，Safari（包括 iOS/macOS WebKit）更常见；刷新或换浏览器有时恢复。

## 2. 已确认的代码事实（非猜测）

1. `MapBrowser` 在构造时就快照地图表：
   - [mapBrowser.ts](file:///Users/huangyu/魔兽/开源魔兽争霸/src/ui/mapBrowser.ts) 构造函数 `this.entries = mapEntries(maps)`。
   - 之后只有 `addMap()`（地图站点下载）会重建 `entries`；`maps` 被别处写入（`main.ts: onMapDownloaded`、其他屏幕、安装晚到）时列表不会跟着变。
2. 列表是否「就绪」只看 `readFolders.has(this.cwd)`；`fillList()` 在就绪且无行时什么都不画（既没有行，也没有转圈），与截图一致。
3. 默认目录写死字面量 `"FrozenThrone"`：`this.cwd = entries.some(e => e.folder.toLowerCase() === "frozenthrone") ? "FrozenThrone" : ""`
   - 一旦真实文件夹的大小写不是 `FrozenThrone`（例如 1.31 CASC store 的键来自归档内部路径，常为小写 `frozenthrone`），`folderRows()` 的 `e.folder === cwd` 与 `readFolder()` 的 `x.folder === folder` 都匹配不到任何地图 → 列表只剩「上一级」甚至空。
4. 全部文件夹比较都是大小写敏感的（`mapEntries`/`folderRows`/`readFolder`），只有「是否存在 frozenthrone」这一处用了 `toLowerCase()`，两边不一致。
5. Safari/Firefox 走 `<input webkitdirectory>` 导入：[opfs.ts](file:///Users/huangyu/魔兽/开源魔兽争霸/src/assets/opfs.ts) `pickViaInput()` 里
   `const parts = file.webkitRelativePath.split("/").slice(1)` —— **无条件**丢掉第一段，假设它一定是用户选中的文件夹名。
   - 若该浏览器的 `webkitRelativePath` 已经是相对安装根目录（不含所选文件夹名），则 `Maps/FrozenThrone/x.w3x` 被切成 `FrozenThrone\x.w3x`，`isUnderMaps` 判假 → **所有地图被丢弃**；而根目录的 `war3.mpq` 仍满足 `parts.length === 1`，安装照常挂载。
   - 结果精确复现症状：游戏能进、菜单能开、地图列表恒为空、无转圈；且只在用 input 兜底的浏览器（Safari/Firefox）出现。

## 3. 目标

- 地图列表在 Chrome / Safari / Firefox 上都不再「已就绪但空白」，除非安装里确实没有任何地图。
- 目录名大小写、CASC store 键大小写、`webkitRelativePath` 是否含根段，都不再让地图凭空消失。
- 安装/下载在屏幕挂载之后才到达的地图，列表能自己补上。

## 4. 变更清单（精确到文件与函数）

### F1. 导入兜底：不再盲丢 `webkitRelativePath` 的第一段
文件：`src/assets/opfs.ts`，函数 `pickViaInput()`。

- 新增局部判断：第一段只有在「它确实是用户选中的文件夹名」时才丢弃。判定规则（顺序）：
  1. 若 `parts[0]` 的全小写属于安装顶层名（`maps`、`data`、`customkeybindings`、`war3.mpq`/`war3x.mpq`/`war3local.mpq` 等归档名、`.build.info`、`customkeys.txt`），说明路径**不含**根段，不丢；
  2. 否则（是普通文件夹名，且后面还有段）丢弃第一段，保持现有 Chrome 行为。
- 丢弃后重建 `rel = parts.join("\\")`，其余 `isMap` / `isUnderMaps` 判定不变。
- 同样的根段处理抽成一个 `stripPickedRoot(parts: string[]): string[]` 的私有函数，`pickViaInput` 与（若存在）其他 webkitRelativePath 入口共用；`readInstallDir` 走的是 DirHandle，不受影响。

### F2. 地图目录解析：用真实文件夹名，且大小写不敏感
文件：`src/ui/mapBrowser.ts`。

- 新增 `resolveFolder(entries, want: string): string | null`：在 `entries` 的 `folder` 里去大小写找 `want`，返回**实际的** folder 字符串；找不到返回 null。
- 构造函数：`const ft = resolveFolder(this.entries, "frozenthrone"); this.cwd = ft ?? "";`
- 新增 `private folderOf(path): string | undefined` 或直接让 `readFolder` 用 `sameFolder(a, b)`（`a.toLowerCase() === b.toLowerCase()`）过滤。
- `folderRows(all, cwd)`：`inCwd` 与 `subFolders` 的比较改成大小写不敏感；`parentOf` 保持原样（它操作的是已解析的真实大小写）。
- `openFolder()` 入口先 `resolveFolder`，`cwd` 一律保存真实大小写；解析不到时回落到 `""` 而不是空列表。
- `mapEntries()` 保持不变（key 保持原样，因为它会显示给玩家）。

### F3. 地图表晚到 / 新增时列表自刷新
文件：`src/ui/mapBrowser.ts`。

- 记录 `private mapsSeen = this.maps.size`。
- `fill(s)` 开头调用新的 `private syncEntries()`：若 `this.maps.size !== mapsSeen`，重建 `this.entries`（保留已读的 `label/melee/players/invalid/unsupported`，与 `addMap()` 的合并方式一致），更新 `mapsSeen`，并清掉 `readFolders` 中受影响的文件夹（新增 key 所在文件夹），保证新地图会被读取。
- `syncEntries()` 只在 `maps.size` 变化时执行，不做全量比较，开销与列表规模无关。
- `addMap()` 复用同一条合并路径，避免两份实现。

### F4. 空白但「就绪」时的诊断与兜底
文件：`src/ui/mapBrowser.ts`。

- `fillList()` 在 `ready && rows.length === 0` 时输出一次 `console.info("[Warcraft Open] map list empty", { maps: this.maps.size, folders: readFolders.size, cwd: this.cwd, entries: this.entries.length })`（同一账本只打一次，避免重建刷屏）。
  - 这是给玩家反馈「为什么空」的证据，不改变界面。
- 不新增任何 UI 文案（避免与 FDF 版面冲突）。

### F5. 验证与部署

- `./node_modules/.bin/tsc --noEmit`
- `./node_modules/.bin/vite build`
- 本地 `localhost:5173`：单人 → 自定义游戏；LAN → 创建游戏，两个屏幕都确认列表有文件夹与地图行。
- Safari（macOS 或 iOS 模拟/真机）重复以上两条；若手边只有 Chrome，则用 Firefox 覆盖 input 兜底路径。
- 回归：LAN 列表仍只有「本机 + warcraft.hhkj.me」；搜索框输入 / 清空 / Esc 后列表恢复；下载地图后新行出现在 `Download` 文件夹。
- 通过后按既有流程重新构建并部署到 `warcraft.hhkj.me`（`dist` → `/var/www/warcraft`）。

## 5. 验收标准

1. 安装已挂载的前提下，Chrome / Safari / Firefox 的「自定义游戏」和「创建游戏」在首次进入时都能列出 `Maps\` 下的文件夹与地图（不再出现全空且无转圈）。
2. 安装里的地图文件夹名与 `frozenthrone` 大小写不同（含 1.31 store 的小写键）时，仍然进入真实的 Frozen Throne 文件夹并列出地图。
3. 在本屏挂载之后新增的地图（其他屏幕下载 / 站点下载）在本屏下一次重建时出现。
4. `tsc --noEmit` 与 `vite build` 通过；构建产物部署后 `https://warcraft.hhkj.me` 行为一致。

## 6. 明确不做

- 不改 FDF 版面、不新增空状态文案、不改地图站点点位。
- 不重写 `readFolder` 的并发模型（仍是逐文件顺序读）。
- 不动 relay / 服务器列表 / i18n 相关代码。
