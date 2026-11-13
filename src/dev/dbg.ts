// TEMPORARY diagnostic aid: sim/JASS milestones, browser console only, DEBUG BUILDS ONLY.
//
// `main.ts` turns it on with `import.meta.env.DEV` at boot, so a build (`pnpm build`, the web
// deploy, the desktop app) prints nothing at all — the console there belongs to the player's
// bug report, not to our milestones.
//
// Was: also mirrored into a fixed page overlay (`#dbg-log`, green monospace). That panel leaked
// into normal play ("order Ewar" rows popping over the corner whenever a skill was cast), and
// the console keeps everything it had. Delete the whole file after use.

// Not `import.meta.env.DEV` in here: tools/tsconfig.sim.json compiles this module to CommonJS
// for the headless tests, where `import.meta` does not exist. The flag crosses over instead.
let enabled = false;

/** Called once, at boot, from the entry point that knows whether this is a debug build. */
export function setDbgEnabled(on: boolean): void {
  enabled = on;
}

export function dbg(...parts: unknown[]): void {
  if (!enabled) return;
  const line = parts.map((p) => (typeof p === "string" ? p : JSON.stringify(p))).join(" ");
  try {
    console.log("[dbg]", line);
  } catch {
    // no console in some test hosts
  }
}
