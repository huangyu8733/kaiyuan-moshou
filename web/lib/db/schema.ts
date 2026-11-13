// SQLite schema for the site. Kept in TypeScript so both the app and the CLI scripts
// (run with Node's native TypeScript support) share one definition.

export const SCHEMA_VERSION = 3;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS locales (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS downloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  label TEXT,
  version TEXT,
  size INTEGER,
  format TEXT,
  url TEXT NOT NULL,
  oss_key TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_downloads_platform ON downloads(platform, enabled, sort);

CREATE TABLE IF NOT EXISTS maps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft',
  cover_url TEXT,
  cover_key TEXT,
  file_url TEXT,
  file_key TEXT,
  file_size INTEGER,
  version TEXT,
  author TEXT,
  players TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_maps_status_sort ON maps(status, sort);

CREATE TABLE IF NOT EXISTS map_translations (
  map_id INTEGER NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  locale TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (map_id, locale)
);
CREATE INDEX IF NOT EXISTS idx_map_translations_locale ON map_translations(locale);

INSERT OR IGNORE INTO locales (code, label, enabled, sort) VALUES
  ('zh', '简体中文', 1, 0),
  ('en', 'English', 1, 1);

INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
  ('contact', '{"email":"","qqGroup":"","wechat":"","github":"","discord":"","note":""}', datetime('now'));
`;

export interface MapRow {
  id: number;
  slug: string;
  status: "draft" | "published";
  cover_url: string | null;
  cover_key: string | null;
  file_url: string | null;
  file_key: string | null;
  file_size: number | null;
  version: string | null;
  author: string | null;
  players: string | null;
  category: string;
  sort: number;
  created_at: string;
  updated_at: string;
}

export interface MapWithText extends MapRow {
  name: string;
  description: string;
  /** 已填写名称或介绍的语言数量（管理后台的翻译进度）。 */
  translated_locales: number;
}

export interface MapTranslation {
  map_id: number;
  locale: string;
  name: string;
  description: string;
}

export interface DownloadRow {
  id: number;
  platform: string;
  label: string | null;
  version: string | null;
  size: number | null;
  format: string | null;
  url: string;
  oss_key: string | null;
  enabled: number;
  sort: number;
  updated_at: string;
}

export interface LocaleRow {
  code: string;
  label: string;
  enabled: number;
  sort: number;
}

export interface ContactInfo {
  email: string;
  qqGroup: string;
  wechat: string;
  github: string;
  discord: string;
  note: string;
}
