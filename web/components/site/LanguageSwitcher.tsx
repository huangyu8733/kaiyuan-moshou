"use client";

import { usePathname, useRouter } from "next/navigation";
import { LOCALES, type Locale } from "@/i18n/config";

/** 切换语言时保留当前路径，顺便记住用户的选择。
 *  统一使用下拉框：2 种和 15 种语言都是同一个控件，不会把顶栏挤爆，移动端也原生可用。 */
export function LanguageSwitcher({ locale, locales }: { locale: Locale; locales: Locale[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const rest = pathname.split("/").slice(2).join("/");

  function switchTo(next: Locale) {
    document.cookie = `ow3_locale=${next}; path=/; max-age=31536000; samesite=lax`;
    router.push(`/${next}${rest ? `/${rest}` : ""}`);
  }

  return (
    <label className="lang-select" title="语言 / Language">
      <span className="sr-only">语言 / Language</span>
      <select
        className="lang-select__control"
        value={locale}
        onChange={(event) => switchTo(event.target.value as Locale)}
      >
        {locales.map((code) => (
          <option key={code} value={code} lang={code}>
            {LOCALES[code].label}
          </option>
        ))}
      </select>
    </label>
  );
}
