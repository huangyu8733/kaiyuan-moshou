"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { getDb, nowIso } from "@/lib/db";
import { getDownloadById } from "@/lib/db/queries/downloads";
import { deleteObject } from "@/lib/oss";
import { checkbox, integer, isHttpUrl, text } from "./util";
import { redirect } from "next/navigation";

function back(kind: "ok" | "error", code: string): never {
  redirect(`/admin/downloads?${kind}=${encodeURIComponent(code)}`);
}

export async function saveDownloadAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = integer(formData, "id");
  const platform = text(formData, "platform", 20);
  const label = text(formData, "label", 60);
  const version = text(formData, "version", 40);
  const format = text(formData, "format", 40);
  const size = integer(formData, "size");
  const url = text(formData, "url", 2000);
  const sort = integer(formData, "sort");
  const enabled = checkbox(formData, "enabled") ? 1 : 0;

  if (!["windows", "linux", "macos", "android", "harmony", "other"].includes(platform)) back("error", "platform");
  if (!isHttpUrl(url)) back("error", "url");

  const db = getDb();
  if (id > 0) {
    db.prepare(
      `UPDATE downloads SET platform=?, label=?, version=?, size=?, format=?, url=?, enabled=?, sort=?, updated_at=? WHERE id=?`,
    ).run(platform, label || null, version || null, size, format || null, url, enabled, sort, nowIso(), id);
  } else {
    db.prepare(
      `INSERT INTO downloads (platform, label, version, size, format, url, enabled, sort, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(platform, label || null, version || null, size, format || null, url, enabled, sort, nowIso());
  }

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
