"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb, nowIso } from "@/lib/db";
import { getMapById } from "@/lib/db/queries/maps";
import { normalizeCategory } from "@/lib/mapCategories";
import { deleteObject, headObject, ossConfigured } from "@/lib/oss";
import { checkbox, integer, isHttpUrl, text } from "./util";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function back(kind: "ok" | "error", code: string): never {
  redirect(`/admin/maps?${kind}=${encodeURIComponent(code)}`);
}

function optionalUrl(formData: FormData, key: string): string | null {
  const value = text(formData, key, 2000);
  return value && isHttpUrl(value) ? value : null;
}

export async function saveMapAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = integer(formData, "id");
  const slug = text(formData, "slug", 80).toLowerCase();
  const status = checkbox(formData, "published") ? "published" : "draft";
  const coverUrl = optionalUrl(formData, "cover_url");
  const coverKey = text(formData, "cover_key", 500) || null;
  const fileUrl = optionalUrl(formData, "file_url");
  const fileKey = text(formData, "file_key", 500) || null;
  let fileSize = integer(formData, "file_size");
  const version = text(formData, "version", 40) || null;
  const author = text(formData, "author", 80) || null;
  const players = text(formData, "players", 40) || null;
  const category = normalizeCategory(text(formData, "category", 40));
  const sort = integer(formData, "sort");

  if (!SLUG.test(slug)) back("error", "slug");
  if (fileKey && ossConfigured()) {
    const head = await headObject(fileKey);
    if (!head) back("error", "file-missing");
    fileSize = head.size;
  }

  const db = getDb();
  const stamp = nowIso();
  let mapId = id;

  try {
    if (id > 0) {
      db.prepare(
        `UPDATE maps SET slug=?, status=?, cover_url=?, cover_key=?, file_url=?, file_key=?, file_size=?,
                         version=?, author=?, players=?, category=?, sort=?, updated_at=? WHERE id=?`,
      ).run(slug, status, coverUrl, coverKey, fileUrl, fileKey, fileSize, version, author, players, category, sort, stamp, id);
    } else {
      const result = db
        .prepare(
          `INSERT INTO maps (slug, status, cover_url, cover_key, file_url, file_key, file_size,
                             version, author, players, category, sort, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(slug, status, coverUrl, coverKey, fileUrl, fileKey, fileSize, version, author, players, category, sort, stamp, stamp);
      mapId = Number(result.lastInsertRowid);
    }
  } catch {
    back("error", "duplicate-slug");
  }

  const locales = db.prepare("SELECT code FROM locales").all() as unknown as Array<{ code: string }>;
  const upsert = db.prepare(
    `INSERT INTO map_translations (map_id, locale, name, description) VALUES (?, ?, ?, ?)
     ON CONFLICT(map_id, locale) DO UPDATE SET name=excluded.name, description=excluded.description`,
  );
  for (const { code } of locales) {
    upsert.run(mapId, code, text(formData, `name_${code}`, 120), text(formData, `description_${code}`, 20000));
  }

  back("ok", id > 0 ? "updated" : "created");
}

export async function deleteMapAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = integer(formData, "id");
  const map = getMapById(id);
  if (map) {
    getDb().prepare("DELETE FROM maps WHERE id = ?").run(id);
    await Promise.all([deleteObject(map.cover_key), deleteObject(map.file_key)]);
  }
  back("ok", "deleted");
}
