import { pickInstall, readInstallDir, rememberedInstallHandle, anyRememberedInstallHandle, requestPersistence, type DirHandle, type PickedInstall } from "../assets/opfs";
import { storedInstall } from "../assets/downloadInstall";
import { isDesktopApp, loadNativeInstall, pickNativeInstall, rememberedInstall } from "../assets/nativeInstall";
import { loadProfile } from "../vfs/loader";
import { wrongVersionMessage } from "../vfs/version";
import { DEFAULT_PROFILE } from "../vfs/profiles";
import type { DataSource } from "../vfs/types";
import { t } from "../i18n";
import { createLanguagePicker } from "../i18n/switch";
import { bindHotkeys, createGlueButton, createPanel, createProgressBar } from "@warcraft-open/ui/dom";

// The load-files gate (issue #54). WC3's menus are constructed from the game's own
// UI\FrameDef\*.fdf files and textures, so the install must be mounted before the
// main menu can exist. We therefore prompt for the game folder first, up front —
// a single button in the centre of the screen — and hand the mounted VFS back so
// the caller can build the FDF main menu and continue automatically.
//
// The DESKTOP app asks once and then never again (src/assets/nativeInstall.ts): the folder is
// remembered by the shell, so a launch that already knows where it is puts up nothing to press
// and goes straight to the menu. That is a real difference in kind, not a saved click — a game
// you install does not ask you where it is every time you start it. What is left of this screen
// there is the FIRST run, and the day the folder moves.
//
// There are no FrameDef files to build THIS screen from — it is what reads them — so it is dressed
// in the shared UI kit instead (packages/ui, the same glue button, Human panel and loading bar the
// landing page wears), drawn from scratch with colours sampled off the install's own BLPs.

export interface GateLoad {
  vfs: DataSource;
  mounted: string[];
  missing: string[];
  fileCount: number;
  /** The install's `Maps\` folder — what the Custom Game screen lists (issue #61). */
  maps: Map<string, File>;
}

export interface LoadGate {
  dispose(): void;
}

export interface GateOptions {
  /** Mount a remembered install by itself at boot (the ordinary launch). `false` is the MAIN
   *  MENU's Quit, which asks for this screen as the place to be, not to be carried past it: the
   *  same install is still one press away, on the button. */
  auto?: boolean;
}

