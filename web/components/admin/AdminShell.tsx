import Link from "next/link";
import { logoutAction } from "@/lib/actions/auth";

const NAV = [
  { href: "/admin", label: "概览" },
  { href: "/admin/downloads", label: "游戏下载" },
  { href: "/admin/resources", label: "资料下载" },
  { href: "/admin/maps", label: "地图管理" },
  { href: "/admin/contact", label: "联系信息" },
  { href: "/admin/languages", label: "语言" },
];

/** 管理后台外壳：左侧导航 + 右侧内容。后台固定中文。 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <Link className="admin-brand" href="/admin">
          魔兽争霸开源版 · 管理后台
        </Link>
        <div className="admin-topbar__actions">
          <Link href="/zh" target="_blank" className="text-link">
            查看前台
          </Link>
          <form action={logoutAction}>
            <button className="btn btn--ghost" type="submit">
              退出登录
            </button>
          </form>
        </div>
      </header>
      <aside className="admin-nav">
        <nav>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="admin-nav__link">
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="admin-content">{children}</main>
    </div>
  );
}
