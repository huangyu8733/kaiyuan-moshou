// The campaign, said in Chinese.
//
// A campaign chapter's dialogue is not in the install's data files — it is in the MAP's own
// war3map.wts, and the English stores ship that table in English no matter what language the
// menus speak. So a Chinese player on a 1.30/1.31 store reads English cinematics, and the old
// fix (a 1.26 Chinese map dropped into `Maps\Campaign\`) only ever worked for the chapters
// whose file names and string ids happened to line up.
//
// This does it the other way round: a dictionary keyed by the ENGLISH LINE itself, populated
// with Blizzard's own 1.26 zhCN translations. Whatever version's store the player has, its
// English lines are looked up here and answered in Chinese; a line the dictionary has never
// seen stays as it was. Nothing depends on a string id, a map file name, or a version.
//
// The pairing that built `campaignZh.json` was id-for-id inside each chapter — the 1.30.4
// campaign map against the 1.26 Chinese one — and where two chapters worded the same English
// line differently the majority won. English is a no-op: the dictionary is only consulted in
// the Chinese UI (i18n/index.ts), and only for maps, never for our own screens.

import TEXT from "./campaignZh.json";
import { currentLocale } from "./index";
import { parseWts } from "../jass/wts";

const LINES: ReadonlyMap<string, string> = new Map(Object.entries(TEXT as Record<string, string>));

/** The Chinese for one wts line, or undefined. Looked up trimmed and with CRLF normalised,
 *  because a wts body keeps the indentation the World Editor wrote. */
function campaignLine(text: string): string | undefined {
  return LINES.get(text.replace(/\r\n/g, "\n").trim());
}

/** Translate a parsed war3map.wts table in place. Every consumer of the table (the script's
 *  TRIGSTR_ resolution, the map's own object data, its info screen) shares this one. */
export function localizeWtsTable(table: Map<number, string>): Map<number, string> {
  if (currentLocale() !== "zhCN") return table;
  for (const [id, line] of table) {
    const zh = campaignLine(line);
    if (zh !== undefined) table.set(id, zh);
  }
  return table;
}

/**
 * The same for the raw text, which is how the interpreter takes it (jass/index.ts hands it the
 * file and it parses the TRIGSTR table itself). Unchanged when nothing in it is known — the
 * common case, and the reason a melee or custom map's wts passes through byte for byte.
 */
export function localizeWts(text: string): string {
  if (currentLocale() !== "zhCN") return text;
  const table = parseWts(text);
  let changed = false;
  for (const [id, line] of table) {
    const zh = campaignLine(line);
    if (zh === undefined) continue;
    table.set(id, zh);
    changed = true;
  }
  if (!changed) return text;
  // Ids are what the script names, so the rebuilt file is the same table in the same order —
  // only the bodies moved. Comments between entries are the editor's, not the game's.
  return [...table].map(([id, line]) => `STRING ${id}\n{\n${line}\n}`).join("\n\n") + "\n";
}
