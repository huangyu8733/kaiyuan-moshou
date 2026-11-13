export type Platform = "windows" | "linux" | "macos" | "android" | "harmony" | "other";

export const PLATFORM_ORDER: Platform[] = ["windows", "linux", "macos", "android", "harmony", "other"];

export const PLATFORM_LABELS: Record<Platform, string> = {
  windows: "Windows",
  linux: "Linux",
  macos: "macOS",
  android: "Android",
  harmony: "HarmonyOS",
  other: "其他",
};

/** 这些平台直接使用后台为每一行填写的地址，不走 /download/<os> 的单一跳转。 */
export const DIRECT_PLATFORMS: Platform[] = ["windows", "android", "harmony", "other"];

export function asPlatform(value: string): Platform {
  return (PLATFORM_ORDER as string[]).includes(value) ? (value as Platform) : "other";
}

export function formatBytes(value: number | null | undefined): string {
  if (!value || value <= 0) return "—";
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}

export function formatDate(value: string | null | undefined, locale: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", { dateStyle: "medium" }).format(date);
}
