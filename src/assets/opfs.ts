import { fileReader, type CascFiles } from "../vfs/casc";
import type { CustomKeysWriter } from "../data/customKeys";
import { currentLocale } from "../i18n";
import { DOWNLOAD_FOLDER, type MapWriter } from "./downloadedMaps";

// Asset import + persistence (plan §1.2). Import once → read the user's own WC3
// install client-side → cache in OPFS later. Copyrighted bytes never touch a
// server (plan §0). Phase 1 delivers the picker + the MPQ files it yields; the
// OPFS copy that avoids re-picking each session lands alongside it next.

/**
 * Files from a picked install:
 *   • the top-level MPQ archives, keyed by LOWERCASED base name — "war3.mpq", "war3x.mpq"
 *   • every map under `Maps\`, keyed by its relative path AS WRITTEN —
 *     "Maps\\FrozenThrone\\(2)EchoIsles.w3x"
 *
 * The maps are here because the Custom Game screen lists them (issue #61): WC3's melee maps
 * live on DISK under `Maps\`, not inside the archives (the MPQs carry only the campaign
 * ones), so a list built from the VFS alone would come up empty. Their keys keep their case
 * because those keys are shown to the player — an archive's name never is.
 */
export type InstallFiles = Map<string, File>;

/** Prefix of a map entry's key in InstallFiles (matched case-insensitively). */
export const MAPS_PREFIX = "Maps\\";

const isMap = (name: string): boolean => /\.(w3m|w3x)$/i.test(name);
/** A map's own Chinese dictionary beside it (i18n/mapLanguage.ts). Not a map: it must not show
 *  up in any map list, but it IS an install file the VFS has to be able to read. */
const isLanguageFile = (name: string): boolean => /\.zhCN\.json$/i.test(name);
const isUnderMaps = (key: string): boolean => key.toLowerCase().startsWith(MAPS_PREFIX.toLowerCase());

/** The maps in a picked install, as `path → File` (path with WC3's `\` separators). */
export function installMaps(files: InstallFiles): Map<string, File> {
  const maps = new Map<string, File>();
  for (const [key, file] of files) if (isUnderMaps(key) && isMap(key)) maps.set(key, file);
  return maps;
}

/** Everything under `Maps\` — the maps AND their `.zhCN.json` sidecars — for the VFS's loose
 *  layer (vfs/looseFiles.ts). The map list keeps using `installMaps`, which drops the sidecars. */
export function installLooseFiles(files: InstallFiles): Map<string, File> {
  const loose = new Map<string, File>();
  for (const [key, file] of files) if (isUnderMaps(key)) loose.set(key, file);
  return loose;
}

/** Ask the browser to keep the OPFS cache from being evicted under storage pressure. */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}

/** Rough free-space check before importing a multi-GB install. */
export async function estimateQuota(): Promise<{ usage: number; quota: number }> {
  const est = (await navigator.storage?.estimate?.()) ?? {};
  return { usage: est.usage ?? 0, quota: est.quota ?? 0 };
}

// The File System Access API has spotty lib typings, so declare the slice we use.
interface DirEntry {
  kind: "file" | "directory";
  name: string;
  getFile(): Promise<File>;
  values(): AsyncIterableIterator<DirEntry>;
}
export interface DirHandle {
  name: string;
  values(): AsyncIterableIterator<DirEntry>;
  /** The write half, used only by `customKeysWriter` and `mapWriter`. */
  getFileHandle?(name: string, opts: { create: boolean }): Promise<{ createWritable(): Promise<WritableFile> }>;
  getDirectoryHandle?(name: string, opts: { create: boolean }): Promise<DirHandle>;
  queryPermission?(opts: { mode: "read" | "readwrite" }): Promise<"granted" | "denied" | "prompt">;
  requestPermission?(opts: { mode: "read" | "readwrite" }): Promise<"granted" | "denied" | "prompt">;
}
interface WritableFile {
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
}

/**
 * The picker's way of saving a CustomKeys.txt (issue #156): back into the folder it was read
 * from, under the name it had there — or `CustomKeys.txt` beside the exe when there was none,
 * which is the spelling `CustomKeyInfo.txt` names first.
 *
 * The pick was READ access. Writing asks the browser for more, and that prompt has to come out of
 * a user gesture — which the editor's Save click is. A player who refuses gets an error back, and
 * the editor reports it rather than pretending the keys were saved.
 */
