import { randomUUID } from "node:crypto";
import { isAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { keyPrefix, ossConfigured, publicUrl, signUpload } from "@/lib/oss";

export const runtime = "nodejs";

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const MAP_EXT = new Set(["w3x", "w3m", "zip"]);
/** 安装包：各平台的发布产物。 */
const DOWNLOAD_EXT = new Set([
  "exe", "msi", "dmg", "pkg", "zip", "7z", "tar", "gz", "tgz", "xz",
  "appimage", "deb", "rpm", "apk", "hap",
]);
/** 资料下载：源码包、文档、表格等。 */
const RESOURCE_EXT = new Set([
  "zip", "7z", "tar", "gz", "tgz", "xz", "rar",
  "pdf", "txt", "md", "json",
  "doc", "docx", "xls", "xlsx", "ppt", "pptx",
]);
const IMAGE_MAX = 16 * 1024 * 1024;
const MAP_MAX = 512 * 1024 * 1024;
const LANGUAGE_MAX = 8 * 1024 * 1024;
const DOWNLOAD_MAX = 4096 * 1024 * 1024;
const RESOURCE_MAX = 1024 * 1024 * 1024;
/** A map language sidecar's locale, as in `DotA v6.83d.w3x.zhCN.json`. */
const LOCALE = /^[A-Za-z]{2,8}(?:[-_][A-Za-z0-9]{2,8})?$/;

interface SignRequest {
  filename?: string;
  contentType?: string;
  kind?: string;
  size?: number;
  /** kind=language: the map's own OSS key, and the locale the sidecar translates into. */
  fileKey?: string;
  locale?: string;
}

/** 为浏览器签发一个直传 OSS 的 PUT 地址；密钥永远不离开服务端。 */
export async function POST(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "未登录" }, { status: 401 });
  if (!ossConfigured()) return Response.json({ error: "OSS 未配置，请检查服务端环境变量" }, { status: 503 });

  const body = (await request.json().catch(() => null)) as SignRequest | null;
  const filename = body?.filename ?? "";
  const kind =
    body?.kind === "language"
      ? "language"
      : body?.kind === "map"
        ? "map"
        : body?.kind === "download"
          ? "download"
          : body?.kind === "resource"
            ? "resource"
            : "image";
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  const contentType = body?.contentType || "application/octet-stream";
  const size = Number(body?.size ?? 0);

  // A language file is not a new upload with a random name: it lives BESIDE its map, at
  // `<map key>.<locale>.json`, which is where the site and the launcher look for it.
  if (kind === "language") {
    const fileKey = String(body?.fileKey ?? "");
    const locale = String(body?.locale ?? "");
    if (extension !== "json") {
      return Response.json({ error: "语言文件必须是 .json" }, { status: 400 });
    }
    if (!LOCALE.test(locale)) {
      return Response.json({ error: "语言代码不合法（例如 zhCN、enUS）" }, { status: 400 });
    }
    if (size > LANGUAGE_MAX) {
      return Response.json({ error: "语言文件超出 8 MB 上限" }, { status: 413 });
    }
    // Only a key this database already knows: the page cannot choose an arbitrary OSS path.
    const row = getDb().prepare("SELECT id FROM maps WHERE file_key = ?").get(fileKey);
    if (!row) {
      return Response.json({ error: "请先上传并保存地图文件，再上传语言文件" }, { status: 400 });
    }
    const key = `${fileKey}.${locale}.json`;
    return Response.json({
      key,
      url: publicUrl(key),
      uploadUrl: signUpload(key, "application/json"),
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      expires: 600,
    });
  }

  const allowed =
    kind === "map"
      ? MAP_EXT
      : kind === "download"
        ? DOWNLOAD_EXT
        : kind === "resource"
          ? RESOURCE_EXT
          : IMAGE_EXT;
  const limit = kind === "map" ? MAP_MAX : kind === "download" ? DOWNLOAD_MAX : kind === "resource" ? RESOURCE_MAX : IMAGE_MAX;

  if (!allowed.has(extension)) {
    return Response.json({ error: `不支持的文件类型：.${extension || "?"}` }, { status: 400 });
  }
  if (size > limit) {
    return Response.json({ error: `文件超出 ${Math.round(limit / 1024 / 1024)} MB 上限` }, { status: 413 });
  }
  if (kind === "image" && !contentType.startsWith("image/")) {
    return Response.json({ error: "封面必须是图片" }, { status: 400 });
  }

  const key = `${keyPrefix()}/${kind}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;

  return Response.json({
    key,
    url: publicUrl(key),
    uploadUrl: signUpload(key, contentType),
    method: "PUT",
    headers: { "Content-Type": contentType },
    expires: 600,
  });
}
