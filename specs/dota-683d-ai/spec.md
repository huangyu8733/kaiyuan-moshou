# 规格：DotA v6.83d 英雄走不出去 / 电脑席位不出英雄

## 1. 现象

- 地图：`Warcraft III zhCN/Maps/hhkj/DotA v6.83d.w3x`。
- 单人开局，其余 10 个席位设为「电脑（简单）」（日志里是 `Computer+ (Easy)`）。
- 问题 A：玩家选了 Zeus（`Lord of Olympus`，1 级），英雄站在基地树丛/木栅栏之间，右键走不出去。
- 问题 B：电脑席位「玩家没有出现」——整局没有任何电脑英雄。

## 2. 已确认的代码/数据事实（非猜测）

### 2.1 运行日志（`.logs/2026-11-12_08-20-05_DotA-v6-83d.log`）

- `P1 Player 1 — nightelf, team 1, human`；`P2–P5`、`P7–P11` 全部 `Computer+ (Easy)`。
- `[00:16] P1 hero Lord of Olympus "Zeus" (level 1)` —— 玩家英雄确实创建了。
- `[00:30]` 起每 30 秒的 `STATUS`：`P2`–`P5`、`P7`–`P11` 全部 `heroes=[]`，`army=[]`，只有 `buildings=[1 Circle of Power]`。
- `[01:47] P6 trained … / P0 trained …`：只有中立基地（P0/P6）在按地图脚本刷兵；没有任何电脑席位出英雄。
- `[02:26] P1 trained 1 Scroll of Town Portal`：玩家仍能下单，说明卡的是“走”而不是整个命令系统。

### 2.2 地图脚本（已解包：`scripts\war3map.j`，3,167,858 字节）

- `main` 在 91186 行；`SetPlayerStartLocation` 共 10 处（98205–98259）。
- 全文件 `GetPlayerController` 只有 5 处（3152 / 3160 / 3168 / 32325 / 91980），**全部**是 `== MAP_CONTROL_USER`。
- 全文件没有 `MAP_CONTROL_COMPUTER`，也没有 `StartMeleeAI` / `PickMeleeAI`。
- 结论：**这张 6.83d 地图自身不带任何 AI**。真实 WC3 里把席位设成电脑，也不会有 AI 英雄；「电脑简单要出玩家」只能由引擎的 Computer+ 代打。
- 对照：`DotA v6.80 AI …w3x` 的日志在 `[01:01]`–`[01:09]` 让 `P2`–`P11` 全部拿到英雄——因为那张图把 AI 写进了 `war3map.j`，6.83d 没有。

### 2.3 引擎侧 AI 席位（已读代码）

- `src/game/rts.ts:1201` `startMeleeAIFor`：只有地图脚本调用 `StartMeleeAI` 才会入座。
- `src/game/rts.ts:1224`：`seat.plus && !this.meleeMap` → 自定义图上 Computer+ 被拒绝，回退经典近战 AI（`1263` 打一条提示）。
- 因此 6.83d 的电脑席位落到经典近战 AI：它只会造兵/采矿，不会选英雄——与日志里 P7 `trained 12 ObserverTruesight` 吻合。
- 已有两个“自定义图专用 AI”的先例，可作为第三个接缝的模板：
  - `src/game/rts.ts:1293` `startCandyWarAI`；
  - `src/game/rts.ts:1313` `startWarChasersAI`；
  - 调用点都在 `src/render/mapViewer.ts` 跑完地图脚本之后（`3531` 附近）。
- 结论：问题 B 的根因是 **缺少 DotA 的 Computer+ 实现**，不是席位/权限/玩家创建错误。

### 2.4 移动链路（已定位，根因待 D 协议取证）

- 命令入口：`src/game/rts.ts:6563` `case "move"`。
- 执行：`src/sim/world.ts` `issueMove` → `pathTo`（`10847` 一带）→ `findPath`（`src/sim/pathfind.ts:329`）。
- `src/sim/pathfind.ts` `prepare()`（277–295）会把**起点 snap 到最近可走格**；目标只在“起点所在 region”内择优。
  → 一旦出生点被树/建筑 stamp 围成孤岛，路径只会在孤岛内 best-effort，表现就是“点哪都不走”。
