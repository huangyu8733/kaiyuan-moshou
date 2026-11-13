// Reading the player's own Warcraft III folder, from the desktop app's Node side.
//
// **Why this is not an HTTP route.** The dev server has one (tools/vite-plugin-dev-install.ts)
// and its header states the rule it lives by: `apply: "serve"`, so the asset route is not code
// that got switched off in a build, it is code that was never emitted. The shipped app must keep
// that rule, and it serves its page on a LAN-facing port — so an install route there would be
// addressable from another machine. Instead the app answers a CUSTOM SCHEME
// (`ow3-install://`), which is not a server at all: it exists only inside this app's session and
// nothing outside the process can reach it. The bytes never touch a socket.
//
// **Why the walk lives HERE and the dev plugin imports it.** Two enumerations of an install are
// two answers to "which files are the CASC config" that agree until the day they do not — and
// the one that would drift is the one only the other path exercises. The SHIPPED file is the
// home and the dev-only one borrows it, never the other way round: `tools/` is not packaged.
//
// The manifest's shape is the renderer's `InstallManifest` (src/assets/remoteInstall.ts), and
// paths in it speak WC3's `\` separator so they can be used as `InstallFiles` keys verbatim.

import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { Readable } from "node:stream";

const MPQ = /\.mpq$/i;
const MAP = /\.(w3m|w3x)$/i;
// What may be written into `Maps\Download\`: a map, or its own language sidecar beside it.
const DOWNLOADED_NAME = /^[^\\/:*?"<>|\u0000-\u001f]+\.(w3m|w3x)(\.[A-Za-z]{2,8}(?:[-_][A-Za-z0-9]{2,8})?\.json)?$/i;
// A map's own dictionary beside it (src/i18n/mapLanguage.ts): served like any loose file, never
// listed as a map. The sidecar follows the language it translates into.
const LANGUAGE_FILE = /\.(zhCN|enUS)\.json$/i;
const IDX = /^[0-9a-f]{10}\.idx$/i;
const DATA_FILE = /^data\.\d{3}$/i;
const CONFIG_HASH = /^[0-9a-f]{32}$/i;
const BUILD_INFO = ".build.info";

/**
 * The page is served over http from the app's own port, so a fetch of `ow3-install://` is
 * CROSS-ORIGIN and Chromium blocks it without these — which shows up as "Failed to fetch" in the
 * renderer and NOTHING at all in the main process, the whole failure looking exactly like a
 * handler that was never registered. Cost an hour once.
 *
 * `*` is not a hole here: the scheme is registered on THIS app's session, so it exists only
 * inside this process. Another machine loading the page over the LAN runs in its own browser,
 * where `ow3-install://` resolves to nothing at all — which is the property that lets the
 * desktop app read an install while serving a LAN-facing page, and the reason the install is
 * not on that port in the first place.
 *
 * `Range` has to be allowed BY NAME: it is not a CORS-safelisted request header, and a ranged
 * read of `data.NNN` is how every boot works.
 */
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "range",
  "access-control-expose-headers": "content-length, content-range, accept-ranges",
};

/** Reject anything that escapes the install root — `..`, absolute paths, symlink games. */
export function safeJoin(root, rel) {
  const full = resolve(root, rel.replace(/\\/g, sep));
  return full === root || full.startsWith(root + sep) ? full : null;
}

async function collectMaps(dir, prefix, into, language) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = `${prefix}\\${entry.name}`;
    if (entry.isDirectory()) await collectMaps(join(dir, entry.name), rel, into, language);
    else if (MAP.test(entry.name)) into.push(rel);
    else if (language && LANGUAGE_FILE.test(entry.name)) language.push(rel);
  }
}

/** The CASC pieces a mount needs (src/vfs/casc.ts), as install-relative paths. Null for an
 *  MPQ-era folder, which is how the renderer tells the two storages apart. */
