/** 地图下载时保存到 `Maps\Download\` 的文件名：优先取 OSS key，其次取 URL 路径。 */
export function mapFileName(row: {
  slug: string;
  file_key: string | null;
  file_url: string | null;
}): string {
  let name = "";
  if (row.file_key) name = row.file_key.split("/").pop() ?? "";
  if (!name && row.file_url) {
    try {
      name = decodeURIComponent(new URL(row.file_url).pathname.split("/").pop() ?? "");
    } catch {
      /* 非法 URL 交给下面的兜底 */
    }
  }
  name = name.replace(/[<>:"|?*\u0000-\u001f]/g, "_").trim();
  if (!name) name = `${row.slug}.w3x`;
  if (!/\.(w3m|w3x)$/i.test(name)) name += ".w3x";
  return name;
}

/** RFC 5987 的 Content-Disposition：ASCII 兜底 + UTF-8 原名，中文名不会乱码。 */
export function attachmentDisposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
