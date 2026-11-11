// Text out of the player's install, decoded the way the install actually stores it.
//
// 1.30+ (CASC) keeps every locale's strings as UTF-8 — enUS is plain ASCII, which is why the
// old windows-1252-only decode read English correctly and turned a zhCN install into mojibake
// (`任务` → `ä»»åŠ¡`). The MPQ-era installs (1.27 and older) are genuinely 8-bit Windows-1252.
// Decoding UTF-8 when the bytes ARE valid UTF-8 and falling back to 1252 when they are not
// reads both without a version switch, and leaves ASCII bytes exactly as they were.
const UTF8 = new TextDecoder("utf-8", { fatal: true });
const CP1252 = new TextDecoder("windows-1252");

export function decodeGameText(bytes: Uint8Array): string {
  try {
    return UTF8.decode(bytes);
  } catch {
    return CP1252.decode(bytes);
  }
}