- 候选根因（按可能性排序，必须由 D 协议收敛到一条）：
  - R1 喷泉/酒馆出口被 `blockStamps`（树 + `Circle of Power` 等建筑足迹）封死，region 隔离；
  - R2 出生格本身不可走，snap 后仍留在小 region；
  - R3 地图脚本对英雄 `PauseUnit` / `SetUnitMoveSpeed` 未解除，或自定义单位数据移速为 0；
  - R4 移动命令没有真正下发（选择/本地玩家/命令队列）。
- 截图（Zeus 站在绿色草地、木栅栏与树丛之间）与“近卫基地喷泉/酒馆树林”一致，R1/R2 嫌疑最大。

## 3. 目标与非目标

目标：

- G1 本地 dev 下，玩家英雄能右键走出基地并到达河道；不破坏近战与其它自定义图的寻路语义。
- G2 `Computer（简单/普通/疯狂）` 席位能自动选英雄、离开基地、沿战线行动（v1 只做：选人 + 出基地 + 简单推进/撤退/等复活，不含最优技能与装备）。
- G3 不影响 `DotA v6.80 AI` 这类“地图自带 AI”的图（有自带 AI 时不接管）。

非目标：

- 不实现完整的 DotA 对线/补刀/出装 AI。
- 不改地图资源、不写死坐标到引擎里（坐标来自 D2 探针与地图脚本）。
- **未经用户明确确认不部署到 `warcraft.hhkj.me`**（沿用项目约束）。

## 4. 诊断协议（先取证，再改一处）

### D1 dev 复现与运行时取证（临时插桩，完成后全部删除）

1. `src/game/rts.ts:6563` `case "move"`：打印 `player / unitId / 目标 x,y / 当前选择`。
2. `src/sim/world.ts` `issueMove`：打印 `u.x,u.y / u.speed / u.paused / u.order / pathTo 返回值 / path.length / path 末点`。
3. `src/sim/pathfind.ts` `prepare()`：打印 `start / from / goal / to / startRegion / goalRegion` 与返回 null 的分支。
4. 用 `?dev&map=DotA v6.83d&ai=plus-easy` 启动，日志写进 `.logs/`（dev-log 已存在）。

### D2 地图数据探针（node 脚本放 `/tmp`，不提交）

- 读取 `war3map.w3e` / `war3map.wpm` / `war3map.doo` / `scripts\war3map.j`。
- `war3map.w3i` 是被裁剪的（mdx-m3-viewer 会抛 `premature end`），必须用项目自己的容错解析 `src/compat/w3i.ts`；`war3mapUnits.doo` 不在 listfile 里，必须用引擎自己的 `MpqDataSource` 读取路径，不能用 mdx 的 `archive.get`。
- 输出一条判定：`{出生点, 最近可走格, 所属 region 面积, 到河道目标点是否同一 region 可达}`。
- 目的：把 R1/R2 变成可复现的数字证据（例如 region 只有 14 格 = 孤岛）。

### D3 选人机制取证

- 在 `scripts\war3map.j` 中定位英雄购买/创建触发（`SellUnit` / 酒馆 rawcode / `CreateUnitAtLoc` / `ReviveHeroLoc`），确认：
  - 电脑席位需要的是一条什么命令（买酒馆单位 / 选择后创建 / 目标点购买）；
  - 英雄出生点与 `Circle of Power` / 酒馆的关系（同时服务 D2）。
- 结果写入本规格的附录，作为 `DotaAi` 选人步骤的唯一依据。

### D4 暂停与移速

- grep 脚本中的 `PauseUnit` / `SetUnitMoveSpeed` / `SetUnitPosition`，确认英雄创建后是否被暂停或改速；再看该单位在自定义 `w3u` 数据里的 `spd`。

## 5. 修复方案（由取证结果二选一/多选一，只改根因）

