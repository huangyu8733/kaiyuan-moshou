// 语言注册表：增加一门语言 = 在 LOCALES 里加一行（含词典加载器），新建可选词典文件。
// 路由前缀是语言的权威来源（/zh/...、/en/...）；cookie 只记住用户的选择。
import type { Messages } from "./dictionaries/zh";

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

/** 新语言的词典可以先只写一部分，缺失的文案自动回退到默认语言。 */
export type PartialMessages = DeepPartial<Messages>;

interface LocaleDefinition {
  label: string;
  short: string;
  load: () => Promise<PartialMessages>;
}

export const LOCALES = {
  zh: {
    label: "简体中文",
    short: "中",
    load: async () => (await import("./dictionaries/zh")).zh,
  },
  en: {
    label: "English",
    short: "EN",
    load: async () => (await import("./dictionaries/en")).en,
  },
} satisfies Record<string, LocaleDefinition>;

export type Locale = keyof typeof LOCALES;

export const DEFAULT_LOCALE: Locale = "zh";

export const LOCALE_CODES = Object.keys(LOCALES) as Locale[];

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && Object.hasOwn(LOCALES, value);
}

export function localeLabel(locale: Locale): string {
  return LOCALES[locale].label;
}

export function localeCodes(): Locale[] {
  return Object.keys(LOCALES) as Locale[];
}

function mergeMessages<T>(base: T, override: DeepPartial<T>): T {
  if (typeof base !== "object" || base === null || Array.isArray(base)) return (override ?? base) as T;
  const result = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    if (value === undefined) continue;
    const current = (base as Record<string, unknown>)[key];
    result[key] =
      typeof value === "object" && value !== null && !Array.isArray(value) && typeof current === "object" && current !== null
        ? mergeMessages(current, value as never)
        : value;
  }
  return result as T;
}

export async function getDictionary(locale: Locale): Promise<Messages> {
  const base = (await LOCALES.zh.load()) as Messages;
  if (locale === "zh") return base;
  return mergeMessages(base, await LOCALES[locale].load());
}

/** `{name}` placeholders, replaced left to right. */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
