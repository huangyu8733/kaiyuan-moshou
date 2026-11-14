// The REPLAY UPLOADER (issue #158) — every finished replay is sent to Warcraft Open's own collection,
// so the matches people actually play can be studied and, in time, an AI that plays like a
// person can be trained on them.
//
// They go to OUR OWN storage: the site's `/api/replays` endpoint writes the bytes into the
// Warcraft Open OSS bucket (`replays/<date>/`), so no third party holds them and no key ever
// reaches the browser. `REPLAY_UPLOAD_URL` is that one line; empty (dev), the uploader does
// nothing at all. Everything else is in place:
//
//   · a replay is offered the moment its match ends (MapViewerScene.closeReplay), in memory;
//   · a send that fails is kept in a small queue in IndexedDB — the page's own store, which the
//     desktop app and a browser both have — and tried again on the next launch and after the
//     next match, so a player who is offline loses nothing;
//   · the queue is CAPPED (`MAX_QUEUED`, oldest dropped), so a machine that is never online does
//     not grow it for ever;
//   · the request carries the replay's bytes and three headers — the Warcraft Open version, the
//     replay format, and an ANONYMOUS install id (a random one made on first use, kept in
//     localStorage), which is what lets a collection tell one player's matches from another's
//     without knowing who anybody is.
//
// What a replay HOLDS is the thing to be careful about: the names the players typed and every
// chat line they sent are in it (game/replay.ts). The player's own switch is `shareReplays`
// (data/options.ts), and the uploader asks it before every send.

import { REPLAY_FORMAT } from "./replay";

/** The site the collection lives on. The browser build is served by it; a packaged desktop build
 *  is not same-origin (it runs from the app's local server), so it names the site outright. */
const SITE = (
  (import.meta.env.VITE_WARCRAFT_OPEN_SITE_URL as string | undefined) ?? "https://warcraft.hhkj.me"
).replace(/\/+$/, "");

/** Where replays are sent: our own site's endpoint, which writes them into our OSS bucket.
 *  Empty in dev, where there is no collection to send to — unless `VITE_REPLAY_UPLOAD_URL`
 *  names another door (a dev site, a test endpoint). */
export const REPLAY_UPLOAD_URL =
  (import.meta.env.VITE_REPLAY_UPLOAD_URL as string | undefined) ??
  (import.meta.env.DEV ? "" : `${SITE}/api/replays`);

/** The most replays kept waiting for a connection. Ours. */
const MAX_QUEUED = 50;

const DB_NAME = "warcraft-open-replay-uploads";
const STORE = "queue";
const INSTALL_ID_KEY = "ow3.installId";

/** Warcraft Open's version, from package.json (vite.config.ts `define`). */
declare const __OW3_VERSION__: string;

/** A random id for this install, made once. Not the player: nothing ties it to a person. */
export function installId(): string {
  try {
    let id = localStorage.getItem(INSTALL_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(INSTALL_ID_KEY, id);
    }
    return id;
  } catch {
    return "unknown";
  }
}

function openQueue(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { autoIncrement: true });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const db = await openQueue();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    tx.oncomplete = () => db.close();
  });
}

/** Send one replay. True when the collection took it. */
async function send(bytes: Uint8Array): Promise<boolean> {
  if (!REPLAY_UPLOAD_URL) return false;
  try {
    const r = await fetch(REPLAY_UPLOAD_URL, {
      method: "POST",
      body: bytes as BodyInit,
      headers: {
        "content-type": "application/octet-stream",
        "x-ow3-version": __OW3_VERSION__,
        "x-ow3-replay-format": String(REPLAY_FORMAT),
        "x-ow3-install": installId(),
      },
    });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * The uploader. `enabled` is the player's switch, asked before every send — turning it off
 * stops the queue too, and nothing waiting is sent.
 */
export class ReplayUploader {
  private draining = false;

  constructor(private readonly enabled: () => boolean) {}

  /** A match has ended: send its replay, and keep it for later if that fails. */
  async offer(bytes: Uint8Array): Promise<void> {
    if (!REPLAY_UPLOAD_URL || !this.enabled()) return;
    if (await send(bytes)) {
      void this.drain();
      return;
    }
    await withStore("readwrite", (s) => s.add(bytes));
    const keys = (await withStore("readonly", (s) => s.getAllKeys())) ?? [];
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_QUEUED))) await withStore("readwrite", (s) => s.delete(k));
  }

  /** Send whatever is waiting, oldest first, stopping at the first failure. */
  async drain(): Promise<void> {
    if (this.draining || !REPLAY_UPLOAD_URL || !this.enabled()) return;
    this.draining = true;
    try {
      const keys = (await withStore("readonly", (s) => s.getAllKeys())) ?? [];
      for (const k of keys) {
        if (!this.enabled()) return;
        const bytes = await withStore<Uint8Array>("readonly", (s) => s.get(k) as IDBRequest<Uint8Array>);
        if (bytes && !(await send(bytes))) return;
        await withStore("readwrite", (s) => s.delete(k));
      }
    } finally {
      this.draining = false;
    }
  }
}
