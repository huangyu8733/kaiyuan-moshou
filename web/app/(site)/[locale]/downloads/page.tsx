import { notFound } from "next/navigation";
import { getDictionary, isLocale } from "@/i18n/config";
import { listDownloads } from "@/lib/db/queries/downloads";
import { GameDownloads } from "@/components/site/GameDownloads";
import { asPlatform, formatBytes, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DownloadsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = await getDictionary(locale);
  const downloads = listDownloads();

  return (
    <section className="section section--page">
      <h1 className="ow3-heading">{dict.downloads.title}</h1>
      <p className="section__lede">{dict.downloads.lede}</p>

      <div className="download-hero">
        <GameDownloads downloads={downloads} dict={dict} locale={locale} />
      </div>

      {downloads.length > 0 ? (
        <div className="ow3-panel download-table-panel">
          <table className="data-table">
            <thead>
              <tr>
                <th>{dict.downloads.platform}</th>
                <th>{dict.downloads.version}</th>
                <th>{dict.downloads.format}</th>
                <th>{dict.downloads.size}</th>
                <th>{dict.downloads.updated}</th>
              </tr>
            </thead>
            <tbody>
              {downloads.map((item) => (
                <tr key={item.id}>
                  <th scope="row">{item.label || dict.downloads.platforms[asPlatform(item.platform)]}</th>
                  <td>{item.version || "—"}</td>
                  <td>{item.format || "—"}</td>
                  <td>{formatBytes(item.size)}</td>
                  <td>{formatDate(item.updated_at, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
