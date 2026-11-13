import { getDb } from "../index";
import type { ContactInfo } from "../schema";

export function getSetting(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function getContact(): ContactInfo {
  const fallback: ContactInfo = { email: "", qqGroup: "", wechat: "", github: "", discord: "", note: "" };
  const raw = getSetting("contact");
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<ContactInfo>;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

export function isContactEmpty(contact: ContactInfo): boolean {
  return Object.values(contact).every((value) => !value.trim());
}
