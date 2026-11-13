import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DEFAULT_LOCALE, LOCALE_CODES, getDictionary, isLocale } from "@/i18n/config";
import { getPublishedMap } from "@/lib/db/queries/maps";
import { mapFileName } from "@/lib/mapFile";
import { listMapLanguageFiles } from "@/lib/mapLanguages";
import { formatBytes, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

/** 语言标记的人类可读名；未知语言直接显示标记本身。 */
const LANGUAGE_LABELS: Record<string, string> = {
  zhCN: "中文（简体）",
  enUS: "English",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const map = getPublishedMap(slug, locale);
  if (!map) return {};
  const name = map.name || map.slug;
  const languages = Object.fromEntries(LOCALE_CODES.map((code) => [code, `/${code}/maps/${slug}`]));
  return {
    title: `${name} · ${(await getDictionary(locale)).meta.title}`,
    description: map.description.slice(0, 160),
    alternates: {
      canonical: `/${locale}/maps/${slug}`,
      languages: { ...languages, "x-default": `/${DEFAULT_LOCALE}/maps/${slug}` },
    },
  };
}

export default async function MapDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const dict = await getDictionary(locale);
  const map = getPublishedMap(slug, locale);
  if (!map) notFound();
  // 地图文件之外，OSS 上可能还传了多种语言的语言文件，全部列出来单独下载。
  const languages = await listMapLanguageFiles(map.file_key);

  const name = map.name || map.slug;

  return (
    <section className="section section--page map-detail">
      <Link className="back-link" href={`/${locale}/maps`}>
        ← {dict.maps.back}
      </Link>

      <div className="map-detail__hero">
        <div className="map-detail__cover">
          {map.cover_url ? (
            <img src={map.cover_url} alt={name} draggable={false} />
          ) : (
            <span className="map-card__placeholder">{name.slice(0, 2)}</span>
          )}
        </div>
        <div className="map-detail__intro">
          <h1 className="ow3-heading">{name}</h1>
          <dl className="meta-list">
            {map.author ? (
              <div>
                <dt>{dict.maps.author}</dt>
                <dd>{map.author}</dd>
              </div>
            ) : null}
            {map.players ? (
              <div>
                <dt>{dict.maps.players}</dt>
                <dd>{map.players}</dd>
              </div>
            ) : null}
            {map.version ? (
              <div>
                <dt>{dict.maps.version}</dt>
                <dd>{map.version}</dd>
              </div>
            ) : null}
            {map.file_size ? (
              <div>
                <dt>{dict.maps.size}</dt>
                <dd>{formatBytes(map.file_size)}</dd>
              </div>
            ) : null}
            <div>
              <dt>{dict.maps.updated}</dt>
              <dd>{formatDate(map.updated_at, locale)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="ow3-panel map-detail__body map-downloads" id="downloads">
        <h2 className="ow3-heading ow3-heading--sm">{dict.maps.downloads}</h2>
        <ul className="download-list">
          <li className="download-row">
            <div className="download-row__text">
              <span className="download-row__name">{mapFileName(map)}</span>
              <span className="download-row__meta">
                {dict.maps.mapFile}
                {map.file_size ? ` · ${formatBytes(map.file_size)}` : ""}
              </span>
            </div>
            {map.file_url ? (
              <a className="download-row__action" href={`/api/public/maps/${encodeURIComponent(slug)}/file`}>
                {dict.downloads.download}
              </a>
            ) : (
              <span className="download-row__disabled">{dict.maps.noFile}</span>
            )}
          </li>
          {languages.map((file) => (
            <li className="download-row" key={file.locale}>
              <div className="download-row__text">
                <span className="download-row__name">{file.fileName}</span>
                <span className="download-row__meta">
                  {dict.maps.languageFiles} · {LANGUAGE_LABELS[file.locale] ?? file.locale}
                  {file.size ? ` · ${formatBytes(file.size)}` : ""}
                </span>
              </div>
              <a
                className="download-row__action"
                href={`/api/public/maps/${encodeURIComponent(slug)}/file?lang=${encodeURIComponent(file.locale)}`}
              >
                {dict.downloads.download}
              </a>
            </li>
          ))}
        </ul>
        {languages.length === 0 ? (
          <p className="text-muted map-downloads__empty">{dict.maps.noLanguageFiles}</p>
        ) : null}
      </div>

      <div className="ow3-panel map-detail__body">
        <h2 className="ow3-heading ow3-heading--sm">{dict.maps.detail}</h2>
        <p className="map-detail__desc">{map.description || dict.maps.noDescription}</p>
      </div>
    </section>
  );
}
