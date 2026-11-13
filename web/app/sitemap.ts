import type { MetadataRoute } from "next";
import { LOCALE_CODES } from "@/i18n/config";
import { listPublishedMaps } from "@/lib/db/queries/maps";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://warcraft.hhkj.me").replace(/\/+$/, "");
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of LOCALE_CODES) {
    for (const path of ["", "/downloads", "/maps", "/contact"]) {
      entries.push({
        url: `${base}/${locale}${path}`,
        changeFrequency: path === "" ? "weekly" : "monthly",
        priority: path === "" ? 1 : 0.7,
      });
    }
    for (const map of listPublishedMaps(locale)) {
      entries.push({
        url: `${base}/${locale}/maps/${map.slug}`,
        lastModified: new Date(map.updated_at),
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  }

  return entries;
}
