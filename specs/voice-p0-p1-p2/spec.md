# 语音命令补全：P0 / P1 / P2（spec）

## 目标
按 P0 → P1 → P2 顺序补齐魔兽争霸 3 的语音操作；每批完成后执行类型检查、语音测试，并部署 `/play/`。**不生成 web-1.0.x.zip，不改 latest.json。**

## 约定
- 对外说法以中文为主，同时保留英文同义词；中文命令词加入 `src/voice/parser.ts` 的 `ZH` 表。
- 所有动作最终走 `RtsController.execute` 或卡片/点击同一条路，保证与鼠标同权限。
- 新增代码注释用中文；不新增无关重构。
- 每批验证命令：
  ```bash
  npx tsc --noEmit && npx tsc -p tools/tsconfig.sim.json && node tools/voice-parser-test.cjs && node tools/voice-test.cjs
  ```
- 部署：`pnpm build:web` → `tar czf /tmp/warcraft-play.tgz -C dist .` → scp 到 `root@120.26.173.20` → 服务器把 `play` 移到 `play.old` 后解压 → `curl` 验证 `/play/` 返回 200 且 index-*.js 已更新。

---

## P0（基础经济与操作）

### P0-1 商店买 / 卖
**parser.ts**
- `VoiceIntent` 增加：
  - `{ kind: "buy"; entry?: LexEntry; slot?: number }`
  - `{ kind: "sell"; entry?: LexEntry; slot?: number }`
- `VERBS1` 增加：`buy/buying/purchase: "buy"`，`sell/selling: "sell"`。
- `ZH` 增加：`买/购买/买入 → buy`，`卖/出售/卖掉 → sell`；繁体 `買/購買/賣/出售`。
- `parseClause` 增加 `case "buy"` / `case "sell"`：
  - 支持 `买治疗药水`、`买物品二`（slot 1..6）、`卖药水`、`卖物品一`。
  - 只有动词没有物品名时：`buy` 以 `entry` 为空交给执行层找最近可买商店；`sell` 以 `slot`/`entry` 为空则卖首个可卖物品。
- `describe` 增加 `voice.d.buy` / `voice.d.sell` 回显。

**voiceActions.ts**
- `VoiceDriver` 增加：
  - `buyItem(shopId: number, itemId: string): void`
  - `sellInventory(unitId: number, slot: number, shopId: number): void`
- `case "buy"`：
  - 在 `r.simView.units` 中找 `u.building && sim.shopServes(u.id, me())` 且 `sim.shopStock(u.id, itemId) !== 0`（`-1` 表示不限量）；
  - 指定了物品名：按 `d.items` 名称/ID 匹配；未指定：找货架上有任意物品且可负担的最近商店；
  - 按与 `anchor()` 的距离排序，调用 `d.buyItem(shop.id, itemId)`；失败时 `d.error(...)`。
- `case "sell"`：
  - 在选中/我方携带该物品的单位中确定 `unitId + slot`（`inventory` 匹配 `slot` 或名称）；
  - 找最近可用商店（`shopServes`），调用 `d.sellInventory(unitId, slot, shop.id)`。

**mapViewer.ts**
- `installVoiceControl` 的 driver 增加：
  - `buyItem: (shopId, itemId) => this.buyItem(shopId, itemId)`（复用现有私有方法，含反馈）。
  - `sellInventory: (unitId, slot, shopId) => { if (!this.rts?.execute(this.localPlayer, { c: "sellitem", unitId, slot, shopId })) this.refuse(...); }`。

**i18n / hints / 测试**
- `src/i18n/index.ts` 增加 `voice.d.buy`、`voice.d.sell`、`voice.d.noShop`、`voice.d.noCarrierItem`。
- `src/ui/voiceHints.ts` 增加“买…/卖…”提示。
- `tools/voice-parser-test.cjs` 增加：`buy healing salve`、`买治疗药水`、`sell potion`、`卖物品一`。

### P0-2 英雄复活
**parser.ts**
- Intent：`{ kind: "revive"; entry?: LexEntry }`。
- `VERBS1`：`revive/resurrect/raise: "revive"`。
- `ZH`：`复活/复活英雄/召回英雄 → revive`，繁体 `復活`。
- `case "revive"`：可带英雄名/类型（`lex.match(ws, i, ["hero"])`），否则复活最近的阵亡英雄。

**voiceActions.ts**
- `case "revive"`：
  - 取 `r.simWorld.fallen`（`Map<heroId, {typeId,...}>`）；
  - 找己方 `d.tech.get(u.typeId).revive === true` 的建筑（祭坛/酒馆），按距离排序；
  - `r.execute(me(), { c: "revive", buildingId: b.id, heroId })`；全失败时用游戏金币/食物不足的提示报错。

**测试**：`revive hero`、`复活英雄`。

### P0-3 运输装载 / 卸载
**parser.ts**
- Intent：`{ kind: "board"; target?: VoiceTarget }`、`{ kind: "unload" }`。
- `VERBS1`：`board/load/embark: "board"`；`unload/disembark: "unload"`。
- `ZH`：`上船/装载/进入运输 → board`，`下船/卸载/放下 → unload`。
- `case "board"`：目标缺省为屏幕内最近的己方运输单位。
- `case "unload"`：无目标，作用于当前选中运输/地穴。

