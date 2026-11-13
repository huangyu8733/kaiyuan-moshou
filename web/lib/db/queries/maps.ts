import { getDb } from "../index";
import type { MapRow, MapTranslation, MapWithText } from "../schema";
import { DEFAULT_LOCALE } from "@/i18n/config";

const SELECT_WITH_TEXT = `
  SELECT m.*,
         COALESCE(NULLIF(t.name, ''), d.name, '') AS name,
         COALESCE(NULLIF(t.description, ''), d.description, '') AS description,
         (SELECT COUNT(*) FROM map_translations c
           WHERE c.map_id = m.id AND (c.name != '' OR c.description != '')) AS translated_locales
    FROM maps m
    LEFT JOIN map_translations t ON t.map_id = m.id AND t.locale = ?
    LEFT JOIN map_translations d ON d.map_id = m.id AND d.locale = ?
`;

/** How the shelf narrows itself. `limit` stays a positional number for the home page's teaser. */
export interface MapListOptions {
  /** Free text over the translated name/description and the author. */
  q?: string;
  /** A category key (web/lib/mapCategories.ts). */
  category?: string;
  limit?: number;
}

/** Published maps, translated to `locale` with a fallback to the default locale. */
export function listPublishedMaps(
  locale: string,
  options: MapListOptions | number = {},
): MapWithText[] {
  const opts = typeof options === "number" ? { limit: options } : options;
  const where = ["m.status = 'published'"];
  const args: Array<string | number> = [locale, DEFAULT_LOCALE];
  if (opts.category) {
    where.push("m.category = ?");
    args.push(opts.category);
  }
  const q = opts.q?.trim().toLowerCase();
  if (q) {
    const like = `%${q}%`;
    where.push(
      `(LOWER(COALESCE(t.name, '')) LIKE ? OR LOWER(COALESCE(d.name, '')) LIKE ?
        OR LOWER(COALESCE(t.description, '')) LIKE ? OR LOWER(COALESCE(d.description, '')) LIKE ?
        OR LOWER(COALESCE(m.author, '')) LIKE ?)`,
    );
    args.push(like, like, like, like, like);
  }
  if (opts.limit) args.push(opts.limit);

  const rows = getDb()
    .prepare(
      `${SELECT_WITH_TEXT}
        WHERE ${where.join(" AND ")}
        ORDER BY m.sort ASC, m.id ASC
        ${opts.limit ? "LIMIT ?" : ""}`,
    )
    .all(...args);
  return rows as unknown as MapWithText[];
}

export function getPublishedMap(slug: string, locale: string): MapWithText | null {
  const row = getDb()
    .prepare(`${SELECT_WITH_TEXT} WHERE m.slug = ? AND m.status = 'published'`)
    .get(locale, DEFAULT_LOCALE, slug);
  return (row as unknown as MapWithText) ?? null;
}

/** Admin list: every map, translated to the default locale, in display order. Searching here
 *  runs over the default-language name plus slug and author, and never hides a draft. */
export function listAllMaps(options: { q?: string; category?: string } = {}): MapWithText[] {
  const where = ["1 = 1"];
  const args: Array<string | number> = [DEFAULT_LOCALE, DEFAULT_LOCALE];
  if (options.category) {
    where.push("m.category = ?");
    args.push(options.category);
  }
  const q = options.q?.trim().toLowerCase();
  if (q) {
    const like = `%${q}%`;
    where.push(
      `(LOWER(m.slug) LIKE ? OR LOWER(COALESCE(d.name, '')) LIKE ? OR LOWER(COALESCE(m.author, '')) LIKE ?)`,
    );
    args.push(like, like, like);
  }
  const rows = getDb()
    .prepare(
      `${SELECT_WITH_TEXT}
        WHERE ${where.join(" AND ")}
        ORDER BY m.sort ASC, m.id ASC`,
    )
    .all(...args);
  return rows as unknown as MapWithText[];
}

export function getMapById(id: number): MapRow | null {
  const row = getDb().prepare("SELECT * FROM maps WHERE id = ?").get(id);
  // node:sqlite returns null-prototype rows; a Client Component cannot receive those.
  return row ? ({ ...row } as unknown as MapRow) : null;
}

export function getMapTranslations(mapId: number): MapTranslation[] {
  const rows = getDb()
    .prepare("SELECT * FROM map_translations WHERE map_id = ?")
    .all(mapId);
  return rows.map((row) => ({ ...row })) as unknown as MapTranslation[];
}
