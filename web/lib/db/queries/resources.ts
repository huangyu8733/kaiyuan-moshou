import { getDb } from "../index";
import type { ResourceRow } from "../schema";

/** 资料下载条目：平台名称 + 链接（或 OSS 文件）+ 可选提取码。 */
export function listResources(includeDisabled = false): ResourceRow[] {
  const where = includeDisabled ? "" : "WHERE enabled = 1";
  return getDb()
    .prepare(`SELECT * FROM resources ${where} ORDER BY sort ASC, id ASC`)
    .all() as unknown as ResourceRow[];
}

export function getResourceById(id: number): ResourceRow | null {
  const row = getDb().prepare("SELECT * FROM resources WHERE id = ?").get(id);
  return (row as unknown as ResourceRow) ?? null;
}