- F1（对应 R1/R2）：
  - `src/render/mapViewer.ts` 地图加载的 stamp 段：出生标记类单位（`Circle of Power` 等）不写 `blockStamps`；树按 destructible 的真实 pathing 半径落格，不额外扩边。
  - `src/sim/world.ts` `issueMove`：下达移动前若单位所在格不可走，先把它平移到 `nearestWalkable`（与 WC3 一致），再寻路。
  - `src/sim/pathfind.ts` `prepare()`：目标 region 的候选里加入“起点的可走区”，避免目标被 snap 进孤岛。
- F2（对应 R3）：修 `PauseUnit` 解除/自定义单位移速默认值（`src/data/units.ts` + 地图对象数据合并路径）。
- F3（对应 R4）：修 `src/game/rts.ts` 的 move 命令链路（选择/本地玩家/队列）。
- 每条修复都必须配一个最小回归测试：
  - F1：新增 `tools/sim-spawn-island-test.cjs`（合成网格复刻“出生点被 stamp 围死 → 必须能走出去”，并断言既有 `sim-pathing-test` 不回归）。
  - F2/F3：在对应既有 `tools/sim-*.cjs` 里加断言，不新建重复测试。

## 6. 电脑玩家（Computer+ on DotA）v1

新增（不碰 `src/ai/*` 经典 AI）：

- `src/ai/plus/dota/map.ts`
  - `isDotAScript(script)`：按地图脚本签名识别 6.8x/6.9x DotA（`"DotA"` 字符串 + 酒馆/阵营全局名），且**脚本内无自带 AI** 时才返回 true。
  - 常量：双方英雄席位、基地坐标、河道/战线 waypoint、酒馆 rawcode 列表（来自 D3）。
- `src/ai/plus/dota/index.ts`
  - `DotaAi.add(player, difficulty, seed)`；`tick`：
    1. 无英雄 → 对最近酒馆下“买英雄”命令（D3 确认的命令形态；必须走 `Authority` 现有命令，不加后门）；
    2. 有英雄且未离开基地 → 依次走向 waypoint；
    3. 血量低于阈值或附近有敌英雄 → 回基地；阵亡 → 等地图复活；
    4. 难度只调反应间隔/撤退阈值（沿用 `src/ai/plus/profile.ts` 的口径）。
- `src/game/rts.ts`：新增 `startDotaAI(seats)`，与 `startCandyWarAI`（1293）/`startWarChasersAI`（1313）同构，复用 `plusHost`。
- `src/render/mapViewer.ts`：在跑完地图脚本、判断 `isDotAScript` 后调用 `startDotaAI`（与 3531 附近 Candy/WarChasers 同一位置）；`DotA v6.80 AI` 因“脚本自带 AI”判定为 false，不接管。

## 7. 验收

- `node tools/import-cycle-test.mjs && ./node_modules/.bin/tsc --noEmit`。
- `npx tsc -p tools/tsconfig.sim.json` + 新增/相关 `tools/sim-*.cjs` 全绿。
- dev 手动验收：
  - P1 Zeus 从出生点右键到河道，位移 > 3000；
  - 电脑席位在 `~01:00` 内出现英雄，并离开基地（到基地外 waypoint）；
  - `DotA v6.80 AI` 仍由地图自带 AI 驱动，Computer+ 不插手。
- 构建：`./node_modules/.bin/vite build`。
- 部署：等用户确认后再做（现有 `release/开源魔兽争霸-0.3.82-arm64.dmg` 与服务器部署另行确认）。

## 8. 风险

- 地图保护导致 `war3mapUnits.doo` 不在 listfile：探针必须走引擎读取路径，否则会得出“地图没有预置单位”的错误结论。
- 新增 AI 若误判地图，可能接管自带 AI 的图：识别函数必须以“脚本内无 AI”为硬条件。
- 树 stamp 调整属于全局寻路语义，必须用 `sim-pathing-test` / `sim-doodad-pathing-test` / `sim-detour-test` 守住。

## 9. 附录：取证结论（T1–T5）

### 9.1 根因（R1，唯一）：`war3map.w3b` 的 `bptx` 覆写被忽略

- DotA v6.83d 的 `war3map.w3b`（version 2）里，原始对象 `YTlb` 只有一条修改：
  `bptx`（Pathing Texture）= **空字符串** —— 即“不阻挡寻路”。地图把两座基地周围的
  193 个装饰树墙显式设成无碰撞。