async function collectCasc(root) {
  if (!existsSync(join(root, BUILD_INFO)) || !existsSync(join(root, "Data"))) return null;
  const out = { buildInfo: BUILD_INFO, config: [], idx: [], data: {} };
  const walk = async (dir, prefix, depth) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const rel = `${prefix}\\${entry.name}`;
      if (entry.isDirectory()) {
        // config/ is a two-level hash fan-out, data/ and indices/ are flat — three levels of
        // recursion covers both without walking anything deeper.
        if (depth < 3) await walk(join(dir, entry.name), rel, depth + 1);
      } else if (IDX.test(entry.name)) out.idx.push(rel);
      else if (DATA_FILE.test(entry.name)) out.data[Number(entry.name.slice(5))] = rel;
      else if (CONFIG_HASH.test(entry.name)) out.config.push(rel);
    }
  };
  await walk(join(root, "Data"), "Data", 0);
  return out;
}

/** Everything in a folder that an install is made of. Throws if it is not one. */
export async function enumerateInstall(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const archives = entries.filter((e) => e.isFile() && MPQ.test(e.name)).map((e) => e.name);
  const maps = [];
  const languageFiles = [];
  const mapsDir = entries.find((e) => e.isDirectory() && e.name.toLowerCase() === "maps");
  if (mapsDir) await collectMaps(join(root, mapsDir.name), mapsDir.name, maps, languageFiles);
  const casc = await collectCasc(root);
  // The player's own hotkeys/tooltips, a loose file in the folder (issue #142) — named here
  // rather than assumed, because most folders have none. See src/data/customKeys.ts.
  const customKeys = entries.some((e) => e.isFile() && e.name.toLowerCase() === "customkeys.txt")
    ? "CustomKeys.txt"
    : null;
  return { archives, maps, languageFiles, casc, customKeys };
}

/**
 * Write the folder's `CustomKeys.txt` — the hotkey editor's Save (issue #156).
 *
 * The one write this module does, and deliberately narrow: the page hands over BYTES and names no
 * path, and the file lands beside the exe under whatever case the folder already spells it with
 * (`enumerateInstall` found it case-insensitively, and a second `customkeys.txt` beside the first
 * is exactly what a case-sensitive disk would otherwise get). The bytes are windows-1252 already.
 */
export async function writeCustomKeys(root, bytes) {
  if (!root || !existsSync(root)) throw new Error("No Warcraft III folder is selected.");
  const entries = await readdir(root, { withFileTypes: true });
  const name = entries.find((e) => e.isFile() && e.name.toLowerCase() === "customkeys.txt")?.name ?? "CustomKeys.txt";
  await writeFile(join(root, name), Buffer.from(bytes));
}

/**
 * Keep a map a LAN game handed us in the install's `Maps\Download\` — Warcraft III's own folder
 * for maps another player sent (src/assets/downloadedMaps.ts).
 *
 * As narrow as `writeCustomKeys`: the page names a FILE and no folder, and a name that is not a
 * plain `.w3m`/`.w3x` file name — a separator, a `..`, anything that could climb out — is refused
 * here whatever the page already checked. The one exception is the map's own language sidecar
 * (`<map>.w3x.zhCN.json`), which belongs in the same folder and is written the same way.
 * `Maps` and `Download` are found under whatever case the folder spells them with and made when
 * they are missing.
 */
export async function writeDownloadedMap(root, name, bytes) {
  if (!root || !existsSync(root)) throw new Error("No Warcraft III folder is selected.");
  if (typeof name !== "string" || !DOWNLOADED_NAME.test(name) || name.startsWith(".")) {
    throw new Error("Not a map file name.");
  }
  const folder = async (parent, want) => {
    const found = (await readdir(parent, { withFileTypes: true }))
      .find((e) => e.isDirectory() && e.name.toLowerCase() === want.toLowerCase());
    const dir = join(parent, found?.name ?? want);
    if (!found) await mkdir(dir, { recursive: true });
    return dir;
  };
  const dir = await folder(await folder(root, "Maps"), "Download");
  await writeFile(join(dir, name), Buffer.from(bytes));
}

