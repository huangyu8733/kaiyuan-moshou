import Link from "next/link";
import { listAllMaps } from "@/lib/db/queries/maps";
import { listDownloads } from "@/lib/db/queries/downloads";
import { listLocales } from "@/lib/db/queries/locales";

export const dynamic = "force-dynamic";

export default function AdminHome() {
  const maps = listAllMaps();
  const downloads = listDownloads(true);
  const locales = listLocales();

  const published = maps.filter((map) => map.status === "published").length;

  return (
    <>
      <h1 className="admin-title">概览</h1>
      <div className="stat-grid">
        <div className="ow3-panel stat">
          <span className="stat__value">{published}</span>
          <span className="stat__label">已发布地图</span>
        </div>
        <div className="ow3-panel stat">
          <span className="stat__value">{maps.length}</span>
          <span className="stat__label">地图总数</span>
        </div>
        <div className="ow3-panel stat">
          <span className="stat__value">{downloads.length}</span>
          <span className="stat__label">下载地址</span>
        </div>
        <div className="ow3-panel stat">
          <span className="stat__value">{locales.filter((row) => row.enabled).length}</span>
          <span className="stat__label">启用语言</span>
        </div>
      </div>

      <div className="ow3-panel admin-quick">
        <h2 className="admin-subtitle">快捷操作</h2>
        <ul>
          <li>
            <Link className="text-link" href="/admin/maps/new">
              新增地图
            </Link>
          </li>
          <li>
            <Link className="text-link" href="/admin/downloads">
              维护游戏下载地址
            </Link>
          </li>
          <li>
            <Link className="text-link" href="/admin/contact">
              编辑联系信息
            </Link>
          </li>
          <li>
            <Link className="text-link" href="/admin/languages">
              管理语言
            </Link>
          </li>
        </ul>
      </div>
    </>
  );
}
