# 任务：英雄死亡后不重生

依据 [spec.md](./spec.md)。按顺序执行，D 阶段只取证不改逻辑。

## T1. 临时插桩（三个点）
- [x] `src/sim/world.ts` `recordFallenHero` 入口打印 `[rvdbg] recordFallenHero`（id/typeId/owner/isCreep/neutralPassive/isIllusion/isHero）。
- [x] `src/jass/interpreter.ts` `pumpUnitDeaths` 循环开头打印 `[rvdbg] deathEvent`（victim/typeId/owner/regs 数量）。
- [x] `src/game/rts.ts` `reviveHeroByScript` 入口打印 `[rvdbg] revive enter`（heroId/fallen/typeId/owner/food/hasUnit），三处 `return false` 前打印原因，成功路径打印复活后 `sim.units.has(heroId)`。
- [x] 追加一条起点探针 `[rvdbg] neutral hero seed`（typeId / foodUsed / foodFor(0)），因为浏览器自动化无法点击 canvas、无法制造死亡，只能在开局取数。

## T2. 取证与判定
- [x] `npx tsc --noEmit -p tsconfig.json` 通过后进 `?dev&map=神界危机-幻世隐藏英雄版`。
- [x] 采集起点探针（15 条中立英雄）：
  - 预置英雄的 `foodUsed`：`Hpal/Hmkg/Hblm/Edem/Ewar/Obla/Ofar/Ulic/Udre/Npbm/Ntin` = **5**，`Eill/Hlgr/Hjai/Usyl` = 0。
  - 玩家 0 的供给：`{"used":0,"made":0}` —— 地图 `war3map.j` 里 `PLAYER_STATE_RESOURCE_FOOD_CAP` 出现 0 次。
- [x] 判定表命中「菜门拒绝」一行：`foodRefusal(0, 5)` 在 `made = 0` 时必然返回 `Nofood`，`reviveHeroByScript` 在 `addSimUnit` 之前就 `return false`，`ReviveHeroLoc` 静默失败 → 英雄永不复活。
- [x] 坐标与矩形排除：`gg_rct______________004 = Rect(-9120,-6496,-8576,-6048)` 已由 `CreateRect` 建立（war3map.j 2152 行），中心约 `(-8848,-6272)`，不存在复活到 `(0,0)` 的问题。
- [x] 浏览器自动化无法点击 canvas（`hit test failed`），无法在自动化里制造真实死亡；改为数据取证 + 用户实机验证。

## T3. 实施唯一修复
- [x] `src/game/rts.ts` `reviveHeroByScript`：食物门槛只在玩家确有供给体系时生效

```ts
const food = this.authority.foodFor(f.owner);
if (food.made > 0 && this.foodRefusal(f.owner, def.foodUsed) !== "") return false;
```

  理由写在代码注释里：地图用 `SetUnitOwner` 把预置雕像交给玩家、且从不下发食物上限，玩家恒为 0/0，而标准英雄要 5 食物 —— 旧检查拒绝了地图每一次「15 秒后自动复活」。melee 不受影响：`reviveHeroByScript` 只服务 `ReviveHero/ReviveHeroLoc` 这两个 native，祭坛/酒馆走训练队列。

## T4. 验证
- [x] `npx tsc --noEmit -p tsconfig.json` 退出码 0。
- [x] `npx tsc -p tools/tsconfig.sim.json` 构建后：`node tools/sim-revive-test.cjs`（`revive: all checks passed`）、`node tools/sim-hero-attr-test.cjs`（all passed）、`node tools/sim-custom-map-test.cjs`（all passed）。
- [x] 代码复核：`addSimUnit(def, …, heroId)` 的 `reservedId` 会原样落地（rts.ts 4300 行），`sim.reviveFallenHero(heroId, heroId, …)` 能找回同 id；`scriptSpawns` 以同一 `simId` 二次出生（与 9084 行的脚本 `CreateUnit` 同一路径）。
- [ ] **用户实机验证（唯一剩余项，需人工操作）**：选英雄 → 让它阵亡 → 应看到红字「已经阵亡，15秒后自动复活！」→ 15 秒后英雄出现在 `(-8848,-6272)` 附近且镜头跟过去。
  - 自动化无法完成：页面 canvas 拒绝合成点击，无法下达移动/攻击指令。

## T5. 收尾
- [x] 删除 T1 的全部 `[rvdbg]` 临时日志（`grep -rn "rvdbg" src` 无输出）。
- [x] 再跑一次 `npx tsc --noEmit -p tsconfig.json`（exit 0）。
- [x] 未部署到服务器。
