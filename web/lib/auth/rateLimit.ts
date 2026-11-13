// 进程内的登录失败计数，够挡住脚本暴力猜测；重启即清空，不引入额外依赖。
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

type Entry = { count: number; resetAt: number };
type GlobalWithLimit = typeof globalThis & { __ow3LoginAttempts?: Map<string, Entry> };

function store(): Map<string, Entry> {
  const g = globalThis as GlobalWithLimit;
  return (g.__ow3LoginAttempts ??= new Map());
}

export function loginAllowed(key: string): boolean {
  const entry = store().get(key);
  if (!entry) return true;
  if (entry.resetAt <= Date.now()) {
    store().delete(key);
    return true;
  }
  return entry.count < MAX_FAILURES;
}

export function recordLoginFailure(key: string): void {
  const current = store().get(key);
  if (!current || current.resetAt <= Date.now()) {
    store().set(key, { count: 1, resetAt: Date.now() + WINDOW_MS });
    return;
  }
  current.count += 1;
}

export function clearLoginFailures(key: string): void {
  store().delete(key);
}
