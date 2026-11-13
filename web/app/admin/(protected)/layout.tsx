import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin";
import { ensureLocaleRows } from "@/lib/db/queries/locales";
import { LOCALE_CODES, localeLabel } from "@/i18n/config";
import { AdminShell } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "管理后台 · 魔兽争霸开源版",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  // 词典注册表是语言的唯一来源：新增语言后打开任意后台页面即可自动补上语言行。
  ensureLocaleRows(LOCALE_CODES.map((code) => ({ code, label: localeLabel(code) })));
  return <AdminShell>{children}</AdminShell>;
}
