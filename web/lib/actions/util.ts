export function text(formData: FormData, key: string, max = 5000): string {
  const value = formData.get(key);
  return (typeof value === "string" ? value : "").trim().slice(0, max);
}

export function checkbox(formData: FormData, key: string): boolean {
  return formData.get(key) === "1" || formData.get(key) === "on";
}

export function integer(formData: FormData, key: string, fallback = 0): number {
  const value = Number(formData.get(key));
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
