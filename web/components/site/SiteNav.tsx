"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export interface NavItem {
  href: string;
  label: string;
}

/** 软件式侧边导航：桌面常驻，手机上折叠成抽屉。 */
export function SiteNav({ items, menuLabel, closeLabel }: { items: NavItem[]; menuLabel: string; closeLabel: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="sidecol">
      <button
        type="button"
        className="sidenav-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="sidenav-toggle__bars" aria-hidden>
          <span />
          <span />
          <span />
        </span>
        {open ? closeLabel : menuLabel}
      </button>
      {open && <div className="sidenav-backdrop" onClick={() => setOpen(false)} aria-hidden />}
      <nav className={`sidenav${open ? " is-open" : ""}`} onClick={() => setOpen(false)}>
        <ul className="sidenav__list">
          {items.map((item) => {
            const active =
              item.href === pathname ||
              (item.href !== pathname && pathname.startsWith(`${item.href}/`) && item.href.split("/").length > 2);
            return (
              <li key={item.href}>
                <Link className={`sidenav__link${active ? " is-active" : ""}`} href={item.href}>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
