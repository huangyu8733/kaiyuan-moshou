# 规格：桌面启动页复刻官网首页（无下载区 + 地图直达安装目录）

> 适用对象：Electron 打包后的桌面程序（`isDesktopApp() === true`）。
> 浏览器版本保持现有载入闸门（`src/ui/gate.ts`）不变。

## 1. 目标

桌面程序启动后不再直接显示“选择游戏文件夹”的闸门，而是显示一个与官网首页同构的启动页：

1. 顶栏（Logo、区块导航、语言切换）；
2. Hero：游戏介绍 + **启动游戏** + **更换游戏目录** + 当前目录状态；
3. 地图区：从官网地图库读取已发布地图，**下载后直接写入当前游戏目录的 `Maps\Download\`**；
4. 页脚；
5. **不包含**任何“下载游戏本体”区块。

地图接口不可用时只降级地图区，不影响启动游戏。

## 2. 已确认事实（来自现有代码）

- 打包后 `electron/main.mjs` 起本地 http server 提供 `dist/`，并暴露 preload：
  - `window.ow3native.installPath()` → 记住的目录 `{ path, valid, present, version }`
  - `window.ow3native.pickInstall()` → 系统目录选择器，返回新路径（已写回 shell）
  - `window.ow3native.saveMap(name, bytes)` → 写入 `<install>\Maps\Download\<name>`（`electron/main.mjs` 的 `ow3:map-save`）
- `src/assets/nativeInstall.ts` 已封装 `rememberedInstall()`、`pickNativeInstall()`、`loadNativeInstall()`；
  `loadNativeInstall()` 返回 `PickedInstall`，可直接交给 `loadProfile()`。
- `src/ui/gate.ts` 的 mount 流程可复用：`requestPersistence()`（仅浏览器）→ `loadProfile(install, DEFAULT_PROFILE, onProgress)` → `onFilesLoaded(load)`。
- 官网数据库：`maps`（`status='published'`）、`map_translations`；查询函数 `listPublishedMaps(locale, limit)`、`getPublishedMap(slug, locale)` 已存在。
- 官网当前**没有**公开地图 API，只有 `app/api/admin/oss-sign`。
- 地图文件在 OSS，浏览器点击 `<a download>` 不需要 CORS；但 Electron 页面要 `fetch()` 取字节，必须有 CORS 或同源代理。
- 桌面样式 token 在 `src/style.css`（`--gold` `--ow3-gold` `--panel` 等），现有 `.launcher-*` 可参考但**不复用其 DOM**。
- 官网视觉参照：`web/app/(site)/[locale]/page.tsx`、`web/components/site/AppShell.tsx`、`web/components/site/MapCard.tsx`、`web/app/globals.css`。

## 3. 方案

### 3.1 官网新增公开地图 API（两个路由）

**A. `web/app/api/public/maps/route.ts`（新建）**

- `export const runtime = "nodejs"; export const dynamic = "force-dynamic";`
- `GET /api/public/maps?locale=zh&limit=12`
  - `locale` 缺省 `DEFAULT_LOCALE`；`limit` 可选，上限 60。
  - 调用 `listPublishedMaps(locale, limit)`。
  - 响应：
    ```json
    {
      "maps": [{
        "slug": "dota-683d",
        "name": "DotA v6.83d",
        "description": "……",
        "coverUrl": "https://oss/...",
        "fileSize": 1234567,
        "version": "1.0",
        "author": "…",
        "players": "5v5",
        "updatedAt": "2026-…",
        "fileName": "DotA v6.83d.w3x",
        "downloadUrl": "http://<请求 origin>/api/public/maps/dota-683d/file"
      }]
    }
    ```
  - `fileName`：取 `file_key` 最后一段，否则 `file_url` 的 pathname 最后一段；去非法字符；无 `.w3m/.w3x` 后缀时补 `.w3x`。
  - `downloadUrl` 用 `new URL(request.url).origin` 拼绝对地址（Electron 直接访问该服务器）。
- CORS：`Access-Control-Allow-Origin: *`、`Access-Control-Allow-Methods: GET, OPTIONS`、`Access-Control-Allow-Headers: Content-Type`；实现 `OPTIONS` 返回 204。
- 缓存：`Cache-Control: public, max-age=60`。

**B. `web/app/api/public/maps/[slug]/file/route.ts`（新建）**

- `GET /api/public/maps/<slug>/file`
- `getPublishedMap(slug, DEFAULT_LOCALE)`；不存在或无 `file_url` → 404。
- 服务端 `fetch(file_url)` 流式返回：
  - `Content-Type: application/octet-stream`
  - `Content-Disposition: attachment; filename="<fileName>"`
  - 同源 CORS 头（供 Electron `fetch` 读取字节）。
- 上游非 2xx → 502。

### 3.2 桌面启动页 `src/ui/home.ts`（新建）

导出：

```ts
export interface Home {
  dispose(): void;
}
export function mountHome(root: HTMLElement, onLoaded: (load: GateLoad) => void): Home;
```

DOM 结构与官网首页同构（类名前缀 `home-`）：

1. `.home`（`position: fixed; inset: 0; overflow: auto; pointer-events: auto; z-index: 6`）
2. `.home-shell`
   - `.home-topbar`：品牌 `public/brand-logo.png`；三项锚点导航（概览 / 游戏介绍 / 地图）；右侧复用 `createLanguagePicker()`。
   - `.home-body`
     - `.home-sidenav`：锚点列表（概览、地图库、关于），桌面端固定，窄屏隐藏。
     - `.home-main`
       - `section.home-hero`：背景 `public/media/game2.avif` + 渐变遮罩；内容：
         - kicker（版本号 `1.30.4` 或 `t("home.kicker")`）
         - `img.home-hero-logo` → `public/hero-logo.avif`
         - tagline / lede（`t("home.tagline")` / `t("home.lede")`）
         - `.home-actions`：
           - 主按钮「启动游戏」（`createGlueButton`，`hotkey: "P"`）
           - 次按钮「更换游戏目录」
         - `.home-install`：当前目录状态（`t("home.folder")` + 路径；无效时红字原因）
         - `.home-progress`：`createProgressBar`，装载时替换按钮
       - `section.home-section#maps`：标题「精选地图」+「查看全部」（`window.open(`${site}/${locale}/maps`)`）；`.home-map-grid` 卡片；空态/错误态。
       - `section.home-section#about`：简短的“关于 / 开源地址 / 许可”。
   - `.home-footer`。
