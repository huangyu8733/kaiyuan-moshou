import type { AssetResolver } from "../assets/resolver";
import { pickInstall, requestPersistence } from "../assets/opfs";
import { loadProfile } from "../vfs/loader";
import { DEFAULT_PROFILE } from "../vfs/profiles";
import { t, type MessageKey } from "../i18n";
import { createLanguageSwitch } from "../i18n/switch";

// Main-menu shell (plan §10.1, §10.4). Layout/logic is our own code as HTML/CSS;
// the 3D background renders behind it. Flat skin with no assets; once an install
// is imported (Phase 1) layout switches to derive from MainMenu.fdf for fidelity.
//
// This is the ZERO-ASSET fallback menu (main.ts mounts it when the install has no glue FDFs).
// Captions are i18n keys, not literals, because this screen is entirely ours — see src/i18n/.
//
// Button set per §10.1 — note "Battle.net" is intentionally renamed "Online":
// Warcraft Open multiplayer targets our own server, not Blizzard's Battle.net.
const BUTTONS = [
  "menu.singlePlayer",
  "menu.online",
  "menu.multiplayer", // the game's "Local Area Network" — see ui/fdfMainMenu.ts
  "menu.options",
  "menu.credits",
] as const satisfies readonly MessageKey[];

export interface MenuHandlers {
  /** Start the Single Player flow (map picker → game-setup lobby). */
  onSinglePlayer?: () => void;
}

export function mountMainMenu(
  root: HTMLElement,
  resolver: AssetResolver,
  handlers: MenuHandlers = {},
): void {
  const panel = document.createElement("div");
  panel.className = "menu-panel";

  const title = document.createElement("h1");
  title.className = "menu-title";
  title.textContent = t("app.title");
  panel.appendChild(title);

  const status = document.createElement("p");
  status.className = "menu-status";
  status.textContent = resolver.hasInstall ? t("menu.installLoaded") : t("menu.noInstall");

  for (const label of BUTTONS) {
    panel.appendChild(
      makeButton(t(label), () => onSelect(label, handlers, status)),
    );
  }

  const quit = makeButton(t("menu.quit"), () => window.close());
  quit.classList.add("menu-quit");
  panel.appendChild(quit);

  status.onclick = () => importInstall(resolver, status);
  panel.appendChild(status);

  root.appendChild(panel);
  root.appendChild(createLanguageSwitch());
}

async function importInstall(resolver: AssetResolver, status: HTMLElement): Promise<void> {
  const install = await pickInstall();
  if (!install) return;
  status.textContent = t("menu.loadingArchives");
  try {
    await requestPersistence();
    const { vfs, mounted, missing, fileCount } = await loadProfile(install, DEFAULT_PROFILE, (msg) => {
      status.textContent = msg;
    });
    resolver.setInstall(vfs);
    // Expose the mounted VFS so files can be enumerated/extracted by path from
    // the console — the Phase 1 exit criterion (plan §1).
    ((window as unknown as { warcraftOpen: Record<string, unknown> }).warcraftOpen ??= {}).vfs = vfs;
    status.textContent =
      t("menu.mounted", { profile: DEFAULT_PROFILE.name, mounted: mounted.join(", ") }) +
      (missing.length ? t("menu.missing", { missing: missing.join(", ") }) : "") +
      t("menu.fileCount", { count: fileCount.toLocaleString() });
  } catch (err) {
    status.textContent = t("menu.importFailed", { error: (err as Error).message });
  }
}

function onSelect(label: MessageKey, handlers: MenuHandlers, _status: HTMLElement): void {
  // Single Player opens the map picker → game-setup lobby (Phase 5.5). Other
  // screens (Online lobby, Options...) arrive with later phases.
  if (label === "menu.singlePlayer" && handlers.onSinglePlayer) {
    handlers.onSinglePlayer();
    return;
  }
  console.log(`[Warcraft Open] menu: ${label}`);
}

function makeButton(label: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = "menu-button";
  btn.textContent = label;
  btn.onclick = onClick;
  return btn;
}