- 引擎的 stamp 只读 `Units\DestructableData.slk`，`YTlb` 的库存值是
  `PathTextures\2x2Default.tga`（2×2 格，全阻挡），于是这 193 个装饰墙全部被落格。
- 选人广场（含 5 个 Circle of Power、Fountain of Health）被这圈树墙封成一个独立
  region（926 格），出口最薄处只剩 2 个阻挡格（东北角 `YTlb@(-6528,-6464)` 与
  `YTlb@(-6592,-6400)` 相邻）；点单位都无法通过，英雄自然“走不出去”。
- 对照：不落任何 doodad 时，同一张图的地形是一个连通 region（200,972 格）；
  按 w3b 覆写落格后，出生点/河道/中路/基地外全部属于同一 region（146,027 格）。

### 9.2 证据（`/tmp` 探针，未提交）

- `dota683-island.cjs`：按 SLK 真实 `pathTex` 尺寸落格 → `circleP1 region 63 size 926`。
- `dota683-edge.cjs` / `dota683-thinnest.cjs`：孤岛最薄处 2 格，阻挡格来自
  `YTlb@(-6528,-6464)`；出口方向与 6.90G 的实际路线一致（东北角）。
- `w3b-dump.cjs`：`YTlb -> bptx=""`；另有 `B001`=4x4Default、`B002/B003`=无碰撞、
  `B006`=8x8Round 等自定义对象覆写。
- `tex-probe.cjs`：`2x2Default`/`4x4Default` 确为整块红色（全阻挡），排除“纹理本身有小缺口”。

### 9.3 修复（F1 落地）

- `src/data/objectData.ts`：新增 `mapDestructablePathing(w3bBytes)`，把 `bptx`/`bptd`
  折成 `{pathTex, pathTexDeath}` 覆写表（原始表按 `oldId`，自定义表按 `newId`）。
- `src/render/mapViewer.ts` `stampMapPathing`：
  - `collectMapDestructibles` 的行读取套上覆写（树列表、`pathTexDeath` 一致）；
  - `pathTexOf` 以覆写优先，空串/`_`/`none` 表示“无碰撞”，不再回落到库存值。
- 未改任何经典 AI、未改寻路算法本身；`SetTerrainPathable`、暂停/移速（R3/R4）均排除。

### 9.4 关于 6.90G

6.90G 自带 AI、且其基地出口连通；本缺陷的两处修复（w3b 覆写、DotA AI 接管）都
以地图自身数据/脚本为判据，互不套用：6.90G 的脚本含 AI，`isDotAScript` 必须为
false，不接管、不影响它原有的行为。

---

## 10. 附录：电脑席位不出英雄 —— 取证与修复（T9–T13）

### 10.1 6.83d 的选人链路（`scripts\war3map.j`，已解包）

- `T3I(p)` = `GetPlayerController(p) == MAP_CONTROL_USER`（全脚本只有 5 处
  `MAP_CONTROL_USER`，都是它）。“电脑”席位在脚本眼里不是玩家，因此：
  - `X12`/`X22`（36541-36596）只在 `T3I(p)` 为真时给 `D30[player]`（`ncop`
    Circle of Power）加三个出售技能、`AddUnitToStock` 三个英雄、选中并移镜头 ——
    电脑席位的商店永远是空货架。
  - `JR2`（35185）第一行 `if T3I(p)==false then return` —— 24 座选人雕像
    （`QA0[1..24]`，`K52` → `JR2`）这条路对电脑席位同样关闭。
- 但英雄落地后的登记没有任何控制器判定：`QP1`（93408 注册，条件是 `QX1`）在
  **任何英雄进入可玩区域**时把英雄移到本方泉水（`O4`/`S3`）、写入 `K1[player]`。
  所以只要地图自己创建了这个英雄，席位就被视为已选人。
- 因此修复必须同时满足两点：
  1. 让脚本在 init 时把电脑席位当玩家（否则货架空、金币/镜头等初始化缺失）；
  2. 用地图自己的购买入口拿英雄（`train` 一张真实货架），不 `CreateUnit` 绕过规则。

