// The page's half of an update: the launcher serves its UI out of a directory, so a new build of
// that directory can be fetched and swapped WITHOUT touching the installed app. Only the shell
// (main process, preload, a new Electron) still needs the installer.
//
// The new copy goes to `userData/web-<version>/` and `web-current.json` is repointed at it — the
// directory being served is never renamed out from under a request. The caller reloads the window
// afterwards; nothing here touches the running page.
//
// The archive is a plain ZIP because a build machine can make one without any toolchain on the
// player's side; the reader below handles the only two methods `zip` emits (stored and deflate)
// and refuses anything that would escape the target directory.

import { app } from "electron";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const PACKAGED_DIST = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");

/** Where the page is read from: the newest fetched copy if there is one, else the packaged build. */
export function webRoot() {
  const folder = currentWebFolder();
  if (folder && existsSync(join(folder, "index.html"))) return folder;
  return PACKAGED_DIST;
}

/** The version of the page this app is showing: the fetched copy's, or the app's own. */
export function currentWebVersion() {
  return installedMarker()?.version ?? app.getVersion();
}

function webDir() {
  return join(app.getPath("userData"), "web");
}

function markerPath() {
  return join(webDir(), "web-current.json");
}

function installedMarker() {
  try {
    const data = JSON.parse(readFileSync(markerPath(), "utf8"));
    if (typeof data?.version === "string" && typeof data?.folder === "string") return data;
  } catch {
    /* no fetched copy, or a corrupt marker: the packaged build is what runs */
  }
  return null;
}

function currentWebFolder() {
  const marker = installedMarker();
  if (!marker) return null;
  const folder = normalize(marker.folder);
  // A path outside our own data folder is not something we wrote — ignore it.
  return folder.startsWith(normalize(webDir()) + sep) ? folder : null;
}

/** Unpack `zipPath` as the page for `version`, point the marker at it and drop older copies.
 *  Throws on a malformed archive; the caller keeps showing what it has. */
export function applyWebBundle(zipPath, version) {
  const name = `web-${version.replace(/[^\w.-]/g, "_")}`;
  const target = join(webDir(), name);
  const staging = `${target}.tmp`;
  mkdirSync(webDir(), { recursive: true });
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  extractZip(readFileSync(zipPath), staging);
  if (!existsSync(join(staging, "index.html"))) {
    rmSync(staging, { recursive: true, force: true });
    throw new Error("The downloaded page has no index.html.");
  }
  // rename() is the swap, and the marker is written only once every file is in place: a crash
  // leaves the previous copy — and its marker — serving.
  rmSync(target, { recursive: true, force: true });
  renameSync(staging, target);
  writeFileSync(markerPath(), JSON.stringify({ version, folder: target }, null, 2));
  for (const entry of readdirSync(webDir())) {
    if (entry.startsWith("web-") && entry !== name && !entry.endsWith(".json")) {
      rmSync(join(webDir(), entry), { recursive: true, force: true });
    }
  }
  return target;
}

/** Read a ZIP held in memory and write its entries under `root`. */
function extractZip(buffer, root) {
  const size = buffer.length;
  // End of central directory: the last record, so it is found from the tail. Its optional comment
  // is why the scan starts at the newest byte rather than at a fixed offset.
  let eocd = -1;
  for (let i = size - 22; i >= 0 && i >= size - 22 - 0xffff; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("The downloaded page is not a ZIP.");
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);

  for (let n = 0; n < count; n += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("The downloaded page is a damaged ZIP.");
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    offset += 46 + nameLength + extraLength + commentLength;

    if (name.endsWith("/")) continue; // a directory entry; mkdir handles it below
    const out = safeJoin(root, name);
    if (!out) throw new Error(`The downloaded page contains an unsafe path: ${name}`);

    // The local header repeats the name and extra fields, whose lengths are what find the data.
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("The downloaded page is a damaged ZIP.");
    const dataStart = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
    const raw = buffer.subarray(dataStart, dataStart + compressedSize);
    const data = method === 0 ? raw : method === 8 ? inflateRawSync(raw) : null;
    if (!data) throw new Error(`The downloaded page uses an unsupported compression (${method}).`);

    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, data);
  }
}

/** `name` under `root`, or null if it climbs out (`..`) or is absolute. */
function safeJoin(root, name) {
  const cleaned = normalize(name.replaceAll("\\", "/")).replace(/^[/\\]+/, "");
  if (cleaned.startsWith("..") || cleaned.includes(`..${sep}`)) return null;
  const full = normalize(join(root, cleaned));
  return full.startsWith(normalize(root) + sep) ? full : null;
}
