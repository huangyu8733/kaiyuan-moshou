const OK: Record<string, string> = {
  created: "已创建。",
  updated: "已保存。",
  deleted: "已删除。",
  saved: "已保存。",
};

const ERROR: Record<string, string> = {
  slug: "Slug 只能包含小写字母、数字和连字符，例如 dota-683d。",
  url: "下载地址必须是 http(s) 链接。",
  platform: "请选择有效的平台。",
  "duplicate-slug": "Slug 已被其他地图使用。",
  "file-missing": "地图文件未在 OSS 找到，请重新上传。",
};

export function AdminNotice({ ok, error }: { ok?: string | string[]; error?: string | string[] }) {
  const okCode = Array.isArray(ok) ? ok[0] : ok;
  const errorCode = Array.isArray(error) ? error[0] : error;
  if (okCode) return <p className="admin-notice admin-notice--ok">{OK[okCode] ?? "操作已完成。"}</p>;
  if (errorCode) return <p className="admin-notice admin-notice--error">{ERROR[errorCode] ?? "操作失败，请检查输入。"}</p>;
  return null;
}