function customKeysWriter(dir: DirHandle, name: string): CustomKeysWriter | undefined {
  if (!dir.getFileHandle) return undefined;
  return async (bytes) => {
    const allowed = (await dir.requestPermission?.({ mode: "readwrite" })) ?? "granted";
    if (allowed !== "granted") throw new Error("Permission to write to the Warcraft III folder was refused.");
    const file = await dir.getFileHandle!(name, { create: true });
    const out = await file.createWritable();
    await out.write(bytes);
    await out.close();
  };
}

/**
 * The picker's way of keeping a map a LAN game handed us (assets/downloadedMaps.ts): into
 * `Maps\Download\` of the folder it was read from, each folder made if it is not there and found
 * under whatever case it already has if it is.
 *
 * `ask` is the permission prompt, split out because it must run inside the Join click — the write
 * itself comes seconds later, when the download ends and the gesture is long spent. An install in
 * OPFS (the "Download game files" copy) has no permission to ask for, and answers granted.
 */
function mapWriter(root: DirHandle): { write: MapWriter; ask: () => Promise<boolean> } | undefined {
  if (!root.getDirectoryHandle) return undefined;
  const ask = async (): Promise<boolean> => {
    if ((await root.queryPermission?.({ mode: "readwrite" })) === "granted") return true;
    return ((await root.requestPermission?.({ mode: "readwrite" })) ?? "granted") === "granted";
  };
  const child = async (dir: DirHandle, name: string): Promise<DirHandle> => {
    for await (const entry of dir.values()) {
      if (entry.kind === "directory" && entry.name.toLowerCase() === name.toLowerCase()) {
        return dir.getDirectoryHandle!(entry.name, { create: false });
      }
    }
    return dir.getDirectoryHandle!(name, { create: true });
  };
  const write: MapWriter = async (name, bytes) => {
    if (!(await ask())) throw new Error("Permission to write to the Warcraft III folder was refused.");
    const folder = await child(await child(root, "Maps"), DOWNLOAD_FOLDER);
    const file = await folder.getFileHandle!(name, { create: true });
    const out = await file.createWritable();
    await out.write(bytes);
    await out.close();
  };
  return { write, ask };
}

const isMpq = (name: string): boolean => name.toLowerCase().endsWith(".mpq");

/**
 * A picked install, whichever storage it uses (issue #102).
 *
 * `files` is the same as it always was — the MPQ archives of an MPQ-era install, plus the maps
 * on disk, which BOTH eras keep in a plain `Maps\` folder. `casc` is filled in instead of the
 * archives when the folder is 1.30+: `.build.info` beside the exe and the `Data\` content
 * store. The two never coexist, and the loader mounts whichever it was handed.
 */
export interface PickedInstall {
  files: InstallFiles;
  casc: CascFiles | null;
  /**
   * The text of the folder's own `CustomKeys.txt`, or null when it has none (issue #142).
   *
   * A loose file beside the exe rather than an archive entry, which is why it rides here
   * instead of arriving through the VFS like everything else the game reads. It is the player's
   * to write — `CustomKeyInfo.txt` ships next to it saying how, and `CustomKeysSample.txt` is
   * the whole default set ready to edit — and it is read only when Options → Gameplay →
   * "Hotkeys:" is on Custom. See src/data/customKeys.ts.
   */
  customKeys: string | null;
  /**
   * Write a `CustomKeys.txt` back into the folder (issue #156, the hotkey editor's Save), or
   * absent when this pick cannot — see `CustomKeysWriter` in src/data/customKeys.ts.
   */
  saveCustomKeys?: CustomKeysWriter;
  /** Keep a map a LAN game handed us in `Maps\Download\` (assets/downloadedMaps.ts), or absent
   *  when this pick cannot write. */
  saveMap?: MapWriter;
  /** Ask for the write access `saveMap` needs while a click is in hand — the browser's picker
   *  only; every other door can write without asking. */
  askMapWrite?: () => Promise<boolean>;
}

/**
 * Where a `CustomKeys.txt` may sit inside the picked folder, in the order the two are tried.
 *
 * Blizzard's own `CustomKeyInfo.txt` names BOTH and does it in two consecutive paragraphs: the
 * first says the 1.30 user-data path, "Warcraft III user data under CustomKeyBindings", and the
 * next says "once a customization file has been created in the installed folder". The real
 * user-data folder is `Documents\Warcraft III\CustomKeyBindings\`, which is outside the
 * install and therefore outside everything a folder pick can see — so what is honoured here is
 * the installed-folder spelling, plus the same `CustomKeyBindings\` sub-folder in case the
 * player kept that shape when they moved the file where the game could be pointed at it.
 */
