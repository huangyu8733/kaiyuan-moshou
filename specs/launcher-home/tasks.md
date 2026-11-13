# 任务：桌面启动页复刻官网首页

> 规格：[spec.md](file:///Users/huangyu/魔兽/开源魔兽争霸/specs/launcher-home/spec.md)
> 完成一项手动勾选一项；每项后附验证方式。

## 任务列表

- [ ] **T1 官网公开地图 API（列表）**
  - 新建 `web/app/api/public/maps/route.ts`
  - `GET`：`locale`（默认 `DEFAULT_LOCALE`）、`limit`（≤60）；调用 `listPublishedMaps`
  - 返回 `{ maps: [...] }`，字段含 `slug/name/description/coverUrl/fileSize/version/author/players/updatedAt/fileName/downloadUrl`
  - `OPTIONS` 204 + CORS；`Cache-Control: public, max-age=60`
  - 验证：`curl 'http://localhost:3000/api/public/maps?locale=zh&limit=6'` 返回 JSON 且无 500

- [ ] **T2 官网公开地图 API（文件代理）**
  - 新建 `web/app/api/public/maps/[slug]/file/route.ts`
  - `getPublishedMap` 校验；服务端 `fetch(file_url)` 流式返回
  - `Content-Disposition: attachment; filename="<fileName>"` + CORS
  - 验证：`curl -i 'http://localhost:3000/api/public/maps/<slug>/file'` 返回 200/octet-stream（或 502 说明上游不可达）

- [ ] **T3 原生保存助手**
  - 修改 `src/assets/nativeInstall.ts`：新增 `saveMapToDownload(name, bytes)`
  - 缺失桥接时抛出可读错误
  - 验证：`npx tsc --noEmit` 通过

- [ ] **T4 启动页组件**
  - 新建 `src/ui/home.ts`：`mountHome(root, onLoaded)`
  - 顶栏 + 侧栏 + Hero（介绍 / 启动 / 更换目录 / 状态 / 进度）+ 地图区 + 关于 + 页脚
  - 复用 `rememberedInstall` / `pickNativeInstall` / `loadNativeInstall` / `loadProfile`
  - 地图下载：`fetch(downloadUrl)` → `saveMapToDownload`
  - API 失败、未配置站点地址均降级
  - 验证：`npx tsc --noEmit`

- [ ] **T5 接入启动流程**
  - 修改 `src/main.ts`：桌面端挂 `mountHome`，浏览器仍 `mountLoadGate`
  - `mountInstall()` 释放 home
  - 验证：`pnpm app` 桌面端出现新启动页；浏览器 `/` 仍是载入闸门

- [ ] **T6 样式**
  - 修改 `src/style.css`：新增 `.home-*`（顶栏 52px、侧栏 220px、内容 1200px、hero 满屏、地图网格、响应式）
  - `body.in-game` 隐藏 `.home`
  - 验证：窄窗口（<860px）侧栏隐藏、地图单列；无横向滚动

- [ ] **T7 静态资源**
  - 复制 `web/public/brand-logo.png`、`web/public/hero-logo.avif`、`web/public/media/game2.avif` 到 `public/`
  - CSS 提供渐变兜底
  - 验证：启动页 Logo 与背景可见

- [ ] **T8 文案**
  - 修改 `src/i18n/index.ts`：补齐 `home.*` 中英文 key
  - 验证：中/英切换后文案完整，无裸 key

- [ ] **T9 整体验证**
  - `npx tsc --noEmit`
  - `node tools/electron-server-test.mjs`
  - `pnpm build`
  - `cd web && npx tsc --noEmit`
  - 手测：启动游戏、更换目录、地图下载到 `Maps\Download\`、断网降级
