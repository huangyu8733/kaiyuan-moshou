"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb, nowIso } from "@/lib/db";
import { getResourceById } from "@/lib/db/queries/resources";
import { deleteObject } from "@/lib/oss";
import { checkbox, integer, isHttpUrl, text } from "./util";

function back(kind: "ok" | "error", code: string): never {
  redirect(`/admin/resources?${kind}=${encodeURIComponent(code)}`);
}

/** 资料下载条目：外部链接（可带提取码），或直接上传到 OSS 的文件。
 *  `file_url` 由上传组件写入；链接为空时使用上传的文件。 */
export async function saveResourceAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = integer(formData, "id");
  const name = text(formData, "name", 80);
  const url = text(formData, "url", 2000);
  const code = text(formData, "code", 40);
  const fileUrl = text(formData, "file_url", 2000);
  const fileKey = text(formData, "file_key", 500);
  const sort = integer(formData, "sort");
  const enabled = checkbox(formData, "enabled") ? 1 : 0;

  if (!name) back("error", "name");

  const previous = id > 0 ? getResourceById(id) : null;
  const useFile = !url && Boolean(fileKey);

  let finalUrl = url;
  let ossKey: string | null = null;
  if (useFile) {
    finalUrl = fileUrl;
    ossKey = fileKey;
    if (!finalUrl) back("error", "file-missing");
  } else {
    if (!isHttpUrl(url)) back("error", "url");
  }

  const db = getDb();
  if (id > 0) {
    db.prepare(
      `UPDATE resources SET name=?, url=?, code=?, oss_key=?, enabled=?, sort=?, updated_at=? WHERE id=?`,
    ).run(name, finalUrl, code || null, ossKey, enabled, sort, nowIso(), id);
  } else {
    db.prepare(
      `INSERT INTO resources (name, url, code, oss_key, enabled, sort, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(name, finalUrl, code || null, ossKey, enabled, sort, nowIso());
  }

  // 换成了外部链接或另一个文件时，清掉不再被引用的旧对象。
  if (previous?.oss_key && previous.oss_key !== ossKey) await deleteObject(previous.oss_key);

  back("ok", id > 0 ? "updated" : "created");
}

export async function deleteResourceAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = integer(formData, "id");
  const row = getResourceById(id);
  if (row) {
    getDb().prepare("DELETE FROM resources WHERE id = ?").run(id);
    await deleteObject(row.oss_key);
  }
  back("ok", "deleted");
}
