import { randomUUID } from "node:crypto";
import { getOssClient, keyPrefix, ossConfigured } from "@/lib/oss";

// 游戏客户端上传的对局回放（src/game/replayUpload.ts），落盘到我们自己的 OSS。
// 桌面启动器的页面来自本地 http 服务，与官网不同源，所以必须自己带 CORS。

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 单个回放的上限：dev 的本地回放接口也是 64 MB。 */
const MAX_BYTES = 64 * 1024 * 1024;
/** 匿名安装 id：game/replayUpload.ts 生成的 UUID；不合法就归到 anon。 */
const INSTALL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VERSION = /^[0-9A-Za-z._-]{1,32}$/;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Ow3-Version, X-Ow3-Replay-Format, X-Ow3-Install",
  "Access-Control-Max-Age": "86400",
};

/**
 * 匿名上传的闸门：回放只在每局结束时发一次，正常客户端一小时也就几条。
 * 这是一个公开写入口，没有它任何人都能把 OSS 当仓库刷。
 */
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 60;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 4096) {
    for (const [key, times] of hits) if (!times.some((t) => now - t < RATE_WINDOW_MS)) hits.delete(key);
  }
  return false;
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

function day(): string {
  const d = new Date();
  const two = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

export async function POST(request: Request): Promise<Response> {
  if (!ossConfigured()) {
    return Response.json({ error: "OSS 未配置" }, { status: 503, headers: CORS });
  }
  if (rateLimited(clientIp(request))) {
    return Response.json({ error: "上传过于频繁" }, { status: 429, headers: { ...CORS, "Retry-After": "3600" } });
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) {
    return Response.json({ error: "回放超出 64 MB 上限" }, { status: 413, headers: CORS });
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0) {
    return Response.json({ error: "空回放" }, { status: 400, headers: CORS });
  }
  if (bytes.byteLength > MAX_BYTES) {
    return Response.json({ error: "回放超出 64 MB 上限" }, { status: 413, headers: CORS });
  }

  const install = request.headers.get("x-ow3-install") ?? "";
  const version = request.headers.get("x-ow3-version") ?? "";
  const who = INSTALL_ID.test(install) ? install.toLowerCase() : "anon";
  const stamp = VERSION.test(version) ? version : "unknown";
  const key = `${keyPrefix()}/replays/${day()}/${who}_v${stamp}_${randomUUID()}.o3r`;

  try {
    await getOssClient().put(key, Buffer.from(bytes), {
      headers: { "Content-Type": "application/octet-stream" },
    });
  } catch (error) {
    console.error("[replays] OSS 写入失败", error);
    return Response.json({ error: "写入失败" }, { status: 502, headers: CORS });
  }

  return Response.json({ ok: true, key, size: bytes.byteLength }, { status: 201, headers: CORS });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS });
}
