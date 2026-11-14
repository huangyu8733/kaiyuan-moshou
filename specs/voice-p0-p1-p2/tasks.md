# 任务清单：语音命令 P0 / P1 / P2

执行顺序固定：P0 全部完成并验证部署后，才进入 P1；P1 完成并验证部署后，才进入 P2。

## P0

- [x] P0-1 商店买 / 卖：parser 新增 buy/sell intent 与中英文命令词；voiceActions 找可用商店；mapViewer driver 增加 buyItem/sellInventory；i18n、hints、parser 测试。
- [x] P0-1 验证：`npx tsc --noEmit && npx tsc -p tools/tsconfig.sim.json && node tools/voice-parser-test.cjs && node tools/voice-test.cjs`。
- [x] P0-2 英雄复活：parser 新增 revive；voiceActions 从 fallen + 己方祭坛/酒馆发 `{c:"revive"}`；补测试。
- [x] P0-3 运输装载 / 卸载：parser 新增 board/unload；voiceActions 右键装载、`unload` 命令；补测试。
- [x] P0-4 修理 / 自动修理：parser 新增 repair/autorepair；voiceActions 发 `{c:"repair"}` 并维护自动修理定时器；补测试。
- [x] P0-5 屏幕内全选：parser select screen；VoiceDriver.selectScreen → `r.selectBox(0,0,w,h,false)`；补测试。
- [x] P0 验证（同 P0-1 命令）。
- [x] P0 部署 `/play/`（pnpm build:web → tar → scp → 服务器替换 play → curl 验证），不生成更新包。

## P1

- [x] P1-1 结盟 / 共享视野 / 共享控制（diplomacy intent + commands）。
- [x] P1-2 地图信号（ping intent + VoiceDriver.pingAt）。
- [x] P1-3 真正的命令队列（order.queued）。
- [x] P1-4 单个单位移出编队（ungroupone + 控制组读写接口）。
- [x] P1 验证（类型检查 + 语音测试）。
- [x] P1 部署 `/play/`，不生成更新包。

## P2

- [x] P2-1 子组选择。
- [x] P2-2 下一个空闲农民。
- [x] P2-3 按类型集火。
- [x] P2-4 物品栏换位。
- [x] P2 验证（类型检查 + 语音测试）。
- [x] P2 部署 `/play/`，不生成更新包。

## 约束

- 不生成 `web-1.0.x.zip`，不改 `latest.json`。
- 每批失败即停在该批修复，不带病进入下一批。
- 新代码注释使用中文。
