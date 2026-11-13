import { saveLocalesAction } from "@/lib/actions/locales";
import { listLocales } from "@/lib/db/queries/locales";
import { AdminNotice } from "@/components/admin/AdminNotice";

export const dynamic = "force-dynamic";

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminLanguagesPage({ searchParams }: { searchParams: Search }) {
  const query = await searchParams;
  const locales = listLocales();

  return (
    <>
      <h1 className="admin-title">语言</h1>
      <AdminNotice ok={query.ok} error={query.error} />

      <div className="ow3-panel admin-form-panel">
        <p className="text-muted">
          启用后该语言会出现在前台切换器中。新增语言需要：在 <code>i18n/config.ts</code> 注册，新建
          <code> i18n/dictionaries/&lt;code&gt;.ts</code> 词典；地图介绍在编辑页按语言标签维护。
        </p>
        <form action={saveLocalesAction} className="admin-form">
          <table className="data-table">
            <thead>
              <tr>
                <th>语言</th>
                <th>代码</th>
                <th>启用</th>
                <th>排序</th>
              </tr>
            </thead>
            <tbody>
              {locales.map((locale) => (
                <tr key={locale.code}>
                  <th scope="row">{locale.label}</th>
                  <td>{locale.code}</td>
                  <td>
                    <input type="checkbox" name={`enabled_${locale.code}`} value="1" defaultChecked={locale.enabled === 1} />
                  </td>
                  <td>
                    <input className="input input--narrow" type="number" name={`sort_${locale.code}`} defaultValue={locale.sort} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
