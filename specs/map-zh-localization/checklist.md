# 验收清单：地图汉化（同级 `.zhCN.json`）

- [x] 同级 `.zhCN.json` 在三条通路都进入安装文件表：浏览器目录选择（`opfs.ts`）、dev manifest、
  electron manifest。
- [x] 语言文件不会出现在地图列表里（`installMaps` 只收 `.w3m/.w3x`，`installLooseFiles` 另走
  VFS 松散层）。
- [x] CASC 与 MPQ 两种安装都能经 VFS 读到同级语言文件（MPQ 仅在确有 sidecar 时加松散层）。
- [x] 四层文本覆盖按规格实现：地图名/简介、wts（按 id 再按原文）、屏幕播报（整行→最长片段）、
  对象字段（按等级对齐，空串保留原值）。
- [x] 英文界面下完全 no-op；切换地图时对象字段被还原，词表不会串图。
- [x] `tools/map-lang-test.cjs` 全部断言通过；`tsc --noEmit` 通过；`import-cycle-test` 无新增环。
- [x] 实机：`?dev&map=DotA v6.83d` 与 `?dev&map=DotA AI v6.90G` 均加载各自语言文件
  （677 / 1818 条 text），且互不串。
- [x] 英雄名：两图 70/71 个英雄经 `objects.units` 覆盖后显示中文（dev 生成列表实测通过）。
- [x] 全量盘点：官方中文表（按 rawcode）+ 物品/播报词典接入后，商店物品 6.83d 993/1025
  （96.9%）、6.90G 1104/1172（94.2%）中文；常规商店物品无遗留英文（浏览器 dev 列表实测
  682/712，余下均为调试物品）。6.90G 的 AI 菜单与神符名已中文。技能名/说明仍是主要英文来源
  （DotA 自建 A0xx，约 2,800 个），需人工词表，见 tasks.md T17。
