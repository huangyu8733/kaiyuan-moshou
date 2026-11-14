// The Whisper models Voice Control listens with, and the messages between the page and the
// recogniser's worker (src/voice/whisperWorker.ts). Shared, so both ends agree on one shape.
//
// TWO models, one per UI language: `whisper-small.en` for English (the better listener of the
// two) and the multilingual `whisper-small` for Chinese. They are the hub's int8-quantized ONNX
// files (encoder ~92 MB + merged decoder ~157 MB, plus a few MB of tokenizer and configs).
//
// THEY ARE SERVED FROM OUR OWN BUCKET, not from huggingface.co: that host is unreachable from
// much of the network this game runs on (the developer's own machine times out on it), and a
// download that never starts is a feature nobody can use. The two repos are copied up there
// unchanged — same files, same names, same layout transformers.js expects.
//
// There used to be a second, "Fast" base.en (~80 MB) beside small.en on a Fast/Accurate pulldown.
// It was taken out: on the developer's machine it answered no quicker than small.en and was the
// worse listener, so the pulldown bought nothing a player could feel.

/** One model, and the language it listens for. */
export interface WhisperModel {
  /** The repo's name, which is also its folder under `warcraft-open/models/` in the bucket. */
  id: string;
  /** Whisper's own language token. null for an English-only model, which has none. */
  language: "en" | "zh" | null;
  /** The download's total size, for the dialog's bar and the Options tooltip. */
  bytes: number;
}

/** English: the English-only model, still the best listener of it. */
export const WHISPER_EN: WhisperModel = { id: "whisper-small.en", language: null, bytes: 254_000_000 };

/** Chinese: the multilingual model, told to transcribe Chinese (`language: "zh"`). */
export const WHISPER_ZH: WhisperModel = { id: "whisper-small", language: "zh", bytes: 254_000_000 };

/** Every model this build may have on a machine — what the cache sweep keeps (model.ts). */
export const WHISPER_MODELS: readonly WhisperModel[] = [WHISPER_EN, WHISPER_ZH];

/** The model the UI language listens with. */
export function whisperModelFor(locale: string): WhisperModel {
  return locale === "zhCN" ? WHISPER_ZH : WHISPER_EN;
}

/** Our bucket's public host, and the folder the models live in. transformers.js builds every
 *  file's URL as `remoteHost + remotePathTemplate(model) + file`. */
export const WHISPER_REMOTE_HOST = "https://warcraft.oss-cn-hangzhou.aliyuncs.com/";
export const WHISPER_REMOTE_PATH = "warcraft-open/models/{model}/";

/** One file's public URL (the cache check and the publisher both need it). */
export function whisperFileUrl(model: WhisperModel, file: string): string {
  return `${WHISPER_REMOTE_HOST}${WHISPER_REMOTE_PATH.replace("{model}", model.id)}${file}`;
}

/** The ONNX files the model is loaded from (`dtype: "q8"` names them `*_quantized.onnx`) — what
 *  "is it installed?" looks for in the browser's cache. */
export function whisperFiles(model: WhisperModel): string[] {
  return [whisperFileUrl(model, "onnx/encoder_model_quantized.onnx"), whisperFileUrl(model, "onnx/decoder_model_merged_quantized.onnx")];
}

export type WhisperRequest =
  | { type: "load"; model: WhisperModel }
  | { type: "transcribe"; id: number; audio: Float32Array; prompt: string; model: WhisperModel };

export type WhisperReply =
  | { type: "progress"; loaded: number; total: number }
  | { type: "ready" }
  | { type: "result"; id: number; text: string }
  | { type: "error"; id?: number; error: string };
