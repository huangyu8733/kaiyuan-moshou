import Link from "next/link";
import type { MapWithText } from "@/lib/db/schema";
import type { Messages } from "@/i18n/dictionaries/zh";
import { formatBytes } from "@/lib/format";

/** 地图卡片：封面 + 名称 + 关键信息 + 详情/下载入口。 */
export function MapCard({ map, locale, dict }: { map: MapWithText; locale: string; dict: Messages }) {
  const name = map.name || map.slug;
  const href = `/${locale}/maps/${map.slug}`;

  return (
    <article className="ow3-panel map-card">
      <Link className="map-card__cover" href={href} tabIndex={-1} aria-hidden>
        {map.cover_url ? (
          // 封面来自 OSS，尺寸不定；用原生 img 避免为每个 bucket 配 next/image 白名单。
          <img src={map.cover_url} alt="" loading="lazy" draggable={false} />
        ) : (
          <span className="map-card__placeholder">{name.slice(0, 2)}</span>
        )}
        <span className="map-card__category">
          {(dict.maps.categories as Record<string, string>)[map.category] ?? dict.maps.categories.other}
        </span>
      </Link>
      <div className="map-card__body">
        <h3 className="map-card__title">
          <Link href={href}>{name}</Link>
        </h3>
        <ul className="map-card__meta">
          {map.players ? <li>{dict.maps.players} · {map.players}</li> : null}
          {map.version ? <li>{dict.maps.version} · {map.version}</li> : null}
          {map.file_size ? <li>{formatBytes(map.file_size)}</li> : null}
        </ul>
        <div className="map-card__actions">
          <Link className="text-link" href={href}>
            {dict.maps.detail}
          </Link>
          {/* 「下载地图」先进详情页：那里列着地图文件和全部语言文件，逐个单独下载。 */}
          <Link className="text-link text-link--accent" href={`${href}#downloads`}>
            {dict.maps.download}
          </Link>
        </div>
      </div>
    </article>
  );
}