3. 交互：
   - 挂载时 `rememberedInstall()` → 更新状态。
   - 「启动游戏」：
     - 无有效目录 → 先 `pickNativeInstall()`；
     - 有效 → `loadNativeInstall()` → 显示进度条 → `loadProfile(..., DEFAULT_PROFILE, p => bar.set(p ?? null))` → 600ms + rAF → `onLoaded(load)`。
     - 失败：红字 `t("home.loadFailed", { error })`，恢复按钮。
   - 「更换游戏目录」：`pickNativeInstall()` → 成功则刷新状态（并提示已切换）；失败提示。
   - 地图卡片「下载」：
     - 无有效目录 → 提示先选择目录；
     - `fetch(map.downloadUrl)`（带 `AbortController`），状态 下载中 → 调 `saveMapToDownload(fileName, bytes)` → 已保存；
     - 失败：卡片内显示 `t("home.mapFailed")`，可重试。
4. 站点地址：
   ```ts
   const SITE = (import.meta.env.VITE_OPENWAR3_SITE_URL as string | undefined)?.replace(/\/$/, "")
     ?? (import.meta.env.DEV ? "http://localhost:3000" : "");
   ```
   - 未配置（生产）时地图区显示 `t("home.mapsUnconfigured")`，不发起请求，不影响启动。
   - 语言参数：`currentLocale()` 以 `zh` 开头 → `zh`，否则 `en`。
5. `dispose()` 移除 DOM、`AbortController.abort()`。

### 3.3 `src/assets/nativeInstall.ts` 增补

新增导出：

```ts
/** 把下载好的地图写入当前安装的 Maps\Download\（旧 shell 无此能力）。 */
export async function saveMapToDownload(name: string, bytes: Uint8Array): Promise<void>;
```

内部取 `bridge()?.saveMap`，缺失时抛出可读错误。文件名校验复用 `src/assets/downloadedMaps.ts` 的 `safeMapName()`（`src/ui/home.ts` 调用）。

