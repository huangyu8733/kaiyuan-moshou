# 魔兽争霸开源版 官网与地图后台

`web/` 是官网（Next.js 16 App Router + React 19），同时提供：

- 响应式「软件界面」首页：游戏介绍、平台下载、精选地图、联系信息
- 地图库：`/[locale]/maps`、地图详情与 OSS 下载
- 管理后台：`/admin`，维护游戏下载地址、联系信息、地图与多语言介绍
- SQLite 存储（Node 内置 `node:sqlite`），阿里云 OSS 预签名直传
- 中英文双语，新增语言只需加词典与注册表条目

## 环境要求

- Node.js **≥ 24**（使用 `node:sqlite`）
- npm（本目录不再使用 pnpm）

## 本地运行

```bash
cd web
npm install
cp .env.example .env.local     # 首次；填写 ADMIN_PASSWORD / ADMIN_SECRET
npm run db:migrate             # 建表
npm run db:seed                # 可选：从 GitHub Release 与本地 .zhCN.json 导入种子数据
npm run dev                    # http://localhost:3000 → 自动跳转 /zh
```

管理后台：<http://localhost:3000/admin>，密码是 `.env.local` 里的 `ADMIN_PASSWORD`。

## 环境变量

| 变量 | 说明 |
|---|---|
| `DATABASE_PATH` | SQLite 文件路径，默认 `./data/openwar3.sqlite`（相对 `web/`） |
| `ADMIN_PASSWORD` | 后台登录密码 |
| `ADMIN_SECRET` | 会话签名密钥，生产环境必须设置 32 位以上随机串 |
| `OSS_REGION` / `OSS_BUCKET` | 阿里云 OSS 区域与 Bucket |
| `OSS_ENDPOINT` | 可选，自定义 endpoint |
| `OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET` | OSS 密钥，只在服务端使用 |
| `OSS_PUBLIC_BASE_URL` | OSS 公网访问前缀，例如 `https://bucket.oss-cn-hangzhou.aliyuncs.com` |
| `OSS_KEY_PREFIX` | 对象 key 前缀，默认 `openwar3/` |
| `NEXT_PUBLIC_SITE_URL` | 站点正式地址（canonical / sitemap） |
| `GITHUB_TOKEN` | 可选，提高 GitHub API 限额 |

OSS Bucket 需要配置 CORS：允许站点域名 `PUT`，并允许 `Content-Type` 请求头。封面上传限制 16 MB，地图文件限制 512 MB；文件由浏览器直传 OSS，不经过 Node 进程。

## 多语言

- 默认中文，前台路径为 `/zh/...`、`/en/...`；`proxy.ts` 负责补前缀与回落。
- 文案词典：`i18n/dictionaries/zh.ts`（基准类型）、`en.ts`。
- **新增语言（10+ 种也只需两步）**：新建 `i18n/dictionaries/<code>.ts`（可以先只翻译一部分，缺失文案自动回退中文），在 `i18n/config.ts` 的 `LOCALES` 加一行（含词典加载器），然后到后台「语言」页启用。语言条目会自动出现在地图编辑页。
- **批量翻译地图**：地图编辑页顶部有「批量导入 / 导出 JSON」，可把全部语言的名称与介绍交给翻译或表格工具处理，再整包导入；支持搜索语言、只看未填写、从默认语言复制。
- 语言超过 4 种时，前台切换器自动收进下拉框；后台地图列表显示每张地图的「翻译进度」。

## 生产部署

```bash
cd web
npm ci
npm run db:migrate
npm run build
npm start                      # 默认 3000 端口，可用 PORT 覆盖
```

- 使用 nginx/Caddy 反向代理并启用 HTTPS。
- 保持**单实例**运行（SQLite 写入不适合多进程/多副本），并定期备份 `data/openwar3.sqlite`。
- `data/` 必须位于持久化磁盘；构建机不需要数据库文件（页面按请求渲染）。

## 目录速览

```
app/(site)/[locale]/     前台：首页、下载、地图列表与详情、联系
app/admin/               后台：登录与受保护的管理页
app/api/admin/oss-sign/  OSS 预签名接口
lib/db/                  SQLite 连接、schema 与查询
lib/actions/             Server Actions（CRUD）
lib/auth/                后台会话与限流
lib/oss.ts               阿里云 OSS 封装
scripts/migrate.mts      建表
scripts/seed.mts         幂等种子数据
```
