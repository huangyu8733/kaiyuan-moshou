import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DEFAULT_LOCALE, LOCALE_CODES, getDictionary, isLocale } from "@/i18n/config";
import { listEnabledLocales } from "@/lib/db/queries/locales";
import { stargazers } from "@/lib/github";
import { AppShell } from "@/components/site/AppShell";

// 页面读取 SQLite，必须按请求渲染（构建机通常没有数据库文件）。
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);
  const languages = Object.fromEntries(LOCALE_CODES.map((code) => [code, `/${code}`]));
  return {
    title: dict.meta.title,
    description: dict.meta.description,
    alternates: {
      canonical: `/${locale}`,
      languages: { ...languages, "x-default": `/${DEFAULT_LOCALE}` },
    },
    openGraph: {
      title: dict.meta.title,
      description: dict.meta.description,
      images: ["/media/hero.avif"],
      type: "website",
      locale,
    },
  };
}

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = await getDictionary(locale);
  const enabled = listEnabledLocales()
    .map((row) => row.code)
    .filter(isLocale);
  const locales = enabled.length > 0 ? enabled : [...LOCALE_CODES];
  const stars = await stargazers();

  return (
    <AppShell locale={locale} dict={dict} locales={locales} stars={stars}>
      {children}
    </AppShell>
  );
}
