import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { GitHubIcon, StarIcon } from "../Icons";
import { REPO, REPO_URL } from "@/lib/github";
import type { Messages } from "@/i18n/dictionaries/zh";
import type { Locale } from "@/i18n/config";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { SiteNav } from "./SiteNav";

/** 前台的应用外壳：顶栏 + 侧边导航 + 内容区，桌面像软件窗口，移动端折叠侧栏。 */
export function AppShell({
  locale,
  dict,
  locales,
  stars,
  children,
}: {
  locale: Locale;
  dict: Messages;
  locales: Locale[];
  stars: number | null;
  children: ReactNode;
}) {
  const nav = [
    { href: `/${locale}`, label: dict.nav.home },
    { href: `/${locale}/downloads`, label: dict.nav.downloads },
    { href: `/${locale}/maps`, label: dict.nav.maps },
    { href: `/${locale}/contact`, label: dict.nav.contact },
  ];

  return (
    <div className="app-shell">
      <header className="topbar app-topbar">
        <Link className="app-brand" href={`/${locale}`}>
          <Image
            className="app-brand__logo"
            src="/brand-logo.png"
            alt={dict.common.siteName}
            width={360}
            height={200}
            priority
          />
        </Link>
        <nav className="app-topnav" aria-label={dict.common.menu}>
          {nav.slice(0, 3).map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="app-topbar__actions">
          <a className="topbar-play" href="/play/" title={dict.downloads.playInBrowserHint}>
            {dict.downloads.playInBrowser}
          </a>
          <LanguageSwitcher locale={locale} locales={locales} />
          <a
            className="resource"
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            title={`${dict.common.starOnGitHub} (${REPO})`}
          >
            <span className="resource__icon">
              <StarIcon />
            </span>
            <span className="resource__value">{stars ?? "Star"}</span>
            <span className="resource__github">
              <GitHubIcon />
            </span>
          </a>
        </div>
      </header>

      <div className="app-body">
        <SiteNav items={nav} menuLabel={dict.common.menu} closeLabel={dict.common.close} />
        <div className="app-main">
          <main className="app-content">{children}</main>
          <footer className="footer app-footer">
            <p>{dict.footer.disclaimer}</p>
            <p>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                GitHub
              </a>{" "}
              · {dict.footer.license} · {dict.footer.setIn}
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