**voiceActions.ts**
- `case "board"`：找己方、可载货、可见的运输单位（`SimUnit` 有载员容量/`order` 支持 `load`）；把选中单位通过 `d.toScreen` + `r.orderClickAt(x,y,false)` 右键运输单位（与鼠标装载同路）。
- `case "unload"`：调用 `r.execute(me(), { c: "order", ids, order: { kind: "unload" } })`（若命令形状不同，以 `src/game/commands.ts` 现有 `unload*` 为准，保持与点击同路）。

**测试**：`load the transport`、`装载`、`unload`、`卸载`。

### P0-4 修理 / 自动修理
**parser.ts**
- Intent：`{ kind: "repair"; entry?: LexEntry; target?: VoiceTarget }`、`{ kind: "autorepair"; on: boolean }`。
- `VERBS1`：`repair/fix/mend: "repair"`。
- `ZH`：`修理/维修/修复 → repair`；`自动修理 → auto-repair on`；`关闭自动修理/停止修理 → auto-repair off`。
- `case "repair"`：可带建筑名或目标；`case "auto-repair"` 读 on/off（复用 `auto-on/auto-off` 的写法）。

**voiceActions.ts**
- `case "repair"`：找选中工人（没有则最近空闲农民）→ 目标建筑（指定则按名称，否则最近的受损己方建筑）→ `r.execute(me(), { c: "repair", unitId, buildingId, queued: false })`。
- `case "autorepair"`：`autoRepairOn` 标志 + `setInterval`（约 2s）扫描己方受损建筑，按需发 `repair`；关闭时清定时器。定时器随 host 销毁（与 `lootTimer` 同法）。

**测试**：`repair the tower`、`修理`、`auto repair`、`关闭自动修理`。

### P0-5 屏幕内全选
**parser.ts**
- `select` 分支支持 `screen`：`select all on screen`、`select screen`、`屏幕上所有单位`、`全选屏幕`。
- Intent 复用 `{ kind:"select"; what:"screen" }`。

**voiceActions.ts / VoiceDriver**
- `VoiceDriver` 增加 `selectScreen(): void`。
- `mapViewer.ts` 中实现：`r.selectBox(0, 0, this.canvas.clientWidth, this.canvas.clientHeight, false)`。
- `voiceActions`：`case "select"` 的 `what === "screen"` 调 `d.selectScreen()`。

**测试**：`select all on screen`、`全选屏幕`。

**P0 完成后**：跑验证命令 → 构建部署 `/play/`。

---

## P1

### P1-1 结盟 / 共享视野 / 共享控制
- parser：`{ kind:"diplomacy"; action:"ally"|"unally"|"vision"|"control"; on: boolean; target?: VoiceTarget }`。
- 中文：`结盟/同盟`、`解除同盟/取消结盟`、`共享视野/给视野`、`共享控制/给我控制`、`取消共享…`。
- voiceActions：通过 `r` 的联盟命令（`src/game/commands.ts` 的 alliance 相关命令）执行；目标为玩家颜色/名字/盟友。
- 测试覆盖中英文。

### P1-2 地图信号
- parser：`{ kind:"ping"; target?: VoiceTarget }`；中文 `信号/标记/提示这里`。
- voiceActions：`target` 解析成世界坐标，调用新增 `VoiceDriver.pingAt(wx,wy)`（mapViewer 复用现有 ping 绘制路径）；无目标时对屏幕中心发信号。

### P1-3 真正的命令队列（Shift 排队）
- parser：`order` intent 增加 `queued?: boolean`；中文 `然后/之后/排队` 修饰。
- voiceActions：`queued` 时走 `r.execute` 的排队参数 / `orderClickAt(..., true)`，保持鼠标 Shift 同路。

### P1-4 单个单位移出编队
- parser：`{ kind:"ungroupone"; entry?: LexEntry; n?: number }`；中文 `把步兵从二队移除`。
- voiceActions：按控制组读取成员、移除指定单位/类型再重写该组；需要 `VoiceDriver` 增加 `groupMembers(n)` / `setGroup(n, ids)`（走 HUD driver 现有控制组接口）。

**P1 完成后**：验证 + 部署 `/play/`。

---

## P2

### P2-1 子组选择
- parser：`{ kind:"subgroup"; index: number }` / `next-subgroup`；中文 `下一组/上一个子组/选第一组`。
- voiceActions：对当前多类型选择按类型分组切换选中（走 `r.selectSingle`/`scriptSelect` 同路）。

### P2-2 下一个空闲农民
- parser：`{ kind:"select"; what:"idle"; next?: boolean }`；中文 `下一个空闲农民/找个空闲农民`。
- voiceActions：在空闲农民列表中循环选择，记住上次索引。

### P2-3 按类型集火
- parser：`{ kind:"focus"; entry?: LexEntry; target?: VoiceTarget }`；中文 `集火英雄/先打远程/集火步兵`。
- voiceActions：按类型筛选可见敌方，选出最近目标，对选中部队发 `attack` 到该单位（`orderClickAt` 同路）。

### P2-4 物品栏换位
- parser：`{ kind:"swap"; from: number; to: number }`；中文 `把物品一换到三/交换物品一和二`。
- voiceActions：调用 `RtsController` 现有物品移动接口（若无则加 `swapInventory(from,to)`，内部走 `sim` 的换位逻辑，与拖拽同路）。

**P2 完成后**：验证 + 部署 `/play/`。

---

## 验收
- 每批：`npx tsc --noEmit`、`npx tsc -p tools/tsconfig.sim.json`、`node tools/voice-parser-test.cjs`、`node tools/voice-test.cjs` 全绿。
- `/play/` 返回 200，加载新的 `index-*.js`。
- 不生成 `web-1.0.x.zip`，不修改 `latest.json`。
