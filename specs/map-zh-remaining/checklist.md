# 检查清单：地图内残留英文/葡文清理

- [x] `npx tsc --noEmit` 无错误。
- [x] 生成器报告：`units` 未译项中仅 `H00Y Preloader Hero`（加载占位）这一个英雄形态代码，真实英雄英文名 0；`items` 剩 23 条全部为内部调试物品（`Lycan Damage *`、`Freeze Hero`、`Version Check` 等）。
- [x] `src/world/mapInfo.ts` 的 `resolveName` 解析 `TRIGSTR_<id>` 时优先取侧车 wts（`mapWtsString`，`live()` 仅在 zhCN 生效），再退回地图自身 wts。
- [x] `src/main.ts` 在 `setMapLanguage` 之后重解析 `parseMapInfo`，加载画面文案取自中文侧车。
- [x] 实测加载画面**由引擎绘制的文本**为中文（`按下任意键以继续`、地图名）；图中 `COMANDOS`／`Bugs e sugestões`／`VERSÃO 6.90G` 等葡文确认烘焙在 `LoadingScreen{TL,TR,BL,BR}.blp` 四张美术图里，w3i 的 `loadingScreenTitle/Subtitle/Text` 为空，文本层无内容可覆盖——记为地图美术限制（非目标）。
- [x] 实测英雄选择列表为中文职业名（实测截图：炼金术士、钢背兽、干扰者、大地之灵等；生成器侧仅剩 `Preloader Hero` 占位）。
- [x] 实测英雄选择/悬停/选中面板不再出现英文专有名（实测底部面板为「地精工程师」而非 `Goblin Techies` 专有名）；复活按钮改为 `复活 <中文名>`（`hud.revive`）。
- [x] 实测商店 hover 物品名为中文（「诡计之雾」；列表中另有「艾西菲的远古祭祀」「分身斧」「岗哨守卫」）。
- [x] 实测开局提示为中文（「Player 1 默认选择了普通模式。选择英雄后将返还 175 金币。」）。
- [x] 观察者面板 `REPLAY_CAMERA` 已由 `src/i18n/fdfStrings.ts` 的 zhCN 词表映射为「自动视角」，`mapViewer` 载入 GlobalStrings 后调用 `localizeGlobalStrings`（代码路径核对）。
- [x] 英文界面（`?lang=enUS`）行为不变：`live()`／`displayHeroName`／`localizeGlobalStrings` 均以 `currentLocale() === "zhCN"` 为前提，enUS 不进入覆盖。