const CUSTOM_KEYS_PATHS = ["customkeys.txt", "customkeybindings\\customkeys.txt"];

/** One of those files as TEXT. **windows-1252**, not UTF-8: it is a Warcraft III data file like
 *  every other `*Strings.txt`, and its tooltips are whatever the player's localized install
 *  writes — `File.text()` would mangle the first accented character in a German or French one
 *  into a replacement char and put it on a command button. */
const readAnsi = async (file: File): Promise<string> =>
  new TextDecoder("windows-1252").decode(await file.arrayBuffer());

/** `.build.info` is the marker of a CASC install; an MPQ-era folder has no such file. */
const BUILD_INFO = ".build.info";
const isIdx = (name: string): boolean => /^[0-9a-f]{10}\.idx$/i.test(name);
const dataFileNumber = (name: string): number | null => {
  const m = /^data\.(\d{3})$/i.exec(name);
  return m ? Number(m[1]) : null;
};

function emptyCasc(): CascFiles {
  return { buildInfo: "", config: new Map(), idx: new Map(), data: new Map() };
}

/**
 * The folder the player picked, carried across visits.
 *
 * A directory handle is structured-cloneable, so IndexedDB can hold one where localStorage
 * cannot — the picker's answer then survives a reload. "Change Game Folder" on the main menu
 * leans on this (ui/fdfMainMenu.ts): it picks, stores and reloads, and the load gate mounts
 * what is stored here. `queryPermission` still has to say yes; a handle restored in a NEW
 * browser session has lost its grant, and ui/gate.ts re-asks on the click that owns the
 * gesture rather than failing silently.
 */
const HANDLE_DB = "warcraft-open.install";
const HANDLE_STORE = "install";
/** The pre-binding key. Still READ (as the last fallback) so an install picked before the
 *  language binding existed keeps working. */
const HANDLE_KEY = "folder";

/**
 * IndexedDB key of the folder remembered for a language — the language the player was in when
 * they picked it.
 *
 * A 1.30.4 install IS its language (one locale per folder, no runtime switch), so the folder and
 * the language are one fact and belong under one key. Switching language (i18n/switch.ts)
 * reloads with `?lang=`, and the boot (ui/gate.ts) mounts the folder remembered FOR THAT
 * language — pick a Chinese folder in Chinese and an English one in English, and the corner
 * button becomes a real language switch for the game data too.
 */
const handleKey = (locale: string): string => `folder:${locale}`;

function handleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HANDLE_DB, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore(HANDLE_STORE); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Keep `handle` as the install a reload should mount, for `locale` (default: the language in
 *  use now — a pick is always made in the language its folder speaks). Silent on failure: private
 *  mode and a denied quota both mean "this visit only", which is what the old behaviour was. */
export async function rememberInstallHandle(handle: DirHandle, locale = currentLocale()): Promise<void> {
  try {
    const db = await handleDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(HANDLE_STORE, "readwrite");
      tx.objectStore(HANDLE_STORE).put(handle, handleKey(locale));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* nothing to remember with */
  }
}