/**
 * Everything in the install's `Maps\Download\`: the maps the launcher keeps there, with the size
 * and mtime the shelf shows. Only plain map files — a language sidecar belongs to its map and is
 * listed/removed with it, not as a row of its own.
 */
export async function listDownloadedMaps(root) {
  if (!root || !existsSync(root)) return [];
  const dir = await findFolder(await findFolder(root, "Maps"), "Download");
  if (!dir) return [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const maps = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && MAP.test(entry.name))
        .map(async (entry) => {
          const info = await stat(join(dir, entry.name));
          return { name: entry.name, size: info.size, updatedAt: info.mtime.toISOString() };
        }),
    );
    return maps.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

/**
 * Remove one map (and its own language sidecars) from `Maps\Download\`. The name is checked like
 * a write, and matched against the folder's own spelling, so only a file that folder holds can
 * be unlinked — a page-supplied path never becomes one.
 */
export async function deleteDownloadedMap(root, name) {
  if (!root || !existsSync(root)) throw new Error("No Warcraft III folder is selected.");
  if (typeof name !== "string" || !MAP.test(name) || name.startsWith(".") || /[\\/:*?"<>|\u0000-\u001f]/.test(name)) {
    throw new Error("Not a map file name.");
  }
  const dir = await findFolder(await findFolder(root, "Maps"), "Download");
  if (!dir) return false;
  const entries = await readdir(dir, { withFileTypes: true });
  const lower = name.toLowerCase();
  const map = entries.find((entry) => entry.isFile() && entry.name.toLowerCase() === lower);
  if (!map) return false;
  await unlink(join(dir, map.name));
  // `<map>.<locale>.json` sidecars go with it: they translate a map that is no longer there.
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const entryLower = entry.name.toLowerCase();
    if (entryLower.startsWith(`${lower}.`) && entryLower.endsWith(".json")) {
      await unlink(join(dir, entry.name)).catch(() => {});
    }
  }
  return true;
}

/** A folder under `parent`, whatever case the disk spells it with; null when it is not there. */
async function findFolder(parent, want) {
  if (!parent) return null;
  try {
    const hit = (await readdir(parent, { withFileTypes: true }))
      .find((entry) => entry.isDirectory() && entry.name.toLowerCase() === want.toLowerCase());
    return hit ? join(parent, hit.name) : null;
  } catch {
    return null;
  }
}

/**
 * Is `name` already in the install's `Maps\Download\`? Spelled the same way `writeDownloadedMap`
 * accepts it, and matched case-insensitively — a disk that spells the folder `maps` still keeps
 * the same map, and the launcher must not offer "download" for a file it already has.
 */
export async function downloadedMapExists(root, name) {
  if (!root || !existsSync(root)) return false;
  if (typeof name !== "string" || !DOWNLOADED_NAME.test(name) || name.startsWith(".")) return false;
  const maps = await findFolder(root, "Maps");
  const download = await findFolder(maps, "Download");
  if (!download) return false;
  try {
    const lower = name.toLowerCase();
    return (await readdir(download, { withFileTypes: true }))
      .some((entry) => entry.isFile() && entry.name.toLowerCase() === lower);
  } catch {
    return false;
  }
}

/** The build OpenWar3 plays by default. Kept for the download/downgrade paths and for the
 *  message the game shows; it is no longer the only version the picker accepts. */
export const REQUIRED_VERSION = "1.30.4";

/** Major versions the folder picker accepts: every 1.x client (the current engine) and every
 *  2.x build (the remastered line). The exact patch is not part of the selection rule. */
export const ACCEPTED_MAJOR_VERSIONS = ["1", "2"];

/** Does a version string name a supported major line? */
export function isAcceptedInstallVersion(version) {
  const major = version?.split(".")[0];
  return !!major && ACCEPTED_MAJOR_VERSIONS.includes(major);
}

