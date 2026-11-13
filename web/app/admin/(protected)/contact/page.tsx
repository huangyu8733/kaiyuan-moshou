import { saveContactAction } from "@/lib/actions/settings";
import { getContact } from "@/lib/db/queries/settings";
import { AdminNotice } from "@/components/admin/AdminNotice";

export const dynamic = "force-dynamic";

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminContactPage({ searchParams }: { searchParams: Search }) {
  const query = await searchParams;
  const contact = getContact();

  return (
    <>
      <h1 className="admin-title">联系信息</h1>
      <AdminNotice ok={query.ok} error={query.error} />
      <div className="ow3-panel admin-form-panel">
        <form action={saveContactAction} className="admin-form">
          <div className="form-grid">
            <label className="field">
              <span className="field__label">邮箱</span>
              <input className="input" name="email" defaultValue={contact.email} />
            </label>
            <label className="field">
              <span className="field__label">QQ 群</span>
              <input className="input" name="qqGroup" defaultValue={contact.qqGroup} />
            </label>
            <label className="field">
              <span className="field__label">微信</span>
              <input className="input" name="wechat" defaultValue={contact.wechat} />
            </label>
            <label className="field">
              <span className="field__label">GitHub</span>
              <input className="input" name="github" defaultValue={contact.github} placeholder="https://github.com/..." />
            </label>
            <label className="field">
              <span className="field__label">Discord</span>
              <input className="input" name="discord" defaultValue={contact.discord} placeholder="https://discord.gg/..." />
            </label>
          </div>
          <label className="field">
            <span className="field__label">备注（会显示在联系信息下方）</span>
            <textarea className="input textarea" name="note" rows={4} defaultValue={contact.note} />
          </label>
          <div className="form-actions">
            <button className="btn btn--primary" type="submit">
              保存
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
