import type { DataSource } from "../vfs/types";
import type { FdfFrame } from "./fdf/parser";
import type { FdfLibrary } from "./fdf/library";
import { mountFdfScreen, type FdfScreen } from "./fdf/render";
import { findFrame, setProp, str } from "./mapBrowser";
import { isRoc } from "../data/edition";
import { setGameTip } from "./gameTip";
import { t } from "../i18n";
import { createLanguageSwitch } from "../i18n/switch";
import { pickInstall } from "../assets/opfs";
import { forgetStoredInstall } from "../assets/downloadInstall";
import { isDesktopApp, pickNativeInstall } from "../assets/nativeInstall";

// The main menu, constructed from the game's own UI\FrameDef\Glue\MainMenu.fdf
// (issue #54) rather than hand-authored DOM. This is the payoff of the FDF engine:
// the layout, button set, ornate chrome, hotkeys and strings all come straight from
// the mounted install, matching the original.

export interface MainMenuHandlers {
  onSinglePlayer: () => void;
  /** The square beside Single Player: switch Reign of Chaos ↔ The Frozen Throne. */
  onEdition?: () => void;
  onOnline?: () => void;
  onLan?: () => void;
  onOptions?: () => void;
  onCredits?: () => void;
  onQuit?: () => void;
}

export async function mountFdfMainMenu(
  container: HTMLElement,
  vfs: DataSource,
  h: MainMenuHandlers,
): Promise<FdfScreen> {
  const log = (name: string) => () => console.log(`[Warcraft Open] menu: ${name}`);
  const screen = await mountFdfScreen({
    container,
    vfs,
    fdfPath: "UI\\FrameDef\\Glue\\MainMenu.fdf",
    rootFrame: "MainMenuFrame",
    buildRoot: (lib) => buildMainMenuRoot(lib),
    // The realm-select sub-panel is hidden until you enter Battle.net (as the engine's
    // glue script hides it), but the little search-region button (magnifying glass)
    // next to Online is kept — the developer wants it shown even without region logic.
    // Both it and Online itself are DISABLED for now (see OFFLINE_BUTTONS).
    hidden: ["RealmSelect"],
    // Wider buttons than the 4:3-authored FDF, to fill the widescreen chain panel
    // (text stays its FDF size — only the widget widens).
    buttonWidthScale: 1.35,
    // "Battle.net" is intentionally "Online": Warcraft Open multiplayer targets our own
    // server, not Blizzard's (matches the flat-menu note in mainMenu.ts / plan §10.1).
    //
    // Renaming a button renames its ACCELERATOR with it. The FDF's caption carries the
    // gilded letter inside the string ("|CffffffffB|Rattle.net") and `KEY_BATTLE_NET_SHORTCUT`
    // holds the same B beside it, so an override that drops the markup leaves this one button
    // with no white letter on a screen where every other button has one — and a B that answers
    // nothing the label shows. So the override carries its own markup, and the shortcut moves
    // to match it.
    //
    // The letter is N, not O: Options already owns O, and picking a LATER letter of the word is
    // the game's own answer to a collision rather than ours — the same table gilds "C|Cffffffffa|Rncel",
    // "E|Cffffffffx|Rit" and "Repla|Cffffffffy|R" for exactly this reason.
    textOverrides: { BattleNetButtonText: t("menu.onlineCaption") },
    shortcutOverrides: { BattleNetButton: "N" },
    handlers: {
      SinglePlayerButton: h.onSinglePlayer,
      EditionButton: h.onEdition ?? log("Edition"),
      BattleNetButton: h.onOnline ?? log("Online"),
      LocalAreaNetworkButton: h.onLan ?? log("Multiplayer"),
      OptionsButton: h.onOptions ?? log("Options"),
      CreditsButton: h.onCredits ?? log("Credits"),
      ExitButton: h.onQuit ?? (() => window.close()),
    },
    // Re-run on every build: a resize throws the DOM away and rebuilds it, taking the
    // anchor AND the disabled state with it (ui/fdf/render.ts).
    onBuild: (s) => {
      for (const name of OFFLINE_BUTTONS) s.setEnabled(name, false);
      // The edition button is an emblem with no caption, so it names the game it goes TO in the
      // tooltip slab — the same edition its art wears (`wearOtherEdition`). The menu is rebuilt
      // after every switch (Glue.crossWorlds), so this is asked afresh each time. The names are
      // OURS: no string table in the install spells either edition out.
      const edition = s.frame("EditionButton");
      if (edition) setGameTip(edition, t(isRoc() ? "menu.editionTft" : "menu.editionRoc"));
    },
  });

  // The language switch lives OUTSIDE the FDF overlay, so a resize (which rebuilds the
  // whole tree) does not take it with it. Removed with the screen, so it never follows the
  // player into a match.
  const outside: HTMLElement[] = [createLanguageSwitch()];
  // "Change Game Folder" belongs to the install rather than the game, so it lives outside the
  // FDF tree like the language switch. It is ALWAYS shown: the `?dev` boot is exactly the one a
  // player is most likely to be running (pnpm dev), and hiding the only door to another install
  // there was the wrong trade — `changeInstall` drops `?dev` when it reloads instead.
  outside.push(createChangeInstall());
  // NOT into `container`: #ui is its own stacking context (z-index 3), and the menu's 3D
  // backdrop canvas out-paints everything inside it — the controls were under the canvas and
  // unclickable. On `body` they sit in the page's own stacking order, above it (style.css).
  for (const el of outside) document.body.appendChild(el);
  const dispose = screen.dispose.bind(screen);
  screen.dispose = (): void => {
    for (const el of outside) el.remove();
    dispose();
  };
  return screen;
}

