import { DEFAULT_LOCALE } from "@/i18n/config";
import { listPublishedMaps } from "@/lib/db/queries/maps";
import { mapFileName } from "@/lib/mapFile";

// 桌面启动器读取的公开地图列表。只暴露已发布地图的展示字段，不返回后台信息。
// Electron 页面与官网不同源，必须带 CORS。

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/** 地图下载时保存到 `Maps\Download\` 的文件名：优先取 OSS key，其次取 URL 路径。 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") || DEFAULT_LOCALE;
  const requested = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(requested) && requested > 0 ? Math.min(Math.floor(requested), 60) : 12;

  const maps = listPublishedMaps(locale, {
    q: url.searchParams.get("q") || undefined,
    category: url.searchParams.get("category") || undefined,
    limit,
  }).map((map) => ({
    slug: map.slug,
    name: map.name || map.slug,
    description: map.description,
    coverUrl: map.cover_url,
    fileSize: map.file_size,
    version: map.version,
    author: map.author,
    players: map.players,
    category: map.category,
    updatedAt: map.updated_at,
    fileName: mapFileName(map),
    downloadUrl: map.file_url
      ? new URL(`/api/public/maps/${encodeURIComponent(map.slug)}/file`, url.origin).toString()
      : null,
  }));

  return Response.json(
    { maps },
    { headers: { ...CORS, "Cache-Control": "public, max-age=60" } },
  );
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS });
}
