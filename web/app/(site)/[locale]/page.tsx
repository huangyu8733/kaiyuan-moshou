import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DEFAULT_LOCALE, format, getDictionary, isLocale } from "@/i18n/config";
import { listDownloads } from "@/lib/db/queries/downloads";
import { listPublishedMaps } from "@/lib/db/queries/maps";
import { getContact } from "@/lib/db/queries/settings";
import { GameDownloads } from "@/components/site/GameDownloads";
import { MapCard } from "@/components/site/MapCard";
import { ContactPanel } from "@/components/site/ContactPanel";

export const dynamic = "force-dynamic";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = await getDictionary(locale);
  const downloads = listDownloads();
  const maps = listPublishedMaps(locale, 6);
  const contact = getContact();
  const version = downloads.find((item) => item.version)?.version;

  return (
    <>
      <section className="hero">
        <div className="hero__backdrop" aria-hidden>
          <Image src="/media/hero.avif" alt="" draggable={false} fill priority sizes="100vw" />
        </div>
        <div className="hero__content">
          <p className="hero__kicker">{dict.hero.kicker}</p>
          <h1 className="sr-only">{dict.common.siteName}</h1>
          <Image
            className="hero__logo"
            src="/hero-logo.avif"
            alt={dict.common.siteName}
            draggable={false}
            width={1200}
            height={666}
            priority
            sizes="(max-width: 720px) 90vw, 640px"
          />
          <p className="hero__tagline">{dict.hero.tagline}</p>
          <p className="hero__lede">{dict.hero.lede}</p>
          <GameDownloads downloads={downloads.slice(0, 4)} dict={dict} locale={locale} />
          <p className="downloads__meta">
            {version ? <>{format(dict.hero.latest, { version })} · </> : null}
            <Link href={`/${locale}/downloads`}>{dict.nav.downloads}</Link>
          </p>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="ow3-heading">{dict.maps.featured}</h2>
          <Link className="section__more" href={`/${locale}/maps`}>
            {dict.maps.viewAll}
          </Link>
        </div>
        {maps.length > 0 ? (
          <div className="map-grid">
            {maps.map((map) => (
              <MapCard key={map.id} map={map} locale={locale} dict={dict} />
            ))}
          </div>
        ) : (
          <p className="empty-state">{dict.maps.empty}</p>
        )}
      </section>

      <section className="section" id="contact">
        <h2 className="ow3-heading">{dict.contact.title}</h2>
        <p className="section__lede">{dict.contact.lede}</p>
        <div className="ow3-panel contact-panel">
          <ContactPanel contact={contact} dict={dict} />
        </div>
      </section>
    </>
  );
}