### 3.4 `src/main.ts` 接入

- 新增 `import { mountHome, type Home } from "./ui/home";`
- 新增模块级 `let home: Home | null = null;`
- `mountInstall()` 中同时 `home?.dispose(); home = null;`
- 启动分支：
  ```ts
  if (dev ?dev) { …现有… }
  else if (isDesktopApp()) {
    home = mountHome(ui, onFilesLoaded);
  } else {
    gate = mountLoadGate(ui, onFilesLoaded, { auto: false });
  }
  ```
- 不改动现有 gate 行为与版本规则（接受 1.x / 2.x）。

### 3.5 样式 `src/style.css`

新增 `/* --- Desktop home (launcher front page) --- */` 区块，前缀 `home-`：

- 复用官网比例：顶栏 52px；侧栏 220px；内容最大宽 1200px；hero 最小高 `calc(100svh - 52px)`；地图网格 `repeat(auto-fill, minmax(260px, 1fr))`。
- 颜色沿用 `--ow3-gold` / `--ow3-text` / `--ow3-text-dim` / 金色边框；面板使用现有 `createPanel` 的 `.ow3-panel` 样式。
- `@media (max-width: 860px)`：侧栏隐藏、hero 单列、地图网格单列。
- 在 `body.in-game` 隐藏规则中补 `.home`。

### 3.6 静态资源

从官网复制到桌面 `public/`（只复制，不改动源文件）：

- `web/public/brand-logo.png` → `public/brand-logo.png`
- `web/public/hero-logo.avif` → `public/hero-logo.avif`
- `web/public/media/game2.avif` → `public/media/game2.avif`（若源不存在则用现有 `.launcher-backdrop` 同款渐变作为兜底）

资源缺失时 CSS 必须有纯渐变兜底，不能出现白屏。

### 3.7 文案 `src/i18n/index.ts`

新增 key（中/英两套）：

- `home.kicker`、`home.tagline`、`home.lede`、`home.play`、`home.playBusy`
- `home.changeFolder`、`home.folder`、`home.folderNone`、`home.folderInvalid`
- `home.loadFailed`、`home.maps`、`home.mapsMore`、`home.mapsEmpty`、`home.mapsUnconfigured`、`home.mapsFailed`
- `home.download`、`home.downloading`、`home.downloaded`、`home.mapFailed`、`home.pickFirst`
- `home.about`、`home.aboutText`、`home.footer`

### 3.8 语言切换

复用 `createLanguagePicker()`；切换后重新拉取地图列表（按新 locale）。

## 4. 错误与降级

| 场景 | 表现 |
|------|------|
| 未记住目录 | 状态「尚未选择目录」，启动按钮点击后弹目录选择 |
| 记住目录已移动/版本不符 | 红字说明，启动按钮点击后重新选择 |
| 地图 API 网络失败/非 2xx | 地图区空态 + 重试按钮；启动不受影响 |
| 生产未配置站点地址 | 地图区提示未配置；启动不受影响 |
| 地图下载失败 | 卡片内红字 + 重试；已下载的其他地图不受影响 |
| 旧 shell 无 `saveMap` | 下载按钮提示需更新客户端 |
| 装载游戏失败 | 红字显示原因，恢复可用状态 |

## 5. 验收标准

1. `pnpm app`（或打包产物）启动后直接看到新启动页，布局与官网首页一致，**没有游戏下载区块**。
2. 点击「启动游戏」能进入主菜单；首次运行会弹目录选择。
3. 点击「更换游戏目录」能换目录，状态实时更新。
4. 地图区能列出已发布地图；点击下载后文件出现在 `<install>\Maps\Download\`，且下载状态可见。
5. 地图服务不可用时启动流程不受阻。
6. `npx tsc --noEmit`、`node tools/electron-server-test.mjs`、`pnpm build` 通过。
7. 浏览器访问 `/` 仍是原有载入闸门，行为不变。

## 6. 不在范围

- 不改动版本校验规则（仍接受 1.x / 2.x）。
- 不改动官网现有页面、后台、OSS 上传逻辑（只新增两个只读公开路由）。
- 不做游戏本体内下载。
- 不引入 React 到桌面端。
