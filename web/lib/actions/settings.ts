"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb, nowIso } from "@/lib/db";
import type { ContactInfo } from "@/lib/db/schema";
import { text } from "./util";

export async function saveContactAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const contact: ContactInfo = {
    email: text(formData, "email", 200),
    qqGroup: text(formData, "qqGroup", 100),
    wechat: text(formData, "wechat", 100),
    github: text(formData, "github", 300),
    discord: text(formData, "discord", 300),
    note: text(formData, "note", 2000),
  };

  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES ('contact', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
    )
    .run(JSON.stringify(contact), nowIso());

  redirect("/admin/contact?ok=saved");
}
