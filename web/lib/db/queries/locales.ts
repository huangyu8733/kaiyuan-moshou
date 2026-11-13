import { getDb } from "../index";
import type { LocaleRow } from "../schema";

export function listLocales(): LocaleRow[] {
  const rows = getDb().prepare("SELECT * FROM locales ORDER BY sort ASC, code ASC").all();
  return rows.map((row) => ({ ...row })) as unknown as LocaleRow[];
}

export function listEnabledLocales(): LocaleRow[] {
  return getDb()
    .prepare("SELECT * FROM locales WHERE enabled = 1 ORDER BY sort ASC, code ASC")
    .all() as unknown as LocaleRow[];
}

/** 注册表里新增语言后，保证数据库里有一行（默认不启用），地图编辑页才能立刻出现该语言。 */
export function ensureLocaleRows(seeds: Array<{ code: string; label: string }>): void {
  const insert = getDb().prepare("INSERT OR IGNORE INTO locales (code, label, enabled, sort) VALUES (?, ?, 0, ?)");
  seeds.forEach((seed, index) => insert.run(seed.code, seed.label, 100 + index));
}
