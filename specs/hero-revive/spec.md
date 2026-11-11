# 规格：修复「英雄死亡后不重生 / 看不到重生位置」（神界危机-幻世隐藏英雄版）

## 1. 现象

- 地图：`神界危机-幻世隐藏英雄版.w3x`（本地 dev：`http://localhost:5173/?dev&map=神界危机-幻世隐藏英雄版`）。
- 已验证前置：选英雄、视野、攻击都已修好（见会话记录）。
- 当前问题：英雄阵亡后 15 秒不复活；玩家也没看到「重生在哪里」。
- 约束（项目记忆）：只在本地开发环境验证；**未得到用户明确确认前不得部署到 `warcraft.hhkj.me`**。

## 2. 已确认的代码事实（非猜测）

### 2.1 地图侧（`war3map.j`，已解包阅读）

```jass
function Trig____________________002_Conditions takes nothing returns boolean
    if ( not ( IsUnitType(GetDyingUnit(), UNIT_TYPE_HERO) == true ) ) then
        return false
    endif
    if ( not ( GetPlayerController(GetOwningPlayer(GetDyingUnit())) == MAP_CONTROL_USER ) ) then
        return false
    endif
    return true
endfunction
function Trig____________________002_Actions takes nothing returns nothing
    call DisplayTimedTextToForce( GetPlayersAll(), 10.00, ( GetPlayerName(GetOwningPlayer(GetDyingUnit())) + "|cffFF0000已经阵亡，15秒后自动复活！" ) )
    call TriggerSleepAction( 15.00 )
    call ReviveHeroLoc( GetDyingUnit(), GetRectCenter(gg_rct______________004), true )
    call PanCameraToTimedLocForPlayer( GetOwningPlayer(GetDyingUnit()), GetRectCenter(gg_rct______________004), 0.00 )
    ...
endfunction
```

- 注册：`TriggerRegisterAnyUnitEventBJ(gg_trg____________________002, EVENT_PLAYER_UNIT_DEATH)`。
- 该地图 `war3map.j` 中**没有任何** `PLAYER_STATE_RESOURCE_FOOD_CAP` / 食物上限设置（已 grep 全文件 `SetPlayerState`，只有黄金/木材/胜利条件）。

### 2.2 引擎侧链路

