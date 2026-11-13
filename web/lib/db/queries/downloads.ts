import { getDb } from "../index";
import type { DownloadRow } from "../schema";

export function listDownloads(includeDisabled = false): DownloadRow[] {
  const where = includeDisabled ? "" : "WHERE enabled = 1";
  return getDb()
    .prepare(`SELECT * FROM downloads ${where} ORDER BY sort ASC, id ASC`)
    .all() as unknown as DownloadRow[];
}

/** The enabled link for a platform. `os` is the route's platform code. */
export function getEnabledDownload(platform: string): DownloadRow | null {
  const row = getDb()
    .prepare("SELECT * FROM downloads WHERE platform = ? AND enabled = 1 ORDER BY sort ASC, id ASC LIMIT 1")
    .get(platform);
  return (row as unknown as DownloadRow) ?? null;
}

export function getDownloadById(id: number): DownloadRow | null {
  const row = getDb().prepare("SELECT * FROM downloads WHERE id = ?").get(id);
  return (row as unknown as DownloadRow) ?? null;
}
