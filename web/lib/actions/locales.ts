"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { listLocales } from "@/lib/db/queries/locales";
import { checkbox, integer } from "./util";

export async function saveLocalesAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const update = getDb().prepare("UPDATE locales SET enabled=?, sort=? WHERE code=?");
  for (const row of listLocales()) {
    update.run(
      checkbox(formData, `enabled_${row.code}`) ? 1 : 0,
      integer(formData, `sort_${row.code}`, row.sort),
      row.code,
    );
  }

  redirect("/admin/languages?ok=saved");
}
