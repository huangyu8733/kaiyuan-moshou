"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { getDb, nowIso } from "@/lib/db";
import { getDownloadById } from "@/lib/db/queries/downloads";
import { deleteObject, publicUrl } from "@/lib/oss";
import { checkbox, integer, isHttpUrl, text } from "./util";
import { redirect } from "next/navigation";

function back(kind: "ok" | "error", code: string): never {
  redirect(`/admin/downloads?${kind}=${encodeURIComponent(code)}`);
}

/** 两种来源：外部下载链接（mode=url），或浏览器直传 OSS 的安装包（mode=upload，
 *  文件由 UploadField 上传并写回 file_url / file_key）。 */
export async function saveDownloadAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = integer(formData, "id");
  const platform = text(formData, "platform", 20);
  const label = text(formData, "label", 60);
  const version = text(formData, "version", 40);
  const format = text(formData, "format", 40);
  const size = integer(formData, "size");
  const mode = text(formData, "mode", 10) === "upload" ? "upload" : "url";
  const inputUrl = text(formData, "url", 2000);
  const fileUrl = text(formData, "file_url", 2000);
  const fileKey = text(formData, "file_key", 500);
  const fileSize = integer(formData, "file_size");
  const sort = integer(formData, "sort");
  const enabled = checkbox(formData, "enabled") ? 1 : 0;

  if (!["windows", "linux", "macos", "android", "harmony", "other"].includes(platform)) back("error", "platform");

  let url = inputUrl;
  let ossKey: string | null = null;
  let finalSize = size;
  if (mode === "upload") {
    if (!fileKey) back("error", "file-missing");
    url = fileUrl || publicUrl(fileKey);
    ossKey = fileKey;
    if (fileSize > 0) finalSize = fileSize;
  } else if (!isHttpUrl(url)) {
    back("error", "url");
  }

  const previous = id > 0 ? getDownloadById(id) : null;
  const db = getDb();
  if (id > 0) {
    db.prepare(
      `UPDATE downloads SET platform=?, label=?, version=?, size=?, format=?, url=?, oss_key=?, enabled=?, sort=?, updated_at=? WHERE id=?`,
    ).run(platform, label || null, version || null, finalSize, format || null, url, ossKey, enabled, sort, nowIso(), id);
  } else {
    db.prepare(
      `INSERT INTO downloads (platform, label, version, size, format, url, oss_key, enabled, sort, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(platform, label || null, version || null, finalSize, format || null, url, ossKey, enabled, sort, nowIso());
  }

  // 换成了别的链接或另一个安装包时，清掉不再被引用的旧对象。
  if (previous?.oss_key && previous.oss_key !== ossKey) await deleteObject(previous.oss_key);

  back("ok", id > 0 ? "updated" : "created");
}

export async function deleteDownloadAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = integer(formData, "id");
  const row = getDownloadById(id);
  if (row) {
    getDb().prepare("DELETE FROM downloads WHERE id = ?").run(id);
    await deleteObject(row.oss_key);
  }
  back("ok", "deleted");
}