/** The handle the last pick in `locale` left, or null. */
export async function rememberedInstallHandle(locale = currentLocale()): Promise<DirHandle | null> {
  try {
    const db = await handleDb();
    const handle = await new Promise<DirHandle | null>((resolve, reject) => {
      const tx = db.transaction(HANDLE_STORE, "readonly");
      const request = tx.objectStore(HANDLE_STORE).get(handleKey(locale));
      request.onsuccess = () => resolve((request.result as DirHandle | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return handle;
  } catch {
    return null;
  }
}

/**
 * Some remembered folder, whatever language it was picked under — the fallback for a language
 * that has none: switching to English before ever picking an English folder leaves the one
 * Chinese install mounted (it plays fine; only its text is Chinese), which beats an empty gate.
 * The language-specific key wins when several exist, hence the `folder:` prefix check first.
 */
export async function anyRememberedInstallHandle(): Promise<DirHandle | null> {
  try {
    const db = await handleDb();
    const entries = await new Promise<Array<[IDBValidKey, DirHandle]>>((resolve, reject) => {
      const tx = db.transaction(HANDLE_STORE, "readonly");
      const request = tx.objectStore(HANDLE_STORE).getAll();
      const keys = tx.objectStore(HANDLE_STORE).getAllKeys();
      tx.oncomplete = () => {
        const values = (request.result as DirHandle[]) ?? [];
        const names = (keys.result as IDBValidKey[]) ?? [];
        resolve(values.map((v, i) => [names[i], v] as [IDBValidKey, DirHandle]));
      };
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    const localeFirst = entries.find(([key]) => String(key).startsWith("folder:"));
    const legacy = entries.find(([key]) => key === HANDLE_KEY);
    return (localeFirst ?? legacy ?? entries[0])?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Pick a WC3 folder and return what it holds: MPQ archives or a CASC store, plus every map
 * under `Maps\`. Uses showDirectoryPicker on Chromium, falling back to <input webkitdirectory>
 * on Firefox/Safari. Returns null if the user cancels or nothing is selected.
 */
export async function pickInstall(): Promise<PickedInstall | null> {
  const picker = (
    window as unknown as { showDirectoryPicker?: () => Promise<DirHandle> }
  ).showDirectoryPicker;

  if (picker) {
    let handle: DirHandle;
    try {
      handle = await picker();
    } catch {
      return null; // user cancelled
    }
    // Remembered before it is read: the next boot mounts this folder without asking (ui/gate.ts),
    // and "Change Game Folder" (ui/fdfMainMenu.ts) is this plus a reload.
    await rememberInstallHandle(handle);
    return readInstallDir(handle);
  }

  return pickViaInput();
}

/**
 * What a Warcraft III folder holds, read through a directory handle. The picked folder is one
 * such handle; the copy "Download game files" unpacked into OPFS is another
 * (src/assets/downloadInstall.ts) — the same walk, so the two cannot disagree about what an
 * install is made of.
 */
export async function readInstallDir(handle: DirHandle): Promise<PickedInstall> {
  const files: InstallFiles = new Map();
  const casc = emptyCasc();
  let customKeys: string | null = null;
  /** Where the file was found, so a save goes back to the same place. */
  let keysDir: DirHandle = handle;
  let keysName = "CustomKeys.txt";
  for await (const entry of handle.values()) {
    if (entry.kind === "file" && isMpq(entry.name)) {
      files.set(entry.name.toLowerCase(), await entry.getFile());
    } else if (entry.kind === "file" && entry.name.toLowerCase() === BUILD_INFO) {
      casc.buildInfo = await (await entry.getFile()).text();
    } else if (entry.kind === "file" && entry.name.toLowerCase() === CUSTOM_KEYS_PATHS[0]) {
      customKeys = await readAnsi(await entry.getFile());
      keysDir = handle;
      keysName = entry.name;
    } else if (entry.kind === "directory" && entry.name.toLowerCase() === "maps") {
      await collectMaps(entry, entry.name, files);
    } else if (entry.kind === "directory" && entry.name.toLowerCase() === "customkeybindings") {
      if (customKeys === null) {
        const found = await customKeysIn(entry);
        if (found) {
          customKeys = found.text;
          keysDir = entry as unknown as DirHandle;
          keysName = found.name;
        }
      }
    } else if (entry.kind === "directory" && entry.name.toLowerCase() === "data") {
      await collectCasc(entry, casc);
    }
  }
  const maps = mapWriter(handle);
  return {
    files,
    casc: casc.buildInfo ? casc : null,
    customKeys,
    saveCustomKeys: customKeysWriter(keysDir, keysName),
    ...(maps ? { saveMap: maps.write, askMapWrite: maps.ask } : {}),
  };
}

/** Walk `Data\` for the pieces a CASC mount needs (vfs/casc.ts). Everything but the
 *  `data.NNN` files is small and read whole; those are kept as ranged readers. */
async function collectCasc(dir: DirEntry, into: CascFiles, depth = 0): Promise<void> {
  for await (const entry of dir.values()) {
    if (entry.kind === "directory") {
      // config/ is a two-level hash fan-out, data/ and indices/ are flat — three levels of
      // recursion covers both without walking anything deeper.
      if (depth < 3) await collectCasc(entry, into, depth + 1);
      continue;
    }
    const name = entry.name;
    if (isIdx(name)) {
      into.idx.set(name.toLowerCase(), new Uint8Array(await (await entry.getFile()).arrayBuffer()));
      continue;
    }
    const number = dataFileNumber(name);
    if (number !== null) {
      into.data.set(number, fileReader(await entry.getFile()));
      continue;
    }
    // A config file is named by its own MD5 — 32 hex characters and no extension.
    if (/^[0-9a-f]{32}$/i.test(name)) into.config.set(name.toLowerCase(), await (await entry.getFile()).text());
  }
}

/** Walk `Maps\` and add every .w3m/.w3x — and every `.zhCN.json` beside one — keyed by its
 *  relative path. */
async function collectMaps(dir: DirEntry, prefix: string, into: InstallFiles): Promise<void> {
  for await (const entry of dir.values()) {
    const path = `${prefix}\\${entry.name}`;
    if (entry.kind === "file") {
      if (isMap(entry.name) || isLanguageFile(entry.name)) into.set(path, await entry.getFile());
    } else {
      await collectMaps(entry, path, into);
    }
  }
}

/** The `CustomKeys.txt` inside a `CustomKeyBindings\\` folder, if it holds one — the second of
 *  the two places CustomKeyInfo.txt names (see CUSTOM_KEYS_PATHS). */
async function customKeysIn(dir: DirEntry): Promise<{ text: string; name: string } | null> {
  for await (const entry of dir.values()) {
    if (entry.kind === "file" && entry.name.toLowerCase() === CUSTOM_KEYS_PATHS[0]) {
      return { text: await readAnsi(await entry.getFile()), name: entry.name };
    }
  }
  return null;
}

/** The names a Warcraft III folder holds at its TOP level. A `webkitRelativePath` that starts
 *  with one of them is already relative to the install (`Maps\…`), not to the folder above it. */
const INSTALL_TOP = new Set(["maps", "data", "customkeybindings", BUILD_INFO, CUSTOM_KEYS_PATHS[0]]);

/**
 * `webkitRelativePath`'s segments, minus the picked folder's own name.
 *
 * Chrome and WebKit put the picked folder first ("War3/Maps/FrozenThrone/x.w3x"), and dropping
 * it is what makes a key look like the install's own. But not every engine agrees on whether the
 * root is there — a path that already starts at `Maps\` / `Data\` / an archive has no root to
 * drop, and blindly slicing it off used to throw every map away while the MPQs still mounted:
 * the game ran, and the map list was empty with nothing to show why.
 */
function stripPickedRoot(parts: string[]): string[] {
  if (parts.length <= 1) return parts;
  const first = parts[0].toLowerCase();
  if (INSTALL_TOP.has(first) || isMpq(first)) return parts;
  return parts.slice(1);
}

/** Firefox/Safari fallback: a directory <input>. webkitRelativePath gives the same keys. */
function pickViaInput(): Promise<PickedInstall | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.webkitdirectory = true;
    input.onchange = () => {
      void (async () => {
        const list = input.files;
        if (!list || list.length === 0) return resolve(null);
        const files: InstallFiles = new Map();
        const casc = emptyCasc();
        let customKeys: string | null = null;
        for (const file of Array.from(list)) {
          // webkitRelativePath is usually "<pickedFolder>/Maps/FrozenThrone/(2)EchoIsles.w3x";
          // drop the folder the user picked (when it is there), and speak WC3's separator.
          const parts = stripPickedRoot(file.webkitRelativePath.split("/"));
          const top = parts[0]?.toLowerCase();
          if (parts.length === 1 && isMpq(file.name)) { files.set(file.name.toLowerCase(), file); continue; }
          if (parts.length === 1 && file.name.toLowerCase() === BUILD_INFO) { casc.buildInfo = await file.text(); continue; }
          // Either of the two places a CustomKeys.txt may be (CUSTOM_KEYS_PATHS), matched on the
          // whole relative path so the root one wins over the sub-folder's.
          const at = CUSTOM_KEYS_PATHS.indexOf(parts.join("\\").toLowerCase());
          if (at === 0 || (at === 1 && customKeys === null)) { customKeys = await readAnsi(file); continue; }
          if (top === "data") {
            if (isIdx(file.name)) { casc.idx.set(file.name.toLowerCase(), new Uint8Array(await file.arrayBuffer())); continue; }
            const number = dataFileNumber(file.name);
            if (number !== null) { casc.data.set(number, fileReader(file)); continue; }
            if (/^[0-9a-f]{32}$/i.test(file.name)) casc.config.set(file.name.toLowerCase(), await file.text());
            continue;
          }
          if (!isMap(file.name) && !isLanguageFile(file.name)) continue;
          const rel = parts.join("\\");
          if (isUnderMaps(rel)) files.set(rel, file);
        }
        if (!files.size && !casc.buildInfo) return resolve(null);
        resolve({ files, casc: casc.buildInfo ? casc : null, customKeys });
      })();
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
