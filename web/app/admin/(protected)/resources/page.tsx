import Link from "next/link";
import { deleteResourceAction, saveResourceAction } from "@/lib/actions/resources";
import { listResources, getResourceById } from "@/lib/db/queries/resources";
import { AdminNotice } from "@/components/admin/AdminNotice";
import { UploadField } from "@/components/admin/UploadField";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminResourcesPage({ searchParams }: { searchParams: Search }) {
  const query = await searchParams;
  const rows = listResources(true);
  const editId = Number(Array.isArray(query.edit) ? query.edit[0] : query.edit);
  const editing = editId > 0 ? getResourceById(editId) : null;

  return (
    <>
      <div className="admin-head">
        <h1 className="admin-title">资料下载</h1>
        {editing ? (
          <Link className="text-link" href="/admin/resources">
            取消编辑
          </Link>
        ) : null}
      </div>
      <AdminNotice ok={query.ok} error={query.error} />

      <div className="ow3-panel admin-form-panel">
        <h2 className="admin-subtitle">{editing ? `编辑资料 #${editing.id}` : "新增资料下载"}</h2>
        <p className="text-muted">
          可以填平台名称、链接和提取码；也可以把文件直接传到 OSS，此时链接留空即可。
        </p>
        <form action={saveResourceAction} className="admin-form">
          <input type="hidden" name="id" value={editing?.id ?? 0} />
          <div className="form-grid">
            <label className="field">
              <span className="field__label">平台 / 渠道名称</span>
              <input className="input" name="name" defaultValue={editing?.name ?? ""} placeholder="GitHub / 百度网盘 / 123 云盘" required />
            </label>
            <label className="field">
              <span className="field__label">提取码（可为空）</span>
              <input className="input" name="code" defaultValue={editing?.code ?? ""} placeholder="例如 a1b2" />
            </label>
            <label className="field">
              <span className="field__label">排序（越小越靠前）</span>
              <input className="input" name="sort" type="number" defaultValue={editing?.sort ?? 0} />
            </label>
          </div>

          <label className="field">
            <span className="field__label">下载链接（填写链接，或留空使用下方上传的文件）</span>
            <input
              className="input"
              name="url"
              defaultValue={editing?.oss_key ? "" : editing?.url ?? ""}
              placeholder="https://…"
            />
          </label>

          <UploadField
            name="file"
            kind="resource"
            accept=".zip,.7z,.rar,.tar,.gz,.tgz,.xz,.pdf,.txt,.md,.json,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
            label="上传文件到 OSS（≤1GB，可选）"
            initialUrl={editing?.oss_key ? editing.url : null}
            initialKey={editing?.oss_key}
            maxMB={1024}
          />

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
              <th>名称</th>
              <th>链接 / 文件</th>
              <th>提取码</th>
              <th>来源</th>
              <th>状态</th>
              <th>更新</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.name}</th>
                <td className="cell-url">
                  <a href={row.url} target="_blank" rel="noopener noreferrer">
                    {row.url}
                  </a>
                </td>
                <td>{row.code || "—"}</td>
                <td>{row.oss_key ? "OSS 文件" : "外部链接"}</td>
                <td>{row.enabled ? "启用" : "停用"}</td>
                <td>{formatDate(row.updated_at, "zh")}</td>
                <td className="cell-actions">
                  <Link className="text-link" href={`/admin/resources?edit=${row.id}`}>
                    编辑
                  </Link>
                  <form action={deleteResourceAction}>
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
                  还没有资料下载条目。
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