1. 死亡事件：[world.ts](file:///Users/huangyu/魔兽/开源魔兽争霸/src/sim/world.ts) `killUnit` 在 `units.delete` 之后写 `deathEvents`（第 25834 行），`eventInfo` 用 `jassOwnerOf`（中立被动→15，中立敌对→12，否则 `u.owner`）。
2. 事件泵：[interpreter.ts](file:///Users/huangyu/魔兽/开源魔兽争霸/src/jass/interpreter.ts) `pumpUnitDeaths`（1292 行）按 `EVENT_PLAYER_UNIT_DEATH` + `d.victim.owner` 匹配注册。
3. 死亡单位已不在 `sim.units`，但 `IsUnitType` 的 native 会把句柄的 `typeId` 一起传给 `hooks.isUnitType`（[world.ts](file:///Users/huangyu/魔兽/开源魔兽争霸/src/jass/natives/world.ts#L564-L567)），`rosterHooks.isUnitType` 回落到 `deadTypeIs`（[jassHooks.ts](file:///Users/huangyu/魔兽/开源魔兽争霸/src/game/jassHooks.ts#L579-L594)）→ **条件 1（是英雄）在引擎里应当成立**。
4. 线程模型：`JassThread.stack` 保留事件响应帧，`TriggerSleepAction` 之后 `GetDyingUnit()` 仍可读（见 interpreter.ts 的注释），所以 15 秒后句柄仍然有效。
5. `ReviveHeroLoc`：[abilities.ts](file:///Users/huangyu/魔兽/开源魔兽争霸/src/jass/natives/abilities.ts#L153-L165) → `hooks.reviveHero(u.simId, x, y, eyeCandy)`。
6. `reviveHeroByScript`：[rts.ts](file:///Users/huangyu/魔兽/开源魔兽争霸/src/game/rts.ts#L2704-L2727)，三个前置条件：
   - `this.sim.fallen.get(heroId)` 必须存在 → 由 `recordFallenHero` 写入（[world.ts](file:///Users/huangyu/魔兽/开源魔兽争霸/src/sim/world.ts#L5711-L5728)），其守卫为
     `if (u.owner < 0 || u.isCreep || u.neutralPassive || u.isIllusion) return;`
   - `this.foodRefusal(f.owner, def.foodUsed) !== ""` 直接 `return false`（**与 2.1 的「地图从不下发食物上限」直接冲突，是最强嫌疑**）。
   - `addSimUnit(def, x, y, facing, f.owner, f.team, 0, heroId)` 必须真的用 `heroId` 落地，否则随后 `sim.reviveFallenHero(heroId, heroId, "altar", eyeCandy)` 找不到单位而返回 false。
7. 复活的模型/渲染体走 `this.scriptSpawns.push({ …, simId: heroId })`。
8. 选中的英雄来自 `seedNeutral`（中立被动预置），`SetUnitOwner` 后由 [world.ts](file:///Users/huangyu/魔兽/开源魔兽争霸/src/sim/world.ts#L19933-L19945) `changeUnitOwner` 清掉 `neutralPassive`。

## 3. 目标

- 英雄阵亡 → 15 秒后在同一台机器上被地图脚本复活，镜头跟到 `gg_rct______________004` 中心，玩家能看到英雄站在那里。
- 不改动其它地图/melee 的复活语义（祭坛、酒馆、`ReviveHero` 的既有测试必须继续通过）。
- 本地验证；不部署。

## 4. 诊断协议（先取证，再改一处）

### D1. 临时插桩（三个点，`?dev` 下生效，诊断完成后全部删除）

1. `src/sim/world.ts` → `recordFallenHero` 入口：

```ts
console.warn("[rvdbg] recordFallenHero", { id: u.id, typeId: u.typeId, owner: u.owner, isCreep: u.isCreep, neutralPassive: u.neutralPassive, isIllusion: u.isIllusion, isHero: u.isHero });
```

2. `src/jass/interpreter.ts` → `pumpUnitDeaths` 循环开头：

```ts
console.warn("[rvdbg] deathEvent", { victim: d.victim.id, typeId: d.victim.typeId, owner: d.victim.owner, regs: this.rt.triggerRegs.length });
```

3. `src/game/rts.ts` → `reviveHeroByScript` 入口与出口：

```ts
const f0 = this.sim.fallen.get(heroId);
console.warn("[rvdbg] revive enter", { heroId, fallen: !!f0, typeId: f0?.typeId, owner: f0?.owner, food: f0 ? this.foodRefusal(f0.owner, this.registry.get(f0.typeId)?.foodUsed ?? 0) : "n/a", hasUnit: this.sim.units.has(heroId) });
```

并在 `return false` 的三处之前打印对应原因，在成功路径打印 `addSimUnit` 之后 `this.sim.units.get(heroId)` 是否存在。

### D2. 复现步骤

1. `pnpm dev` → `http://localhost:5173/?dev&map=神界危机-幻世隐藏英雄版`。
2. 选一个英雄 → 让它被打死（或 dev 下用已有的作弊/脚本把它打死）。
3. 采集控制台 `[rvdbg]` 三组日志，等满 15 秒再采一次（`revive enter` 应出现在提示之后）。
4. **同时向用户确认一个二选一事实**：屏幕上有没有出现红字「已经阵亡，15秒后自动复活！」。有 → 触发器跑了，问题在引擎复活；没有 → 触发器条件或事件没跑。

### D3. 判定表（观察值 → 唯一结论 → 唯一改法）

| 观察 | 结论 | 改法（只改这一处） |
| --- | --- | --- |
| 没有 `deathEvent` 日志，或 `regs` 里 `playerUnitEvent/20` 匹配不到 | 死亡事件没派发到脚本 | 修 `captureDeaths` / `syncEventCaptures` 或 `playerUnitEventMatches` |
| 有 `deathEvent`，但**没有**任何 `recordFallenHero` 日志 | `recordFallenHero` 被守卫拦掉（`isCreep` 或 `neutralPassive` 残留） | 把守卫改成「玩家拥有的英雄一律入册」：`if (u.owner < 0 \|\| u.isIllusion \|\| u.neutralPassive) return;` 中，`neutralPassive` 只在 `jassOwnerOf(u) === 15` 时生效；`isCreep` 对 `isHero` 不生效 |
| 有 `recordFallenHero`，但 `revive enter` 里 `fallen: false` | id 不一致（fallen 的 key ≠ 句柄 `simId`） | 统一 `recordFallenHero`/`revive` 使用的 id（`u.id`），并在 `addSimUnit` 复用该 id |
| `food: "Nofood"` / `"Maxsupply"` | 食物门槛拒绝复活（地图从不下发食物） | `reviveHeroByScript` 第 2709 行改为：只有玩家确实有供给体系时才用食物门槛 —— `const food = this.authority.foodFor(f.owner); if (food.made > 0 && this.foodRefusal(f.owner, def.foodUsed) !== "") return false;`，并在注释里写明「地图给的是预置英雄、没有任何食物产出」 |
| `revive enter` 正常但 `addSimUnit` 之后 `units.get(heroId)` 为空，或 `reviveFallenHero` 返回 false | 强制 id 没落地 | 修 `addSimUnit` 的强制 id 路径（`placed` 预留 id 冲突时仍必须用传入 id） |
| 复活成功但坐标是 `(0, 0)` | `GetRectCenter` 的 rect 为空 | 在 `ReviveHeroLoc` 里对 `p == null` 时回落到英雄死亡坐标，而不是 `(0,0)` |
| 复活成功、坐标正确，但看不见 | 渲染体没挂上 | 检查 `scriptSpawns` 的消费端是否接受「同一 `simId` 第二次出生」 |

> 只应用判定表中命中的那一行；不做「顺手」重构。

## 5. 验证

- `npx tsc --noEmit -p tsconfig.json` 退出码 0。
- 相关既有测试保持通过：`node tools/sim-revive-test.cjs`、`node tools/sim-hero-attr-test.cjs`、`node tools/sim-custom-map-test.cjs`（如需数据先跑 `pnpm data:extract`）。
- dev 浏览器实测：选英雄 → 打死 → 看到「已经阵亡，15秒后自动复活！」→ 15 秒后英雄出现在 `gg_rct______________004` 中心、镜头跟随、血条/头像恢复。
- 删除 D1 的全部临时日志，再次 `tsc` 通过后交付。

## 6. 不做的事

- 不部署到服务器。
- 不改地图脚本、不改 `war3map.j`。
- 不改祭坛/酒馆复活的时间与花费规则。
