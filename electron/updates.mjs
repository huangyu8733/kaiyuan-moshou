// The desktop app's own updater: check the site's release manifest, fetch the installer the
// player said yes to, and hand over to it.
//
// The manifest is one small JSON file (web/public/launcher/latest.json, served at
// https://warcraft.hhkj.me/launcher/latest.json), so a new build is published by uploading the
// installers and editing that file — no app release metadata, no code-signing requirement, and
// the same file works for every platform:
//
//   { "version": "0.3.85", "notes": "https://…", "files": {
//       "mac-arm64": "https://…/Warcraft-Open-0.3.85-arm64.dmg",
//       "mac-x64":   "https://…/Warcraft-Open-0.3.85-x64.dmg",
//       "win-x64":   "https://…/Warcraft-Open-0.3.85-x64.exe",
//       "linux-x64": "https://…/Warcraft-Open-0.3.85-x86_64.AppImage" } }
//
// Downloading is the player's decision, once. Installing is the second: the state goes "ready"
// and the screen stays up until they press Restart (src/ui/updateOverlay.ts). Nothing is fetched
// or replaced behind their back.

import { app, net, shell } from "electron";
import { createWriteStream, promises as fsp } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { applyWebBundle, currentWebVersion } from "./webUpdate.mjs";

const MANIFEST_URL = process.env.WARCRAFT_OPEN_UPDATE_URL || "https://warcraft.hhkj.me/launcher/latest.json";
const IDLE = { phase: "idle", version: null, percent: 0, error: null, mode: null };

function parseVersion(value) {
  return String(value ?? "").replace(/^v/i, "").split(/[.+-]/).map((part) => Number.parseInt(part, 10) || 0);
}

/** Is `remote` a later version than `local`? Numeric, segment by segment. */
export function isNewerVersion(remote, local) {
  const a = parseVersion(remote);
  const b = parseVersion(local);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left !== right) return left > right;
  }
  return false;
}

/** The manifest key for this build: mac-arm64, mac-x64, win-x64, linux-x64. */
function assetKey() {
  const platform = process.platform === "darwin" ? "mac" : process.platform === "win32" ? "win" : "linux";
  // An x64 build on Apple Silicon IS x64 — Rosetta is running it — but the machine is not, and the
  // native arm64 build is both faster and what the player wants. Ask for it.
  const arch = process.platform === "darwin" && app.runningUnderARM64Translation ? "arm64" : process.arch;
  return `${platform}-${arch}`;
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const request = net.request(url);
    request.on("response", (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }
      let body = "";
      response.on("data", (chunk) => { body += chunk.toString("utf8"); });
      response.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(new Error(`The update manifest is not JSON: ${err?.message ?? err}`));
        }
      });
    });
    request.on("error", reject);
    request.setHeader("Cache-Control", "no-cache");
    request.end();
  });
}

function download(url, target, onProgress) {
  return new Promise((resolve, reject) => {
    const out = createWriteStream(target);
    const request = net.request(url);
    request.on("response", (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        out.destroy();
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }
      const total = Number(response.headers["content-length"]) || 0;
      let received = 0;
      response.on("data", (chunk) => {
        received += chunk.length;
        out.write(chunk);
        if (total) onProgress(Math.min(99, Math.round((received / total) * 100)));
      });
      response.on("end", () => {
        out.end(() => {
          onProgress(100);
          resolve(target);
        });
      });
      response.on("error", (err) => { out.destroy(); reject(err); });
    });
    request.on("error", (err) => { out.destroy(); reject(err); });
    request.end();
  });
}

async function replaceOnLinux(file) {
  // electron-builder's AppImage runtime tells us which file we ARE. Swap it and start it again;
  // the script waits for this process to exit so the file is no longer mapped.
  const image = process.env.APPIMAGE;
  if (!image) {
    await shell.openPath(file);
    app.quit();
    return;
  }
  const script = [
    "#!/bin/sh",
    "sleep 1",
    `mv -f ${JSON.stringify(file)} ${JSON.stringify(image)}`,
    `chmod +x ${JSON.stringify(image)}`,
    `"${image}" >/dev/null 2>&1 &`,
    "",
  ].join("\n");
  const scriptPath = join(app.getPath("temp"), "warcraft-open-update.sh");
  await fsp.writeFile(scriptPath, script, { mode: 0o755 });
  spawn("/bin/sh", [scriptPath], { detached: true, stdio: "ignore" }).unref();
  app.quit();
}

async function replaceOnWindows(file) {
  // NSIS: /S installs over the old copy silently, and electron-builder's installer restarts the
  // app when it is done. The download is a `.exe` beside the manifest's entry.
  spawn(file, ["/S"], { detached: true, stdio: "ignore" }).unref();
  app.quit();
}

