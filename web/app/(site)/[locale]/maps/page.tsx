import { notFound } from "next/navigation";
import { format, getDictionary, isLocale } from "@/i18n/config";
import { listPublishedMaps } from "@/lib/db/queries/maps";
import { MAP_CATEGORIES, isMapCategory } from "@/lib/mapCategories";
import { MapCard } from "@/components/site/MapCard";

export const dynamic = "force-dynamic";

interface MapsQuery {
  q?: string;
  category?: string;
}

export default async function MapsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<MapsQuery>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const query = await searchParams;
  const q = query.q?.trim() ?? "";
  // An unknown category is no filter at all, never an empty shelf.
  const category = isMapCategory(query.category) ? query.category : "";

  const dict = await getDictionary(locale);
  const maps = listPublishedMaps(locale, { q, category: category || undefined });
  const filtered = Boolean(q || category);

  return (
    <section className="section section--page">
      <h1 className="ow3-heading">{dict.maps.title}</h1>
      <p className="section__lede">{dict.maps.lede}</p>

      <form className="map-filters" method="get">
        <div className="map-filters__row">
          <input
            className="input map-filters__search"
            type="search"
            name="q"
            defaultValue={q}
            placeholder={dict.maps.searchPlaceholder}
            aria-label={dict.maps.search}
          />
          <button className="btn btn--primary" type="submit">
            {dict.maps.search}
          </button>
        </div>
        <div className="map-filters__chips">
          <label className="map-chip">
            <input type="radio" name="category" value="" defaultChecked={!category} />
            <span>{dict.maps.allCategories}</span>
          </label>
          {MAP_CATEGORIES.map((key) => (
            <label className="map-chip" key={key}>
              <input type="radio" name="category" value={key} defaultChecked={category === key} />
              <span>{dict.maps.categories[key]}</span>
            </label>
          ))}
        </div>
      </form>

      {maps.length > 0 ? (
        <>
          <p className="maps-count">{format(dict.maps.count, { count: maps.length })}</p>
          <div className="map-grid">
            {maps.map((map) => (
              <MapCard key={map.id} map={map} locale={locale} dict={dict} />
            ))}
          </div>
        </>
      ) : (
        <p className="empty-state">{filtered ? dict.maps.noResults : dict.maps.empty}</p>
      )}
    </section>
  );
}