export function mountLoadGate(
  root: HTMLElement,
  onLoaded: (r: GateLoad) => void,
  opts: GateOptions = {},
): LoadGate {
  const native = isDesktopApp();
  const auto = opts.auto !== false;
  const gate = document.createElement("div");
  gate.className = "launcher";

  // The battle-platform frame this screen wears: a wide scenic backdrop, a top bar with the
  // platform's name and the language to speak, then a hero that says what to do and a card that
  // says what the player is about to agree to. The portable half of a launcher — the bit that
  // matters before any game files are mounted — is that the way IN is one obvious button.
  const backdrop = document.createElement("div");
  backdrop.className = "launcher-backdrop";
  backdrop.setAttribute("aria-hidden", "true");

  const top = document.createElement("header");
  top.className = "launcher-top";
  const brand = document.createElement("div");
  brand.className = "launcher-brand";
  const mark = document.createElement("span");
  mark.className = "launcher-mark";
  mark.setAttribute("aria-hidden", "true");
  const name = document.createElement("h1");
  name.className = "launcher-name";
  name.textContent = t("app.title");
  const tagline = document.createElement("p");
  tagline.className = "launcher-tagline";
  tagline.textContent = t("gate.tagline");
  const nameBox = document.createElement("div");
  nameBox.className = "launcher-name-box";
  nameBox.append(name, tagline);
  brand.append(mark, nameBox);
  top.append(brand, createLanguagePicker());

  const hero = createPanel("section", "launcher-hero");
  const kicker = document.createElement("p");
  kicker.className = "launcher-kicker";
  kicker.textContent = t("gate.edition");
  const headline = document.createElement("h2");
  headline.className = "launcher-headline";
  headline.textContent = t("gate.headline");

  const sub = document.createElement("p");
  sub.className = "launcher-lead";
  // "Required", not "recommended": the version is a gate now (src/vfs/version.ts), and a screen
  // that suggests where the game refuses is a screen that reads as broken.
  sub.textContent = t(native ? "gate.subtitleNative" : "gate.subtitleBrowser");

  /** What the button says when it is not busy. The desktop app changes it once — a player who
   *  is being asked a SECOND time is choosing a folder, not loading files — so a failure has to
   *  restore this rather than the original wording. */
  let idleLabel = t("gate.load");
  const btn = createGlueButton({ label: idleLabel, hotkey: "L", size: "lg", bordered: true });

  // The bar takes the buttons' place while the install mounts: there is nothing left to press,
  // and the mount is the one wait on this screen worth watching.
  const bar = createProgressBar({ scale: 1.5 });
  bar.root.classList.add("launcher-progress");
  bar.root.hidden = true;

  const actions = document.createElement("div");
  actions.className = "launcher-actions";
  actions.append(btn.root);

  // "Download game files": the player has no folder on this machine to pick. The launcher does
  // not fetch anything itself any more — it POINTS at the two editions, which live on 139 cloud,
  // and the player downloads the one whose language they want. The links open in the system
  // browser (electron/main.mjs hands window.open to the shell), so a 100 MB+ transfer is not
  // something this page has to hold in storage.
  const dlZh = createGlueButton({ label: t("gate.downloadZh"), size: "lg" });
  const dlEn = createGlueButton({ label: t("gate.downloadEn"), size: "lg" });
  for (const [btnEl, url] of [
    [dlZh.root, "https://yun.139.com/shareweb/#/w/i/2yA8ERhQm6xrv"],
    [dlEn.root, "https://yun.139.com/shareweb/#/w/i/2yA8E5et3Msmh"],
  ] as const) {
    btnEl.classList.add("launcher-download");
    btnEl.onclick = (): void => void window.open(url, "_blank", "noopener");
    actions.append(btnEl);
  }

  const dlHint = document.createElement("p");
  dlHint.className = "launcher-download-hint";
  dlHint.textContent = t("gate.downloadHint");

  const status = document.createElement("p");
  status.className = "launcher-status";

  /** While the install mounts the bar stands where the buttons were: there is nothing left to
   *  press, and the mount is the one wait on this screen worth watching. */
  const showBar = (on: boolean): void => {
    bar.root.hidden = !on;
    btn.root.hidden = on;
    for (const el of [dlZh.root, dlEn.root, dlHint]) el.hidden = on;
  };

  const fail = (msg: string): void => {
    showBar(false);
    status.textContent = msg;
    status.classList.add("error");
    btn.setDisabled(false);
    btn.setLabel(idleLabel);
  };

  /** Mount whatever was picked and hand it on. Shared by both doors, because past the picking
   *  there is no difference between them: a `PickedInstall` is a `PickedInstall`. */
  const mount = async (install: PickedInstall): Promise<void> => {
    btn.setDisabled(true);
    status.textContent = "";
    status.classList.remove("error");
    bar.set(null);
    // One line for the whole wait. The mount narrates itself stage by stage (which archive,
    // the content index, a percentage) and that is a developer's reading, not a player's: what a
    // player needs from this screen is "it is loading", then "it loaded" — or, in red, why not.
    bar.setLabel(t("gate.loading"));
    showBar(true);
    try {
      // Browser only: the desktop app reads the folder off disk and has no quota to be evicted
      // from, which is the other half of why the export is native.
      if (!native) await requestPersistence();
      // A CASC mount reads a few hundred megabytes off disk before the first file can be
      // asked for (vfs/casc.ts), so it reports as it goes rather than sitting mute — and says
      // how far through it is once it knows, which is what the bar draws.
      const load = await loadProfile(install, DEFAULT_PROFILE, (_msg, fraction) => bar.set(fraction ?? null));
      bar.set(1);
      bar.setLabel(t("gate.loaded"));
      // Let the full bar and that line reach the screen and be READ first: building the menu
      // holds the main thread, and whatever frame was painted last is what the player looks at
      // until it lets go — a confirmation shown for one frame is a confirmation nobody saw.
      await new Promise((r) => setTimeout(r, 600));
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r)));
      onLoaded(load);
    } catch (err) {
      fail(t("gate.loadFailed", { error: (err as Error).message }));
    }
  };

  /** A folder this origin picked before, whose grant did not survive a reload (assets/opfs.ts).
   *  The click below is the gesture that can ask for it back. */
  let rememberedHandle: DirHandle | null = null;
  /** A copy an earlier "Download game files" left in this origin (assets/downloadInstall.ts).
   *  Only handed over when the gate was asked NOT to mount by itself (the menu's Quit), so the
   *  press below opens the same install instead of a folder a downloaded copy never had. */
  let stored: PickedInstall | null = null;

  btn.button.onclick = async (): Promise<void> => {
    status.classList.remove("error");
    if (native) {
      // The shell's own folder dialog, and it refuses a folder that is not an install before
      // anything is mounted — so "that is not it" arrives at the moment of choosing.
      const path = await pickNativeInstall();
      if (!path) { status.textContent = t("gate.noWar3Folder"); return; }
      return mount(await loadNativeInstall());
    }
    // A remembered folder is re-granted from THIS click rather than found again by a second
    // dialog — the same folder the player had, not the same question twice. It outranks a copy
    // an earlier "Download game files" left in this origin: the folder is the thing the player
    // keeps and edits (a fixed map, a translation), and mounting the snapshot instead would make
    // every one of those edits invisible for good.
    if (rememberedHandle) {
      const handle = rememberedHandle;
      rememberedHandle = null;
      const allowed = (await handle.requestPermission?.({ mode: "read" })) ?? "granted";
      if (allowed === "granted") {
        try {
          return mount(await readInstallDir(handle));
        } catch (err) {
          fail(t("gate.loadFailed", { error: (err as Error).message }));
          return;
        }
      }
    }
    // Only when there is no folder to go back to: the copy a download left behind, then asking.
    if (stored) {
      const install = stored;
      stored = null;
      return mount(install);
    }
    const install = await pickInstall();
    if (!install) { status.textContent = t("gate.noFolder"); return; }
    return mount(install);
  };

  hero.append(kicker, headline, sub, actions, bar.root, dlHint, status);

  // What the player is agreeing to, on the side the way a launcher's patch notes sit: the
  // privacy line is the one thing here that is not obvious from the buttons.
  const side = createPanel("section", "launcher-side");
  const sideTitle = document.createElement("h3");
  sideTitle.className = "launcher-side-title";
  sideTitle.textContent = t("gate.before");
  const points = document.createElement("ul");
  points.className = "launcher-points";
  for (const text of [
    t("gate.pointLocal"),
    t("gate.pointVersion"),
    t("gate.pointPlay"),
  ]) {
    const item = document.createElement("li");
    item.textContent = text;
    points.append(item);
  }
  side.append(sideTitle, points);

  const foot = document.createElement("footer");
  foot.className = "launcher-foot";
  foot.textContent = t("gate.footer");

  const stage = document.createElement("main");
  stage.className = "launcher-stage";
  stage.append(hero, side);

  gate.append(backdrop, top, stage, foot);
  root.appendChild(gate);
  const unbindHotkeys = bindHotkeys(gate);

  // The desktop app's ordinary launch: it already knows where the install is, so nothing here is
  // ever seen — this screen exists for the first run and for the day the folder moves.
  if (native) {
    btn.setDisabled(true);
    void rememberedInstall().then(async ({ path, valid, present, version }) => {
      if (valid) return mount(await loadNativeInstall());
      // A remembered folder that cannot be used is NAMED, and named for the right reason:
      // "pick your folder again" with no explanation is the same screen as a first run, and a
      // folder that is still exactly where it was but has been PATCHED is not a folder that
      // moved. The game checks the version at every launch (src/vfs/version.ts), so this is the
      // screen a player who updated Warcraft III between sessions arrives at.
      if (path) idleLabel = t("gate.chooseFolder");
      btn.setDisabled(false);
      btn.setLabel(idleLabel);
      if (path && !present) fail(t("gate.folderMissing", { path }));
      else if (path) fail(wrongVersionMessage(version));
    });
  }

  // The browser's twin of that: a copy an earlier in-app download left in this origin's storage
  // is this browser's install, so it is mounted without asking — the same as the desktop app's
  // remembered folder, and for the same reason. Downloads are links to the cloud now, but a copy
  // from before that change is still the player's install and must not be orphaned. A FOLDER
  // picked last visit (IndexedDB, assets/opfs.ts) comes second: "Change Game Folder" on the menu
  // is that pick plus a reload, and this is the boot that has to honour it.
  if (!native) {
    btn.setDisabled(true);
    void (async () => {
      const install = await storedInstall();
      if (install) {
        if (auto) return mount(install);
        stored = install; // the press below opens it — this screen is where the player asked to be
        btn.setDisabled(false);
        return;
      }
      const remembered =
        (await rememberedInstallHandle()) ?? (await anyRememberedInstallHandle());
      if (remembered) {
        const allowed = (await remembered.queryPermission?.({ mode: "read" })) ?? "granted";
        if (allowed === "granted") {
          try {
            if (auto) return mount(await readInstallDir(remembered));
          } catch (err) {
            console.warn("[Warcraft Open] the remembered install could not be read:", err);
          }
        }
        // Restored in a new session: the click below is the gesture that can ask again.
        rememberedHandle = remembered;
      }
      btn.setDisabled(false);
    })();
  }

  return {
    dispose: () => {
      unbindHotkeys();
      gate.remove();
    },
  };
}
