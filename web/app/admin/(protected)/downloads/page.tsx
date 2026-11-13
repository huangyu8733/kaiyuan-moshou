import Link from "next/link";
import { deleteDownloadAction, saveDownloadAction } from "@/lib/actions/downloads";
import { listDownloads, getDownloadById } from "@/lib/db/queries/downloads";
import { AdminNotice } from "@/components/admin/AdminNotice";
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
        <h2 className="admin-subtitle">{editing ? `编辑下载 #${editing.id}` : "新增下载地址"}</h2>
        <form action={saveDownloadAction} className="admin-form">
          <input type="hidden" name="id" value={editing?.id ?? 0} />
          <div className="form-grid">
            <label className="field">
              <span className="field__label">平台</span>
              <select className="input" name="platform" defaultValue={editing?.platform ?? "windows"}>
                <option value="windows">Windows</option>
                <option value="linux">Linux</option>
                <option value="macos">macOS</option>
                <option value="android">Android</option>
                <option value="harmony">HarmonyOS</option>
                <option value="other">其他</option>
              </select>
            </label>
            <label className="field">
              <span className="field__label">显示名称（留空用平台名）</span>
              <input className="input" name="label" defaultValue={editing?.label ?? ""} />
            </label>
            <label className="field">
              <span className="field__label">版本</span>
              <input className="input" name="version" defaultValue={editing?.version ?? ""} />
            </label>
            <label className="field">
              <span className="field__label">格式</span>
              <input className="input" name="format" defaultValue={editing?.format ?? ""} placeholder="Installer / AppImage / DMG" />
            </label>
            <label className="field">
              <span className="field__label">大小（字节）</span>
              <input className="input" name="size" type="number" defaultValue={editing?.size ?? 0} />
            </label>
            <label className="field">
              <span className="field__label">排序</span>
              <input className="input" name="sort" type="number" defaultValue={editing?.sort ?? 0} />
            </label>
          </div>
          <label className="field">
            <span className="field__label">下载地址（http/https）</span>
            <input className="input" name="url" defaultValue={editing?.url ?? ""} required />
          </label>
          <label className="field field--check">
            <input type="checkbox" name="enabled" value="1" defaultChecked={(editing?.enabled ?? 1) === 1} />
            <span>启用</span>
          </label>
          <div className="form-actions">
            <button className="btn btn--primary" type="submit">
              保存
            </button>
          </div>
        </form>
      </div>

      <div className="ow3-panel admin-table-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>平台</th>
              <th>版本</th>
              <th>格式</th>
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
                <td colSpan={7} className="cell-empty">
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
