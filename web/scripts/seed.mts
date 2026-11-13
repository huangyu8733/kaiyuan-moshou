import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getDb, nowIso } from "../lib/db/index.ts";

// 幂等 seed：
// 1) 最新 GitHub Release 的三个桌面安装包 → downloads（已有同平台记录时跳过）；
// 2) 仓库内 Warcraft III zhCN/Maps/hhkj/*.w3x.zhCN.json 的 name/description → 地图草稿。
const ROOT = join(import.meta.dirname, "..", "..");
const REPO = "elevchyt/warcraft-open";
const db = getDb();

const headers: Record<string, string> = {
  Accept: "application/vnd.github+json",
  "User-Agent": "warcraft-open-web-seed",
};
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

interface Asset {
  name: string;
  size: number;
  browser_download_url: string;
}

async function seedDownloads(): Promise<void> {
  let release: { tag_name: string; assets: Asset[] } | null = null;
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers });
    if (response.ok) release = (await response.json()) as { tag_name: string; assets: Asset[] };
  } catch {
    release = null;
  }
  if (!release) {
    console.log("[seed] GitHub 不可达，跳过下载地址 seed");
    return;
  }

  const matchers: Array<[string, RegExp, string]> = [
    ["linux", /\.AppImage$/i, "AppImage"],
    ["windows", /\.exe$/i, "Installer"],
    ["macos", /\.dmg$/i, "DMG"],
  ];
  const exists = db.prepare("SELECT COUNT(*) AS n FROM downloads WHERE platform = ?");
  const insert = db.prepare(
    `INSERT INTO downloads (platform, version, size, format, url, enabled, sort, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
  );

  matchers.forEach(([platform, pattern, format], index) => {
    const asset = release!.assets.find((item) => pattern.test(item.name));
    if (!asset) return;
    const count = (exists.get(platform) as { n: number }).n;
    if (count > 0) return;
    insert.run(platform, release!.tag_name, asset.size, format, asset.browser_download_url, index, nowIso());
    console.log(`[seed] download ${platform} ${release!.tag_name}`);
  });
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

interface Sidecar {
  info?: { name?: string; description?: string; recommendedPlayers?: string };
}

function seedMaps(): void {
  const folder = join(ROOT, "Warcraft III zhCN", "Maps", "hhkj");
  let files: string[];
  try {
    files = readdirSync(folder).filter((file) => file.toLowerCase().endsWith(".zhcn.json"));
  } catch {
    console.log("[seed] 未找到本地地图目录，跳过地图 seed");
    return;
  }

  const exists = db.prepare("SELECT id FROM maps WHERE slug = ?");
  const insertMap = db.prepare(
    `INSERT INTO maps (slug, status, players, sort, created_at, updated_at) VALUES (?, 'published', ?, ?, ?, ?)`,
  );
  const insertText = db.prepare(
    `INSERT INTO map_translations (map_id, locale, name, description) VALUES (?, 'zh', ?, ?)
     ON CONFLICT(map_id, locale) DO UPDATE SET name=excluded.name, description=excluded.description`,
  );

  files.forEach((file, index) => {
    const stem = file.replace(/\.w3x\.zhcn\.json$/i, "");
    const slug = slugify(stem);
    if (!slug || exists.get(slug)) return;

    let sidecar: Sidecar = {};
    try {
      sidecar = JSON.parse(readFileSync(join(folder, file), "utf8")) as Sidecar;
    } catch {
      return;
    }
    const name = sidecar.info?.name?.trim() || stem;
    const description = sidecar.info?.description?.trim() || "";
    const players = sidecar.info?.recommendedPlayers?.trim() || null;
    const stamp = nowIso();
    const result = insertMap.run(slug, players, index, stamp, stamp);
    insertText.run(Number(result.lastInsertRowid), name, description);
    console.log(`[seed] map ${slug}`);
  });
}

await seedDownloads();
seedMaps();
db.close();