### 10.2 引擎侧的购买入口（核对过）

- `authority.ts` `case "train"`（892）：`isSold` 接受 `Sellunits` **或**
  `AddUnitToStock` 的货架（`SimWorld.shopStockInfo`），中立商店靠
  `SimWorld.canUseShop` 放行 —— 正是玩家点酒馆买英雄的同一条路。
- `sim/world.ts` `completeTrain`（10616）：卖出的单位命中
  `shopWaresOf(building).units` 时压入 `sellUnitEvents`，脚本的 `EVENT_UNIT_SELL`
  由此触发；英雄随后由 `QP1` 接管。
- 6.83d 没有 `war3map.w3u`（探针确认：w3u/w3t/w3h/w3q 缺失，w3b/w3d/w3a/w3i/
  w3s/wpm/doo/mmp 存在），所以英雄与酒馆都来自标准游戏数据 —— 酒馆的
  `Sellunits` 就是标准酒馆列表，`shopWaresOf` 能直接读到。

### 10.3 与 6.90G 的硬区分（实测，非假设）

`/tmp/dota-marker-probe.cjs` 分别读两张图的 `war3map.j`：

| 判据 | DotA v6.83d | DotA AI v6.90G |
| --- | --- | --- |
| 标记全局 `U20/QV0/QW0/TP0/RU0` | **全部存在** | **一个都没有** |
| `StartMeleeAI` | 无 | 无 |
| `MAP_CONTROL_COMPUTER` | 无 | **有** |
| `gg_trg_*` | 仅 `gg_trg_Hear` | 无（脚本自带 AI 用其它命名） |

`isDotAScript` 只认 `U20`+`QV0`+`QW0`+`TP0`+`RU0` 同时存在（`src/ai/plus/dota/map.ts`），
这是该 build 混淆后的全局名，6.90G 不具备；即使将来有人改图名，也不会误接管。

### 10.4 修复（F2 落地）

- `src/ai/plus/dota/map.ts`：`isDotAScript`、`HERO_SEATS = {1..5, 7..11}`、
  `sideOf`/`enemySide`、`PICKER_TYPE = "ncop"`。
- `src/ai/plus/dota/index.ts`：`DotaAi`
  1. **选人**：每 2s 扫一遍场上所有建筑的货架（本方/中立由引擎 `canUseShop` 判定，
     与玩家点击同一条路），取第一个英雄 ware 发 `{c:"train"}`。6.83d 的选人酒馆是
     **中立**建筑，普通对局不走 `D30` 货架（那只是 SD 模式）。
  2. **推进**：有英雄且未受伤 → `attackmove` 到敌方 Circle of Power（找不到则取本方
     基地关于原点的镜像点）。
  3. **撤退**：HP ≤ `max(0.2, plusProfile.retreatHp)` 回本方商店（泉水）；回满 80%
     再出门。
  4. **阵亡**：不做任何事，等地图自己的复活；45s 仍无活英雄才重新尝试购买。
  难度只改思考间隔（`plusProfile.armyPeriod`）与撤退阈值。
- `src/game/rts.ts`：`startDotaAI(seats)`（仿 `startCandyWarAI`）+ tick 泵。
- `src/render/mapViewer.ts`：
  - `onBoot` 里 `isDotAScript` 时把 `DOTA_HERO_SEATS` 中的 computer 槽临时呈现为
    `MAP_CONTROL_USER`（与 Candy 同一接缝），让地图 init 给每个席位配齐货架/金币/镜头；
  - 脚本运行后 `startDotaAI(computer 席位)`。引擎侧 `config.slots` 仍是 computer，
    经典近战 AI 不会入场（本图脚本无 `StartMeleeAI`）。
- `tools/ai-plus-dota-test.cjs`：识别/席位、空货架不买、中立酒馆可买、出门、回家、
  阵亡不动，共 17 项断言。

### 10.5 未做

- 不接管 6.90G（自带 AI）；不改 `war3map.j`、不改地图资源；不写死坐标；
  不加金钱/单位作弊。
- 最后一件补刀、装备、技能加点、分路属 v2，不在本次范围。