async function replaceOnMac(file) {
  // The dmg opens in the Finder: dragging the app over the old one is the install, and macOS
  // keeps the Gatekeeper consent the player already gave. Quitting first avoids two copies
  // running at once.
  const error = await shell.openPath(file);
  if (error) throw new Error(error);
  app.quit();
}

export function startUpdates({ onChange, log, fakeVersion = null, onApplied = null } = {}) {
  let state = { ...IDLE };
  let manifest = null;
  const set = (patch) => {
    state = { ...state, ...patch };
    onChange?.(state);
  };

  // A pretend update, for driving the two questions without publishing a release to ask them.
  // Unpackaged only; a shipped build cannot be told there is a version it should fetch.
  if (fakeVersion) {
    setTimeout(() => set({ phase: "available", version: fakeVersion, mode: "app", error: null }), 400);
    return {
      get state() { return state; },
      check() { return Promise.resolve(); },
      download() {
        let percent = 0;
        const tick = setInterval(() => {
          percent += 5;
          if (percent >= 100) { clearInterval(tick); set({ phase: "ready", percent: 100 }); }
          else set({ phase: "downloading", percent });
        }, 200);
      },
      install() { set({ phase: "installing" }); log?.info?.("[Warcraft Open] pretend update: not restarting"); },
    };
  }

  return {
    get state() { return state; },
    /** Ask the site for its manifest. Never throws: an update we cannot see is not a reason to
     *  fail to start, and an unpackaged build has no updater at all. */
    async check() {
      if (!app.isPackaged) {
        // A dev build has no installed copy to replace; say "up to date" so the button answers.
        set({ phase: "none", error: null });
        return;
      }
      set({ phase: "checking", error: null });
      try {
        const data = await getJson(MANIFEST_URL);
        const version = String(data?.version ?? "").trim();
        if (!version) throw new Error("The update manifest has no version.");
        manifest = data;
        // The SHELL comes first: a new app brings its own page, so there is nothing to fetch
        // separately. Only when the shell is current does a newer page count on its own — that is
        // the hot half, applied by reloading the window instead of reinstalling the app.
        if (isNewerVersion(version, app.getVersion())) {
          if (!data?.files?.[assetKey()]) {
            set({ phase: "error", error: `No build for ${assetKey()} in the update manifest.` });
            return;
          }
          set({ phase: "available", version, mode: "app", error: null });
          return;
        }
        const web = data?.web;
        if (web?.url && isNewerVersion(String(web.version ?? ""), currentWebVersion())) {
          set({ phase: "available", version: String(web.version), mode: "web", error: null });
          return;
        }
        set({ phase: "none", version, mode: null, error: null });
      } catch (err) {
        set({ phase: "error", error: String(err?.message ?? err) });
      }
    },
    /** Fetch the installer — or, for a page-only update, the page's archive. Progress events keep
     *  the overlay honest; failures leave the player on the build they have. */
    async download() {
      if (state.phase !== "available" || !manifest) return;
      const web = state.mode === "web";
      const url = web ? manifest.web?.url : manifest.files?.[assetKey()];
      if (!url) return;
      set({ phase: "downloading", percent: 0, error: null });
      try {
        const name = decodeURIComponent(new URL(url).pathname.split("/").pop() || "warcraft-open-update");
        const dir = join(app.getPath("temp"), "warcraft-open-update");
        await fsp.mkdir(dir, { recursive: true });
        const target = join(dir, name);
        await download(url, target, (percent) => set({ phase: "downloading", percent }));
        manifest.installer = target;
        set({ phase: "ready", percent: 100, error: null });
      } catch (err) {
        set({ phase: "error", error: String(err?.message ?? err) });
      }
    },
    /** Hand over to the installer (or open the dmg) and quit — or, for a page-only update, put the
     *  new page in place and let the window reload onto it. */
    async install() {
      if (state.phase !== "ready" || !manifest?.installer) return;
      set({ phase: "installing" });
      try {
        if (state.mode === "web") {
          applyWebBundle(manifest.installer, String(manifest.web?.version ?? ""));
          onApplied?.();
          set({ ...IDLE });
          return;
        }
        if (process.platform === "linux") await replaceOnLinux(manifest.installer);
        else if (process.platform === "win32") await replaceOnWindows(manifest.installer);
        else if (process.platform === "darwin") await replaceOnMac(manifest.installer);
        else throw new Error(`Updates are not supported on ${process.platform}.`);
      } catch (err) {
        set({ phase: "error", error: String(err?.message ?? err) });
      }
    },
  };
}
