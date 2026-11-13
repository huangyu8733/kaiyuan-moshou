import Link from "next/link";
import { notFound } from "next/navigation";
import { getMapById, getMapTranslations } from "@/lib/db/queries/maps";
import { listLocales } from "@/lib/db/queries/locales";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { listMapLanguageFiles } from "@/lib/mapLanguages";
import { MapForm } from "@/components/admin/MapForm";

export const dynamic = "force-dynamic";

export default async function AdminMapEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === "new";
  const numericId = Number(id);
  if (!isNew && !Number.isInteger(numericId)) notFound();

  const map = isNew ? null : getMapById(numericId);
  if (!isNew && !map) notFound();

  const translations = map ? getMapTranslations(map.id) : [];
  const locales = listLocales();
  const languageFiles = map ? await listMapLanguageFiles(map.file_key) : [];

  return (
    <>
      <div className="admin-head">
        <h1 className="admin-title">{map ? "编辑地图" : "新增地图"}</h1>
        <Link className="text-link" href="/admin/maps">
          返回列表
        </Link>
      </div>
      <div className="ow3-panel admin-form-panel">
        <MapForm
          map={map}
          translations={translations}
          locales={locales}
          defaultLocale={DEFAULT_LOCALE}
          languageFiles={languageFiles}
        />
      </div>
    </>
  );
}