/** The builds the game's mount turns back into REQUIRED_VERSION (src/vfs/version.ts, which says
 *  why): the Internet Archive's 1.31.1, which "Download game files" falls back on. `pnpm
 *  app:test` compares the two lists. */
export const DOWNGRADE_VERSIONS = ["1.31.1"];

/** What `.build.info` says this folder is — "1.30.4.11274" — or null if it says nothing. The
 *  file is a `|`-separated table with a header row; the row to read is the ACTIVE branch. */
export function installVersion(root) {
  try {
    const lines = readFileSync(join(root, BUILD_INFO), "utf8").split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return null;
    const columns = lines[0].split("|").map((c) => c.split("!")[0].trim());
    const rows = lines.slice(1).map((l) => {
      const cells = l.split("|");
      return Object.fromEntries(columns.map((c, i) => [c, cells[i] ?? ""]));
    });
    return (rows.find((r) => r.Active === "1") ?? rows[0]).Version || null;
  } catch {
    return null; // absent, unreadable, or not that file
  }
}

/**
 * Is this folder the Warcraft III OpenWar3 plays?
 *
 * Asked of what the player picked, so the answer arrives at the moment of choosing rather than as
 * a mount failing three steps later — and, more importantly, so a folder the game would refuse is
 * never SAVED as the remembered one. The game checks again every launch (src/vfs/version.ts);
 * this is the same rule asked earlier, not a second one.
 *
 * The rule is the MAJOR version: 1.x is the pre-Reforged client line, 2.x the remastered line.
 * A pre-1.30 (MPQ) folder has no `.build.info` at all and so cannot pass, which is correct: it
 * predates the content-store layout this engine reads.
 */
export function looksLikeInstall(root) {
  if (!root || !existsSync(root)) return false;
  if (!existsSync(join(root, "Data"))) return false;
  return isAcceptedInstallVersion(installVersion(root));
}

/**
 * Answer one `ow3-install://` request against `root`.
 *
 * Two routes, the same two the dev server has, so one renderer path reads both:
 *   /manifest.json          → what the folder holds
 *   /file?path=<encoded>    → the bytes, honouring `Range`
 *
 * `Range` is not a nicety on 1.30.4: the content store is a pair of `data.NNN` files totalling
 * 1.7 GB and the mount reads scattered slices of them. Reading those whole would make every
 * boot unusable.
 *
 * Takes a `Request` and returns a `Response`, which is exactly `protocol.handle`'s contract and
 * also plain web types — so this is testable without an Electron window (tools/electron-server-test).
 */
export async function serveInstall(root, request) {
  const url = new URL(request.url);
  const notFound = () => new Response("not found", { status: 404, headers: CORS });

  if (url.pathname === "/manifest.json") {
    if (!root) return notFound();
    const manifest = await enumerateInstall(root);
    return Response.json(manifest, { headers: CORS });
  }

  if (url.pathname === "/file") {
    const rel = url.searchParams.get("path");
    const full = root && rel && safeJoin(root, rel);
    if (!full || !existsSync(full) || !statSync(full).isFile()) return notFound();
    const size = statSync(full).size;
    const headers = { ...CORS, "accept-ranges": "bytes", "content-type": "application/octet-stream" };

    // `bytes=<start>-<end>`, end inclusive, as the fetch Range header spells it.
    const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.get("range") ?? "");
    if (range) {
      const start = Number(range[1]);
      const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      if (start > end || start >= size) {
        return new Response(null, { status: 416, headers: { ...CORS, "content-range": `bytes */${size}` } });
      }
      return new Response(Readable.toWeb(createReadStream(full, { start, end })), {
        status: 206,
        headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) },
      });
    }
    return new Response(Readable.toWeb(createReadStream(full)), {
      status: 200,
      headers: { ...headers, "content-length": String(size) },
    });
  }

  return notFound();
}
