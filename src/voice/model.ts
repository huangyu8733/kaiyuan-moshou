import ortWasm from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url";
import ortMjs from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url";
import { WHISPER_MODELS, whisperFileUrl, whisperFiles, whisperModelFor, type WhisperModel, type WhisperReply, type WhisperRequest } from "./whisperModels";
import { currentLocale } from "../i18n";

// Voice Control's speech recogniser: OpenAI's Whisper, run on this computer in a worker
// (src/voice/whisperWorker.ts, transformers.js over onnxruntime-web's WebAssembly build).
//
// ONE MODEL PER UI LANGUAGE (src/voice/whisperModels.ts): English listens with the English-only
// `whisper-small.en`, Chinese with the multilingual `whisper-small` told to transcribe Chinese.
// Both are ~250 MB and downloaded once — from THIS project's own bucket, not huggingface.co,
// which is unreachable from much of the network the game runs on — into the browser's own Cache
// Storage, where transformers.js looks before it ever goes to the network again. Nothing else
// leaves the machine: the audio of a command goes to a worker on this page.

/** The model this UI language listens with. */
export const voiceModel = (): WhisperModel => whisperModelFor(currentLocale());

let worker: Worker | null = null;
let nextId = 1;
const waiting = new Map<number, { resolve: (t: string) => void; reject: (e: Error) => void }>();
let onWorkerMessage: ((m: WhisperReply) => void) | null = null;

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./whisperWorker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (e: MessageEvent<WhisperReply>) => {
    const m = e.data;
    if (m.type === "result") {
      waiting.get(m.id)?.resolve(m.text);
      waiting.delete(m.id);
    } else if (m.type === "error" && m.id !== undefined) {
      waiting.get(m.id)?.reject(new Error(m.error));
      waiting.delete(m.id);
    }
    onWorkerMessage?.(m);
  };
  return worker;
}

/** Stop the worker — a cancelled download is abandoned with it (a file only lands in the cache
 *  once it is whole, so nothing half-written is kept). */
function killWorker(): void {
  worker?.terminate();
  worker = null;
  loaded = false;
  for (const w of waiting.values()) w.reject(new Error("cancelled"));
  waiting.clear();
}

const send = (m: WhisperRequest, transfer: Transferable[] = []): void => getWorker().postMessage(m, transfer);

// ---- what is on this machine -------------------------------------------------------------------

/** The model, once asked about: is it in the browser's cache? null = not asked yet. */
let installed: boolean | null = null;
const listeners = new Set<(installed: boolean) => void>();

/** Whether the model's files are all in the cache transformers.js reads from. */
async function inCache(): Promise<boolean> {
  try {
    const cache = await caches.open("transformers-cache");
    for (const url of whisperFiles(voiceModel())) if (!(await cache.match(url))) return false;
    return true;
  } catch {
    return false; // no Cache Storage (a locked-down private window): nowhere to keep a model
  }
}

/** Whether the model is on this machine — what decides the Options row's face: the download
 *  button, or the checkbox. */
export async function voiceModelInstalled(): Promise<boolean> {
  installed ??= await inCache();
  return installed;
}

/** The last answer, without asking again; null = not asked yet. */
export function voiceModelInstalledNow(): boolean | null {
  return installed;
}

/** Be told when a model arrives (the Options row swaps its button for the checkbox). */
export function onVoiceModelInstalled(fn: (installed: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export interface VoiceInstallProgress {
  /** 0…1 across the whole model. */
  fraction: number;
  received: number;
  total: number;
}

/**
 * Download the model with a progress bar and load it, ready to listen. Rejects on a network
 * failure or when `signal` aborts (Cancel), which stops the worker and with it the download.
 */
export async function installVoiceModel(onProgress: (p: VoiceInstallProgress) => void, signal: AbortSignal): Promise<void> {
  const model = voiceModel();
  const total0 = model.bytes;
  onProgress({ fraction: 0, received: 0, total: total0 });
  await new Promise<void>((resolve, reject) => {
    const onAbort = (): void => {
      killWorker();
      reject(new DOMException("cancelled", "AbortError"));
    };
    if (signal.aborted) return onAbort();
    signal.addEventListener("abort", onAbort, { once: true });
    onWorkerMessage = (m) => {
      if (m.type === "progress") {
        onProgress({ fraction: Math.min(0.99, m.loaded / m.total), received: m.loaded, total: m.total });
      } else if (m.type === "ready") {
        signal.removeEventListener("abort", onAbort);
        onWorkerMessage = null;
        loaded = true;
        resolve();
      } else if (m.type === "error" && m.id === undefined) {
        signal.removeEventListener("abort", onAbort);
        onWorkerMessage = null;
        reject(new Error(m.error));
      }
    };
    send({ type: "load", model });
  });
  installed = true;
  onProgress({ fraction: 1, received: total0, total: total0 });
  for (const fn of listeners) fn(true);
}

// ---- listening ---------------------------------------------------------------------------------

let loaded = false;

/** Load the model into the worker ahead of the first press (a cold load is seconds). */
export function preloadVoiceModel(): void {
  if (loaded) return;
  loaded = true;
  send({ type: "load", model: voiceModel() });
}

/** Whisper's own sample rate: every model in the family hears 16 kHz mono. */
export const WHISPER_RATE = 16_000;

/** What was said, as text. `audio` is 16 kHz mono; `prompt` primes the spelling of names. */
export function transcribe(audio: Float32Array, prompt: string): Promise<string> {
  const reqId = nextId++;
  loaded = true;
  return new Promise((resolve, reject) => {
    waiting.set(reqId, { resolve, reject });
    send({ type: "transcribe", id: reqId, audio, prompt, model: voiceModel() }, [audio.buffer]);
  });
}

/**
 * The models earlier builds downloaded are nothing to anyone now — the Vosk model the first
 * Voice Control kept in IndexedDB (`/vosk`, ~70 MB unpacked), and Whisper base.en — dropped on
 * every boot, quietly, so a player who had them gets the space back.
 */
export function forgetOldVoiceModels(): void {
  try {
    indexedDB.deleteDatabase("/vosk");
  } catch {
    /* no IndexedDB — nothing to forget */
  }
  // …and anything in transformers.js's cache that this build does not run on: the "Fast" base.en
  // an earlier build fetched beside small.en (~80 MB), configs and tokenizer too, whatever another
  // model or a test left behind — and an older build's copy of the ONNX runtime, which
  // transformers.js caches beside the model under the bundle's FINGERPRINTED url, so every update
  // of the game would otherwise leave one more ~27 MB behind. The cache is Voice Control's alone.
  // BOTH language models are kept: switching the UI language must not re-download 250 MB.
  const keep = (url: string): boolean =>
    WHISPER_MODELS.some((m) => url.startsWith(whisperFileUrl(m, ""))) ||
    WHISPER_MODELS.some((m) => url.includes(`/${m.id}/`)) ||
    [ortWasm, ortMjs].some((own) => url.endsWith(own.replace(/^\.?\//, "/")));
  void (async () => {
    try {
      const cache = await caches.open("transformers-cache");
      for (const req of await cache.keys()) if (!keep(req.url)) await cache.delete(req);
    } catch {
      /* no Cache Storage — nothing kept */
    }
  })();
}
