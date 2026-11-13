import Link from "next/link";
import { deleteMapAction } from "@/lib/actions/maps";
import { listAllMaps } from "@/lib/db/queries/maps";
import { listLocales } from "@/lib/db/queries/locales";
import { ADMIN_CATEGORY_LABELS, MAP_CATEGORIES, isMapCategory } from "@/lib/mapCategories";
import { AdminNotice } from "@/components/admin/AdminNotice";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminMapsPage({ searchParams }: { searchParams: Search }) {
  const query = await searchParams;
  const rawQuery = query.q;
  const q = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery)?.trim() ?? "";
  const rawCategory = query.category;
  const rawCategoryValue = Array.isArray(rawCategory) ? rawCategory[0] : rawCategory;
  const category = isMapCategory(rawCategoryValue) ? rawCategoryValue : "";

  const maps = listAllMaps({ q, category: category || undefined });
  const enabledLocales = listLocales().filter((locale) => locale.enabled === 1);
  const localeTotal = enabledLocales.length || 1;
  const filtered = Boolean(q || category);

  return (
    <>
      <div className="admin-head">
        <h1 className="admin-title">地图管理</h1>
        <Link className="btn btn--primary" href="/admin/maps/new">
          新增地图
        </Link>
      </div>
      <AdminNotice ok={query.ok} error={query.error} />

      <form className="map-filters admin-map-filters" method="get">
        <div className="map-filters__row">
          <input
            className="input map-filters__search"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="搜索名称、Slug 或作者"
            aria-label="搜索地图"
          />
          <button className="btn btn--primary" type="submit">
            搜索
          </button>
        </div>
        <div className="map-filters__chips">
          <label className="map-chip">
            <input type="radio" name="category" value="" defaultChecked={!category} />
            <span>全部分类</span>
          </label>
          {MAP_CATEGORIES.map((key) => (
            <label className="map-chip" key={key}>
              <input type="radio" name="category" value={key} defaultChecked={category === key} />
              <span>{ADMIN_CATEGORY_LABELS[key]}</span>
            </label>
          ))}
        </div>
      </form>

      <div className="ow3-panel admin-table-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>Slug</th>
              <th>分类</th>
              <th>状态</th>
              <th>版本</th>
              <th>推荐人数</th>
              <th>翻译进度</th>
              <th>更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {maps.map((map) => (
              <tr key={map.id}>
                <th scope="row">{map.name || "（未翻译）"}</th>
                <td>{map.slug}</td>
                <td>{ADMIN_CATEGORY_LABELS[isMapCategory(map.category) ? map.category : "other"]}</td>
                <td>{map.status === "published" ? "已发布" : "草稿"}</td>
                <td>{map.version || "—"}</td>
                <td>{map.players || "—"}</td>
                <td>
                  <span
                    className={`badge ${map.translated_locales >= localeTotal ? "badge--ok" : "badge--missing"}`}
                    title={`${localeTotal} 种启用语言`}
                  >
                    {map.translated_locales} / {localeTotal}
                  </span>
                </td>
                <td>{formatDate(map.updated_at, "zh")}</td>
                <td className="cell-actions">
                  <Link className="text-link" href={`/admin/maps/${map.id}`}>
                    编辑
                  </Link>
                  <form action={deleteMapAction}>
                    <input type="hidden" name="id" value={map.id} />
                    <button className="text-link text-link--danger" type="submit">
                      删除
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {maps.length === 0 ? (
              <tr>
                <td colSpan={9} className="cell-empty">
                  {filtered ? "没有找到符合条件的地图。" : "还没有地图。点击「新增地图」开始。"}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
