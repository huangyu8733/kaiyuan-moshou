// 地图分类是固定的几种，存 Key 而不是各语言的名字：前台按当前语言翻译，后台显示中文，
// 补一种语言时不需要改数据库里的任何一行。

export const MAP_CATEGORIES = [
  "moba",
  "hero-defense",
  "rpg",
  "campaign",
  "melee",
  "other",
] as const;

export type MapCategory = (typeof MAP_CATEGORIES)[number];

export const DEFAULT_CATEGORY: MapCategory = "other";

/** 后台（中文）用的名字。 */
export const ADMIN_CATEGORY_LABELS: Record<MapCategory, string> = {
  moba: "对抗（MOBA）",
  "hero-defense": "英雄防守",
  rpg: "角色扮演（RPG）",
  campaign: "战役",
  melee: "对战（Melee）",
  other: "其他",
};

export function isMapCategory(value: unknown): value is MapCategory {
  return typeof value === "string" && (MAP_CATEGORIES as readonly string[]).includes(value);
}

/** 表单/查询串里的值：不认识的一律落到「其他」。 */
export function normalizeCategory(value: unknown): MapCategory {
  return isMapCategory(value) ? value : DEFAULT_CATEGORY;
}
