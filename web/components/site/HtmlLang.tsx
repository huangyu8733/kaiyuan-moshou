"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";

/** The `<html lang>` attribute lives in the root layout, which has no locale params; keep it in
 *  step with the URL prefix so assistive tech and search engines see the right language. */
export function HtmlLang() {
  const pathname = usePathname();
  const first = pathname.split("/")[1];
  const locale = isLocale(first) ? first : DEFAULT_LOCALE;

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : locale;
  }, [locale]);

  return null;
}
