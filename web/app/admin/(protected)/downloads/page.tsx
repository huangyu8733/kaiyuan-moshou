import Link from "next/link";
import { deleteDownloadAction } from "@/lib/actions/downloads";
import { listDownloads, getDownloadById } from "@/lib/db/queries/downloads";
import { AdminNotice } from "@/components/admin/AdminNotice";
import { DownloadForm } from "@/components/admin/DownloadForm";
import { asPlatform, formatDate, PLATFORM_LABELS } from "@/lib/format";

export const dynamic = "force-dynamic";

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminDownloadsPage({ searchParams }: { searchParams: Search }) {
  const query = await searchParams;
  const rows = listDownloads(true);
  const editId = Number(Array.isArray(query.edit) ? query.edit[0] : query.edit);
  const editing = editId > 0 ? getDownloadById(editId) : null;

  return (
    <>
      <div className="admin-head">
        <h1 className="admin-title">游戏下载</h1>
        {editing ? (
          <Link className="text-link" href="/admin/downloads">
            取消编辑
          </Link>
        ) : null}
      </div>
      <AdminNotice ok={query.ok} error={query.error} />

      <div className="ow3-panel admin-form-panel">
        <h2 className="admin-subtitle">{editing ? `编辑下载 #${editing.id}` : "新增下载"}</h2>
        <DownloadForm key={editing?.id ?? "new"} editing={editing} />
      </div>

      <div className="ow3-panel admin-table-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>平台</th>
              <th>版本</th>
              <th>格式</th>
              <th>来源</th>
              <th>地址</th>
              <th>状态</th>
              <th>更新</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.label || PLATFORM_LABELS[asPlatform(row.platform)]}</th>
                <td>{row.version || "—"}</td>
                <td>{row.format || "—"}</td>
                <td>{row.oss_key ? "OSS 文件" : "外部链接"}</td>
                <td className="cell-url">
                  <a href={row.url} target="_blank" rel="noopener noreferrer">
                    {row.url}
                  </a>
                </td>
                <td>{row.enabled ? "启用" : "停用"}</td>
                <td>{formatDate(row.updated_at, "zh")}</td>
                <td className="cell-actions">
                  <Link className="text-link" href={`/admin/downloads?edit=${row.id}`}>
                    编辑
                  </Link>
                  <form action={deleteDownloadAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <button className="text-link text-link--danger" type="submit">
                      删除
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="cell-empty">
                  还没有下载地址。
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
