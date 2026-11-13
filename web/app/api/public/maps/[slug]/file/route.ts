import { DEFAULT_LOCALE } from "@/i18n/config";
import { getPublishedMap } from "@/lib/db/queries/maps";
import { attachmentDisposition, mapFileName } from "@/lib/mapFile";

// 地图文件代理：Electron 页面需要读取字节才能写进游戏目录，而 OSS 桶通常没有配 CORS。
// 这里由服务端取回并原样流式转发，只允许已发布地图。

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/** A map's own language sidecar: `<map file>.zhCN.json` / `.enUS.json` beside the `.w3x` on OSS.
 *  `?lang=` names the locale; absent, the .w3x itself is served. */
const LOCALE = /^[A-Za-z]{2,8}(?:[-_][A-Za-z0-9]{2,8})?$/;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const map = getPublishedMap(slug, DEFAULT_LOCALE);
  if (!map?.file_url) {
    return new Response("Not found", { status: 404, headers: CORS });
  }

  const lang = new URL(request.url).searchParams.get("lang");
  if (lang !== null && !LOCALE.test(lang)) {
    return new Response("Bad locale", { status: 400, headers: CORS });
  }
  // The sidecar sits beside the map under the map's own key, so the published file URL plus the
  // locale suffix is exactly its address — no second lookup and no client-supplied path.
  const sourceUrl = lang ? `${map.file_url}.${lang}.json` : map.file_url;

  let upstream: Response;
  try {
    upstream = await fetch(sourceUrl);
  } catch {
    return new Response("Upstream unavailable", { status: 502, headers: CORS });
  }
  if (!upstream.ok || !upstream.body) {
    // A missing sidecar is normal: most maps have no translation for a given language, and the
    // launcher must read that as "just keep the map", not as a failure.
    const status = lang && upstream.status === 404 ? 404 : 502;
    return new Response(`Upstream error (${upstream.status})`, { status, headers: CORS });
  }

  const headers: Record<string, string> = {
    ...CORS,
    "Content-Type": lang ? "application/json; charset=utf-8" : "application/octet-stream",
    "Content-Disposition": attachmentDisposition(lang ? `${mapFileName(map)}.${lang}.json` : mapFileName(map)),
    "Cache-Control": "public, max-age=300",
  };
  const length = upstream.headers.get("content-length");
  if (length) headers["Content-Length"] = length;

  return new Response(upstream.body, { headers });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS });
}
