import { buildInfoVersion, isCascInstall } from "./casc";
import type { PickedInstall } from "../assets/opfs";
import { t } from "../i18n";

// Which Warcraft III an install has to be, and why the answer is not "any of them".
//
// **Every player must be running the same game DATA.** A match's units, abilities, costs and
// timings are read out of each machine's own install (that is the whole asset-compatible
// design), so two players on different patches are two players playing different games: the
// authority resolves an order against ITS Footman and the client draws the one in its own SLKs.
// Nothing in the wire protocol can catch that — `PROTOCOL_VERSION` says the two CLIENTS agree,
// which is a different question and answered in a different place (src/net/protocol.ts).
//
// So the version is a gate rather than a note, and it is checked on EVERY launch and not only
// when the folder is first picked: the desktop app remembers a folder and reads it again next
// time (src/assets/nativeInstall.ts), and a player can patch Warcraft III between one launch and
// the next without touching Warcraft Open at all.
//
// **The gate checks the MAJOR version**, not an exact patch: 1.x is the pre-Reforged client
// line this engine reads (1.30.4 is still REQUIRED_VERSION and the downgrade target), and 2.x
// is the remastered line. A pre-1.30 install is an MPQ one, which has no `.build.info` and is
// therefore refused by the content-store check below.

/** The build Warcraft Open plays by default. Matched on the first three components — `.build.info`
 *  carries a fourth (the build number, 11274 here) that varies with the download and says
 *  nothing about the data. Used as the downgrade target and in player-facing messages; MUST
 *  equal `REQUIRED_VERSION` in electron/install.mjs. */
export const REQUIRED_VERSION = "1.30.4";

/** Major versions the install gate accepts: 1.x is the pre-Reforged client line the engine reads
 *  today, 2.x is the remastered line. The exact patch is not part of the gate. MUST equal
 *  `ACCEPTED_MAJOR_VERSIONS` in electron/install.mjs, which asks the same question of the folder
 *  dialog before the answer can be remembered. */
export const ACCEPTED_MAJOR_VERSIONS: readonly string[] = ["1", "2"];

/** Builds the mount turns BACK into REQUIRED_VERSION, and so plays as it: the Internet Archive's
 *  1.31.1, which "Download game files" falls back on (src/assets/downloadInstall.ts). Its store
 *  is laid out differently (vfs/casc.ts `legacyRootName`) and its game data is put back to
 *  1.30.4's (src/vfs/downgrade.ts), so every player still plays the same game. MUST equal
 *  `DOWNGRADE_VERSIONS` in electron/install.mjs; `pnpm app:test` compares them. */
export const DOWNGRADE_VERSIONS: readonly string[] = ["1.31.1"];

/** Is this a build the mount downgrades to REQUIRED_VERSION? */
export const isDowngradable = (version: string | null): boolean =>
  !!version && DOWNGRADE_VERSIONS.includes(version.split(".").slice(0, 3).join("."));

/** What to say about a folder that is the wrong build. One sentence, naming BOTH versions, so
 *  the player can see what they have as well as what is wanted. Shared by the load gate and by
 *  the desktop app's remembered-folder check, which reach the same conclusion by different
 *  routes and must not word it differently. */
export const wrongVersionMessage = (version: string | null): string =>
  version
    ? t("gate.wrongVersion", { version, required: REQUIRED_VERSION })
    : t("gate.unknownVersion", { required: REQUIRED_VERSION });

export interface VersionVerdict {
  ok: boolean;
  /** What the install says it is, when it says anything at all. */
  version: string | null;
  /** Empty when `ok`. Shown to the player verbatim, so it names both versions. */
  message: string;
}

/** Does this version string name a supported major line (1.x or 2.x)? */
export const isAcceptedVersion = (version: string | null): boolean =>
  !!version && ACCEPTED_MAJOR_VERSIONS.includes(version.split(".")[0]);

/** Check a picked folder before it is mounted. */
export function checkVersion(install: PickedInstall): VersionVerdict {
  if (!isCascInstall(install.casc) && ![...install.files.keys()].some((k) => k.toLowerCase().endsWith(".mpq"))) {
    // Neither a content store nor an archive: not an old Warcraft III, not a Warcraft III at all
    // (or one whose data has gone). "Older than 1.30.4" would send the player to patch a folder
    // that has nothing in it to patch.
    return {
      ok: false,
      version: null,
      message: t("gate.noGameData", { required: REQUIRED_VERSION }),
    };
  }
  if (!isCascInstall(install.casc)) {
    // No content store: this is an MPQ-era folder, i.e. older than 1.30 by construction. Said
    // that way round because "no .build.info" means nothing to a player.
    return {
      ok: false,
      version: null,
      message: t("gate.oldVersion", { required: REQUIRED_VERSION }),
    };
  }
  const version = buildInfoVersion(install.casc.buildInfo);
  if (isAcceptedVersion(version) || isDowngradable(version)) return { ok: true, version, message: "" };
  return { ok: false, version, message: wrongVersionMessage(version) };
}