/**
 * "Change Game Folder" — a picking door for the install the game is already running on.
 *
 * It sits outside the FDF tree like the language switch, for the same reason, and it is the one
 * thing on this menu that has to RELOAD: the menu, its strings and all its art were built from
 * the install that is mounted now, and only the boot path can mount another one.
 */
function createChangeInstall(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "change-install";
  btn.textContent = t("menu.changeInstall");
  btn.title = t("menu.changeInstallTip");
  btn.onclick = (): void => void changeInstall();
  return btn;
}

async function changeInstall(): Promise<void> {
  if (isDesktopApp()) {
    // The shell remembers the folder it was given (electron/main.mjs `ow3:install-pick`), so
    // the reload after a successful pick finds the new one with no further help.
    if (await pickNativeInstall()) window.location.reload();
    return;
  }
  try {
    if (!(await pickInstall())) return; // cancelled: nothing to say, the old install stays mounted
  } catch (err) {
    console.warn("[Warcraft Open] the picked folder could not be read:", err);
    return;
  }
  // "Download game files" leaves a copy in OPFS that the gate mounts before asking
  // (ui/gate.ts). The folder just chosen is the one the player means, so the copy goes.
  await forgetStoredInstall();
  // `?dev` (and the chapter it may name) pins the install to the one the dev server serves, so
  // the boot would ignore the folder just picked. It comes off here — the picked folder is the
  // whole point of the click. The language choice is a URL one too, and it stays.
  const next = new URL(location.href);
  next.searchParams.delete("dev");
  next.searchParams.delete("chapter");
  location.assign(next.toString());
}

/**
 * Online and the realm button beside it (MainMenu.fdf's `BattleNetButton` and its
 * `RealmButton`, the magnifying glass), greyed out: there is no online service behind them
 * yet. Disabled rather than hidden, so the chain keeps the reference's shape, and each wears
 * its own FDF `ControlDisabledBackdrop` — `setEnabled` also makes the click and the N
 * accelerator do nothing (ui/fdf/render.ts `wireButton`).
 */
const OFFLINE_BUTTONS = ["BattleNetButton", "RealmButton"];

/** MainMenuFrame with the version line added as a direct child — which also makes it one of
 *  the screen's PANELS, so it fades in and out with everything else on it. */
function buildMainMenuRoot(lib: FdfLibrary): FdfFrame {
  const root = lib.resolveRoot("MainMenuFrame");
  if (!root) throw new Error("MainMenu.fdf: no MainMenuFrame frame");

  wearOtherEdition(root);

  // "Local Area Network" is "Multiplayer": the relay-backed game list (docs/multiplayer.md)
  // reaches past the local network, so the 2003 name says the wrong thing. The caption and its
  // letter are the game's OWN — GlobalStrings.fdf ships `KEY_MULTIPLAYER`
  // ("|CffffffffM|Rultiplayer") with `KEY_MULTIPLAYER_SHORTCUT` "M" beside it — so the frame is
  // simply pointed at those keys, and the gilded letter and the accelerator move together.
  setProp(findFrame(root, "LocalAreaNetworkButtonText"), "Text", [str("KEY_MULTIPLAYER")]);
  setProp(findFrame(root, "LocalAreaNetworkButton"), "ControlShortcutKey", [str("KEY_MULTIPLAYER_SHORTCUT")]);

  return root;
}

/**
 * THE EDITION BUTTON shows the edition it takes you TO. MainMenu.fdf dresses `EditionButton` in
 * `UI\Widgets\Glues\GlueScreen-ROC-EditionButton-{up,down,disabled}.blp` — the Reign of Chaos
 * emblem, on the expansion's menu, because pressing it goes there — and the install ships the
 * `-TFT-` twin of all three for the other way round. The file is the expansion's, so on a Reign
 * of Chaos menu its three backdrops are pointed at the twin.
 */
function wearOtherEdition(frame: FdfFrame): void {
  if (isRoc() && frame.name.startsWith("EditionButton")) {
    frame.props = frame.props.map((p) => ({
      key: p.key,
      args: p.args.map((a) => (a.str ? { ...a, s: a.s.replace(/-ROC-EditionButton/i, "-TFT-EditionButton") } : a)),
    }));
  }
  for (const child of frame.children) wearOtherEdition(child);
}
