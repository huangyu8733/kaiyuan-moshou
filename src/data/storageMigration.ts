// Saved state from before the rename: the kit moved from `@openwar3/*` to `@warcraft-open/*`
// and every localStorage key moved with it. Copies `openwar3.*` to `warcraft-open.*` once, so a
// player who already picked a language, options or campaign progress keeps them. Old keys are
// left in place; they are inert from here on.

const OLD_PREFIX = "openwar3.";
const NEW_PREFIX = "warcraft-open.";

try {
  const store = globalThis.localStorage;
  if (store) {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key?.startsWith(OLD_PREFIX)) keys.push(key);
    }
    for (const key of keys) {
      const target = NEW_PREFIX + key.slice(OLD_PREFIX.length);
      if (store.getItem(target) !== null) continue;
      const value = store.getItem(key);
      if (value !== null) store.setItem(target, value);
    }
  }
} catch {
  // Storage unavailable (private mode, tests): the game starts from defaults.
}
