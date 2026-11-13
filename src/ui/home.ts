import { bindHotkeys, createGlueButton, createPanel, createProgressBar, type GlueButton } from "@openwar3/ui/dom";
import { currentLocale, t } from "../i18n";
import { createLanguagePicker } from "../i18n/switch";
import { safeMapName } from "../assets/downloadedMaps";
import {
  deleteDownloadedMap, downloadedMapExists, isDesktopApp, listDownloadedMaps, loadNativeInstall,
  pickNativeInstall, quitNative, rememberedInstall, saveMapToDownload,
  type DownloadedMap, type InstalledFolder,
} from "../assets/nativeInstall";
import { DEFAULT_PROFILE } from "../vfs/profiles";
import { loadProfile } from "../vfs/loader";
import { wrongVersionMessage } from "../vfs/version";
import type { GateLoad } from "./gate";

// The DESKTOP app's front page: the same shell as the site (top bar, side nav, hero, footer),
// with three views of its own — Launch, Maps and About. They are PAGES, not sections stacked
// under the hero: the launch screen is the game's front door, and the shelves live behind the
// nav. There is deliberately no "download the game" block: a shipped app already is the game.
//
// The map page reads the site's public map API and saves straight into the install's
// `Maps\Download\`, through the shell (`ow3native.saveMap`). A map service that is down or not
// configured only empties that page; starting the game never waits for it.

export interface Home {
  dispose(): void;
}

interface SiteMap {
  slug: string;
  name: string;
  description: string;
  coverUrl: string | null;
  fileSize: number | null;
  version: string | null;
  author: string | null;
  players: string | null;
  category: string;
  updatedAt: string;
  fileName: string;
  downloadUrl: string | null;
}

/** The site this build reads maps from. A packaged build must set `VITE_OPENWAR3_SITE_URL`;
 *  a dev server falls back to the local site so the shelf works out of the box. */
const SITE = (
  (import.meta.env.VITE_OPENWAR3_SITE_URL as string | undefined) ??
  (import.meta.env.DEV ? "http://localhost:3000" : "")
).replace(/\/+$/, "");

const siteLocale = (): string => (currentLocale() === "zhCN" ? "zh" : "en");

function formatBytes(value: number | null): string {
  if (!value || value <= 0) return "";
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}

export function mountHome(root: HTMLElement, onLoaded: (load: GateLoad) => void): Home {
  const abort = new AbortController();
  let busy = false;
  let install: InstalledFolder = { path: null, valid: false, present: false, version: null };
  /** What the map page last read, so a detail route can be opened without another request. */
  let loadedMaps: SiteMap[] = [];
  /** Maps already kept in the install's `Maps\Download\`, by slug — the shelf's "downloaded". */
  const downloaded = new Set<string>();
  const cardViews = new Map<string, { badge: HTMLElement; button: GlueButton }>();
  let detailSlug: string | null = null;
  let detailButton: GlueButton | null = null;
  let detailBadge: HTMLElement | null = null;

  const page = document.createElement("div");
  page.className = "home";

  const shell = document.createElement("div");
  shell.className = "home-shell";

  // ── Top bar ───────────────────────────────────────────────────────────────
  const topbar = document.createElement("header");
  topbar.className = "home-topbar";
  const brand = document.createElement("a");
  brand.className = "home-brand";
  brand.href = "#/";
  const brandLogo = document.createElement("img");
  brandLogo.src = "/brand-logo.png";
  brandLogo.alt = t("app.title");
  brandLogo.draggable = false;
  brand.append(brandLogo);

  const navItems: Array<{ href: string; key: "home.navHome" | "home.navMaps" | "home.navAbout"; view: View }> = [
    { href: "#/", key: "home.navHome", view: "home" },
    { href: "#/maps", key: "home.navMaps", view: "maps" },
    { href: "#/about", key: "home.navAbout", view: "about" },
  ];

  const topnav = document.createElement("nav");
  topnav.className = "home-topnav";
  const topLinks: HTMLAnchorElement[] = [];
  for (const item of navItems) {
    const a = document.createElement("a");
    a.href = item.href;
    a.textContent = t(item.key);
    topnav.append(a);
    topLinks.push(a);
  }

  const topActions = document.createElement("div");
  topActions.className = "home-topbar-actions";
  topActions.append(createLanguagePicker());
  topbar.append(brand, topnav, topActions);

  // ── Body: side nav + content ──────────────────────────────────────────────
  const body = document.createElement("div");
  body.className = "home-body";

  const side = document.createElement("aside");
  side.className = "home-sidenav";
  const sideList = document.createElement("ul");
  const sideLinks: HTMLAnchorElement[] = [];
  for (const item of navItems) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = item.href;
    a.textContent = t(item.key);
    li.append(a);
    sideList.append(li);
    sideLinks.push(a);
  }
  side.append(sideList);

  // Sign-in, pinned to the bottom of the same rail and wearing the same clothes as its links.
  const sideLogin = document.createElement("button");
  sideLogin.type = "button";
  sideLogin.className = "home-sidenav-login";
  sideLogin.textContent = t("home.login");
  side.append(sideLogin);

  const main = document.createElement("main");
  main.className = "home-main";

  // ── Launch page (hero only) ───────────────────────────────────────────────
  const hero = document.createElement("section");
  hero.className = "home-hero";
  const heroBg = document.createElement("div");
  heroBg.className = "home-hero-bg";
  heroBg.setAttribute("aria-hidden", "true");
  const heroBgImg = document.createElement("img");
  heroBgImg.src = "/media/game2.avif";
  heroBgImg.alt = "";
  heroBgImg.draggable = false;
  heroBg.append(heroBgImg);

  const heroContent = document.createElement("div");
  heroContent.className = "home-hero-content";
  const kicker = document.createElement("p");
  kicker.className = "home-hero-kicker";
  kicker.textContent = t("home.kicker");
  const logo = document.createElement("img");
  logo.className = "home-hero-logo";
  logo.src = "/hero-logo.avif";
  logo.alt = t("app.title");
  logo.draggable = false;
  const tagline = document.createElement("p");
  tagline.className = "home-hero-tagline";
  tagline.textContent = t("home.tagline");
  const lede = document.createElement("p");
  lede.className = "home-hero-lede";
  lede.textContent = t("home.lede");

  const actions = document.createElement("div");
  actions.className = "home-actions";
  const playBtn = createGlueButton({ label: t("home.play"), hotkey: "P", size: "lg", bordered: true });
  const changeBtn = createGlueButton({ label: t("home.changeFolder"), size: "lg" });
  actions.append(playBtn.root, changeBtn.root);

  const installLine = document.createElement("p");
  installLine.className = "home-install";

  const bar = createProgressBar({ scale: 1.4 });
  bar.root.classList.add("home-progress");
  bar.root.hidden = true;

  const status = document.createElement("p");
  status.className = "home-status";

  heroContent.append(kicker, logo, tagline, lede, actions, installLine, bar.root, status);
  hero.append(heroBg, heroContent);

  // ── Maps page ─────────────────────────────────────────────────────────────
  const mapsView = document.createElement("section");
  mapsView.className = "home-page";
  const mapsHead = document.createElement("div");
  mapsHead.className = "home-section-head";
  const mapsTitle = document.createElement("h1");
  mapsTitle.textContent = t("home.maps");
  mapsHead.append(mapsTitle);

  // Two shelves behind one page: the library (what the site offers) and what this install
  // already keeps in `Maps\Download\`.
  const mapsTabs = document.createElement("div");
  mapsTabs.className = "home-map-tabs";
  const libraryTab = document.createElement("button");
  libraryTab.type = "button";
  libraryTab.className = "home-map-tab is-active";
  libraryTab.textContent = t("home.library");
  const installedTab = document.createElement("button");
  installedTab.type = "button";
  installedTab.className = "home-map-tab";
  installedTab.textContent = t("home.installed");
  mapsTabs.append(libraryTab, installedTab);

  const libraryPane = document.createElement("div");
  libraryPane.className = "home-map-pane";
  const toolbar = document.createElement("div");
  toolbar.className = "home-map-toolbar";
  const search = document.createElement("input");
  search.type = "search";
  search.className = "home-map-search";
  search.placeholder = t("home.searchPlaceholder");
  search.setAttribute("aria-label", t("home.search"));
  const chips = document.createElement("div");
  chips.className = "home-map-chips";
  toolbar.append(search, chips);
  const mapsBody = document.createElement("div");
  mapsBody.className = "home-map-grid";
  libraryPane.append(toolbar, mapsBody);

  const installedPane = document.createElement("div");
  installedPane.className = "home-map-pane";
  const installedBody = document.createElement("div");
  installedBody.className = "home-installed";
  installedPane.append(installedBody);
  installedPane.hidden = true;

  mapsView.append(mapsHead, mapsTabs, libraryPane, installedPane);

  // ── About page ────────────────────────────────────────────────────────────
  const aboutView = document.createElement("section");
  aboutView.className = "home-page";
  const aboutTitle = document.createElement("h1");
  aboutTitle.textContent = t("home.about");
  const aboutText = document.createElement("p");
  aboutText.className = "home-page-text";
  aboutText.textContent = t("home.aboutText");
  aboutView.append(aboutTitle, aboutText);

  // ── Map detail page (#/maps/<slug>) — the site's detail, with a launcher download ──
  const detailView = document.createElement("section");
  detailView.className = "home-page";
  const back = document.createElement("a");
  back.className = "home-back";
  back.href = "#/maps";
  back.textContent = t("home.back");
  const detailGrid = document.createElement("div");
  detailGrid.className = "home-detail";
  const detailCover = document.createElement("div");
  detailCover.className = "home-detail-cover";
  const detailIntro = document.createElement("div");
  detailIntro.className = "home-detail-intro";
  const detailTitle = document.createElement("h1");
  const detailTitleRow = document.createElement("div");
  detailTitleRow.className = "home-detail-title";
  detailBadge = document.createElement("span");
  detailBadge.className = "home-downloaded-badge";
  detailBadge.textContent = t("home.downloadedBadge");
  detailBadge.hidden = true;
  detailTitleRow.append(detailTitle, detailBadge);
  const detailMeta = document.createElement("dl");
  detailMeta.className = "home-meta-list";
  const detailActions = document.createElement("div");
  detailActions.className = "home-detail-actions";
  detailIntro.append(detailTitleRow, detailMeta, detailActions);
  detailGrid.append(detailCover, detailIntro);

  const detailBody = createPanel("section", "home-detail-body");
  const detailBodyTitle = document.createElement("h2");
  detailBodyTitle.textContent = t("home.mapDetail");
  const detailDesc = document.createElement("p");
  detailDesc.className = "home-detail-desc";
  detailBody.append(detailBodyTitle, detailDesc);

  detailView.append(back, detailGrid, detailBody);

  main.append(hero, mapsView, aboutView, detailView);
  body.append(side, main);

  shell.append(topbar, body);
  page.append(shell);
  root.append(page);
  const unbindHotkeys = bindHotkeys(page);

  // A line that belongs to no single page: map downloads report here from the shelf and the
  // detail page alike, where the hero's own status line is not on screen.
  const toast = document.createElement("div");
  toast.className = "home-toast";
  toast.hidden = true;
  page.append(toast);
  let toastTimer = 0;
  const showToast = (text: string, error = true): void => {
    toast.textContent = text;
    toast.classList.toggle("is-error", error);
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { toast.hidden = true; }, 5000);
  };

  // The launch page's exit, bottom right. Sign-in sits at the foot of the left rail instead.
  // Exit is the shell's — macOS keeps an app alive with no windows, so closing the window is not
  // the same as quitting it.
  sideLogin.onclick = (): void => showToast(t("home.comingSoon"), false);
  const corner = document.createElement("div");
  corner.className = "home-corner";
  const quitBtn = createGlueButton({ label: t("home.quitApp"), size: "md", bordered: true });
  quitBtn.button.onclick = (): void => quitNative();
  corner.append(quitBtn.root);
  page.append(corner);

  // ── Install state ─────────────────────────────────────────────────────────
  const paintInstall = (): void => {
    installLine.classList.toggle("is-error", !!install.path && !install.valid);
    if (!install.path) {
      installLine.textContent = t("home.folderNone");
    } else if (install.valid) {
      installLine.textContent = t("home.folder", { version: install.version ?? "", path: install.path });
    } else if (!install.present) {
      installLine.textContent = t("home.folderMissing", { path: install.path });
    } else {
      installLine.textContent = wrongVersionMessage(install.version);
    }
  };

  const setStatus = (text: string, error = false): void => {
    status.textContent = text;
    status.classList.toggle("is-error", error);
  };

  const refreshInstall = async (): Promise<void> => {
    install = await rememberedInstall();
    paintInstall();
    // A different folder has different maps in its `Maps\Download\`: forget the old answers and
    // ask again for whatever the shelf is showing.
    downloaded.clear();
    for (const map of loadedMaps) applyDownloadState(map);
    void refreshDownloaded();
  };

  const setBusy = (on: boolean): void => {
    busy = on;
    playBtn.setDisabled(on);
    changeBtn.setDisabled(on);
  };

  const start = async (): Promise<void> => {
    if (busy) return;
    if (!install.valid) {
      // A first run (or a folder that moved): the press below IS the folder choice.
      const picked = await pickNativeInstall();
      if (!picked) {
        setStatus(t("gate.noWar3Folder"), true);
        return;
      }
      await refreshInstall();
      if (!install.valid) {
        setStatus(install.present ? wrongVersionMessage(install.version) : t("home.folderMissing", { path: install.path ?? picked }), true);
        return;
      }
    }

    setBusy(true);
    setStatus("");
    bar.set(null);
    bar.setLabel(t("gate.loading"));
    bar.root.hidden = false;
    try {
      const load = await loadProfile(await loadNativeInstall(), DEFAULT_PROFILE, (_message, fraction) => bar.set(fraction ?? null));
      bar.set(1);
      bar.setLabel(t("gate.loaded"));
      // Let the full bar be READ before the menu build holds the main thread.
      await new Promise((r) => setTimeout(r, 600));
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r)));
      onLoaded(load);
    } catch (err) {
      bar.root.hidden = true;
      setBusy(false);
      setStatus(t("home.loadFailed", { error: (err as Error).message }), true);
    }
  };

  const changeFolder = async (): Promise<void> => {
    if (busy) return;
    const picked = await pickNativeInstall();
    if (!picked) return;
    await refreshInstall();
    if (install.valid) setStatus(t("home.folderChanged", { path: install.path ?? picked }));
    else setStatus(install.present ? wrongVersionMessage(install.version) : t("home.folderMissing", { path: install.path ?? picked }), true);
  };

  playBtn.button.onclick = (): void => void start();
  changeBtn.button.onclick = (): void => void changeFolder();

  // ── Map shelf ─────────────────────────────────────────────────────────────
  const message = (text: string, retry = false): void => {
    mapsBody.replaceChildren();
    const box = document.createElement("p");
    box.className = "home-empty";
    box.textContent = text;
    if (retry) {
      const again = document.createElement("button");
      again.type = "button";
      again.className = "home-empty-retry";
      again.textContent = t("home.mapsRetry");
      again.onclick = (): void => void loadMaps();
      box.append(" ", again);
    }
    mapsBody.append(box);
  };

  /** Paint one map's "already downloaded" state wherever it is on screen: its shelf card and,
   *  when it is the open detail page, that page's badge and button wording. */
  const applyDownloadState = (map: SiteMap): void => {
    const is = downloaded.has(map.slug);
    const view = cardViews.get(map.slug);
    if (view) {
      view.badge.hidden = !is;
      if (!view.button.button.disabled) view.button.setLabel(is ? t("home.redownload") : t("home.download"));
    }
    if (detailSlug === map.slug) {
      if (detailBadge) detailBadge.hidden = !is;
      if (detailButton && !detailButton.button.disabled) {
        detailButton.setLabel(is ? t("home.redownload") : t("home.download"));
      }
    }
  };

  /** Ask the shell which of the shelf's maps are already in `Maps\Download\`. */
  const refreshDownloaded = async (): Promise<void> => {
    if (!install.valid) return;
    await Promise.all(loadedMaps.map(async (map) => {
      const name = safeMapName(map.fileName);
      if (!name) return;
      if (await downloadedMapExists(name)) downloaded.add(map.slug);
      applyDownloadState(map);
    }));
  };

  const downloadMap = async (map: SiteMap, btn: GlueButton): Promise<void> => {
    if (!install.valid) {
      showToast(t("home.pickFirst"));
      return;
    }
    if (!map.downloadUrl) {
      showToast(t("home.mapNoFile", { name: map.name }));
      return;
    }
    btn.setDisabled(true);
    btn.setLabel(t("home.downloading"));
    try {
      const res = await fetch(map.downloadUrl, { signal: abort.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      const name = safeMapName(map.fileName);
      if (!name) throw new Error(`unusable file name: ${map.fileName}`);
      await saveMapToDownload(name, bytes);
      // The map's own dictionary, in the language this app is speaking. It sits beside the map
      // on OSS under the same name plus the locale; a map that has no file for this language
      // simply keeps its author's words, so a 404 here is normal and never fails the download.
      const locale = currentLocale();
      try {
        const sidecar = await fetch(`${map.downloadUrl}?lang=${locale}`, { signal: abort.signal });
        if (sidecar.ok) {
          await saveMapToDownload(`${name}.${locale}.json`, new Uint8Array(await sidecar.arrayBuffer()));
        }
      } catch (err) {
        if (abort.signal.aborted) return;
        console.warn("[OpenWar3] the map language file was not kept:", err);
      }
      // Re-enable it: the player can download again over the copy they have.
      btn.setDisabled(false);
      downloaded.add(map.slug);
      applyDownloadState(map);
    } catch (err) {
      if (abort.signal.aborted) return;
      btn.setDisabled(false);
      btn.setLabel(t("home.download"));
      showToast(t("home.mapFailed", { name: map.name, error: (err as Error).message }));
    }
  };

  const card = (map: SiteMap): HTMLElement => {
    const el = createPanel("article", "home-map-card");

    const cover = document.createElement("div");
    cover.className = "home-map-card-cover";
    if (map.coverUrl) {
      const img = document.createElement("img");
      img.src = map.coverUrl;
      img.alt = "";
      img.loading = "lazy";
      img.draggable = false;
      cover.append(img);
    } else {
      const placeholder = document.createElement("span");
      placeholder.className = "home-map-card-placeholder";
      placeholder.textContent = map.name.slice(0, 2);
      cover.append(placeholder);
    }
    const badge = document.createElement("span");
    badge.className = "home-downloaded-badge home-map-card-badge";
    badge.textContent = t("home.downloadedBadge");
    badge.hidden = !downloaded.has(map.slug);
    cover.append(badge);

    const bodyEl = document.createElement("div");
    bodyEl.className = "home-map-card-body";
    const title = document.createElement("h2");
    title.className = "home-map-card-title";
    title.textContent = map.name;
    bodyEl.append(title);

    if (map.description) {
      const desc = document.createElement("p");
      desc.className = "home-map-card-desc";
      desc.textContent = map.description;
      bodyEl.append(desc);
    }

    const meta = document.createElement("ul");
    meta.className = "home-map-card-meta";
    const facts = [map.players, map.version, formatBytes(map.fileSize)].filter((v): v is string => !!v);
    for (const fact of facts) {
      const li = document.createElement("li");
      li.textContent = fact;
      meta.append(li);
    }
    if (facts.length) bodyEl.append(meta);

    const cardActions = document.createElement("div");
    cardActions.className = "home-map-card-actions";
    if (SITE) {
      const detail = document.createElement("button");
      detail.type = "button";
      detail.className = "home-text-link";
      detail.textContent = t("home.detail");
      // In the launcher, not the browser: the shelf's own detail page.
      detail.onclick = (): void => { location.hash = `#/maps/${map.slug}`; };
      cardActions.append(detail);
    }
    if (map.downloadUrl) {
      const dl = createGlueButton({
        label: downloaded.has(map.slug) ? t("home.redownload") : t("home.download"),
        size: "md", bordered: true,
      });
      dl.root.classList.add("home-map-card-download");
      dl.button.onclick = (): void => void downloadMap(map, dl);
      cardActions.append(dl.root);
      cardViews.set(map.slug, { badge, button: dl });
    } else {
      const none = document.createElement("span");
      none.className = "home-map-card-nofile";
      none.textContent = t("home.noFile");
      cardActions.append(none);
    }

    bodyEl.append(cardActions);
    el.append(cover, bodyEl);
    return el;
  };

  // Category chips and the search box work on what is already loaded: the shelf asks the site
  // once, then filters in place (60 maps at most), so typing never waits for a round trip.
  let filterQuery = "";
  let filterCategory = "";
  const chipButtons: HTMLButtonElement[] = [];
  const chipsSpec: Array<[string, string]> = [
    ["", t("home.allCategories")],
    ["moba", t("home.catMoba")],
    ["hero-defense", t("home.catHeroDefense")],
    ["rpg", t("home.catRpg")],
    ["campaign", t("home.catCampaign")],
    ["melee", t("home.catMelee")],
    ["other", t("home.catOther")],
  ];
  for (const [key, label] of chipsSpec) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `home-map-chip${key === "" ? " is-active" : ""}`;
    chip.textContent = label;
    chip.onclick = (): void => {
      filterCategory = key;
      for (const [i, button] of chipButtons.entries()) button.classList.toggle("is-active", chipsSpec[i][0] === key);
      renderShelf();
    };
    chipButtons.push(chip);
    chips.append(chip);
  }
  search.addEventListener("input", (): void => {
    filterQuery = search.value;
    renderShelf();
  });

  /** Draw the shelf for the current search + category. */
  const renderShelf = (): void => {
    if (loadedMaps.length === 0) return;
    const needle = filterQuery.trim().toLowerCase();
    const visible = loadedMaps.filter((map) => {
      if (filterCategory && map.category !== filterCategory) return false;
      if (!needle) return true;
      return [map.name, map.description, map.author ?? ""]
        .some((text) => text.toLowerCase().includes(needle));
    });
    cardViews.clear();
    if (visible.length === 0) {
      message(t("home.noResults"));
      return;
    }
    mapsBody.replaceChildren(...visible.map(card));
  };

  const loadMaps = async (): Promise<void> => {
    if (!SITE) {
      message(t("home.mapsUnconfigured"));
      return;
    }
    message(t("home.mapsLoading"));
    try {
      const res = await fetch(`${SITE}/api/public/maps?locale=${siteLocale()}&limit=60`, { signal: abort.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { maps?: SiteMap[] };
      const maps = Array.isArray(data.maps) ? data.maps : [];
      if (maps.length === 0) {
        message(t("home.mapsEmpty"));
        return;
      }
      loadedMaps = maps;
      renderShelf();
      route(); // a detail hash opened before the shelf answered can now resolve
      void refreshDownloaded();
    } catch (err) {
      if (abort.signal.aborted) return;
      console.warn("[OpenWar3] the map library is unavailable:", err);
      message(t("home.mapsFailed"), true);
    }
  };

  // ── Detail page content ───────────────────────────────────────────────────
  const formatDate = (value: string): string => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString(currentLocale() === "zhCN" ? "zh-CN" : "en", {
      year: "numeric", month: "short", day: "numeric",
    });
  };

  const metaRow = (label: string, value: string): HTMLElement => {
    const row = document.createElement("div");
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    row.append(dt, dd);
    return row;
  };

  // ── Installed shelf (`Maps\Download\`) ─────────────────────────────────────
  const installedEmpty = (text: string): HTMLElement => {
    const box = document.createElement("p");
    box.className = "home-empty";
    box.textContent = text;
    return box;
  };

  const installedRow = (file: DownloadedMap): HTMLElement => {
    const row = document.createElement("div");
    row.className = "home-installed-row";
    const text = document.createElement("div");
    text.className = "home-installed-text";
    const name = document.createElement("span");
    name.className = "home-installed-name";
    name.textContent = file.name;
    const meta = document.createElement("span");
    meta.className = "home-installed-meta";
    meta.textContent = [formatBytes(file.size), formatDate(file.updatedAt)]
      .filter((part) => !!part).join(" · ");
    text.append(name, meta);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "home-installed-delete";
    remove.textContent = t("home.delete");
    remove.onclick = async (): Promise<void> => {
      if (!window.confirm(t("home.deleteConfirm", { name: file.name }))) return;
      remove.disabled = true;
      try {
        await deleteDownloadedMap(file.name);
        showToast(t("home.mapDeleted", { name: file.name }));
        // That map is gone from the folder, so its "downloaded" badge goes with it — and the
        // others may have been installed from another copy, so ask again rather than assume.
        downloaded.clear();
        for (const map of loadedMaps) applyDownloadState(map);
        void refreshDownloaded();
        await refreshInstalled();
      } catch (err) {
        remove.disabled = false;
        showToast(t("home.deleteFailed", { error: (err as Error).message }));
      }
    };
    row.append(text, remove);
    return row;
  };

  const refreshInstalled = async (): Promise<void> => {
    if (!install.valid) {
      installedBody.replaceChildren(installedEmpty(t("home.pickFirst")));
      return;
    }
    installedBody.replaceChildren(installedEmpty(t("home.mapsLoading")));
    const files = await listDownloadedMaps();
    installedBody.replaceChildren(
      ...(files.length === 0
        ? [installedEmpty(t("home.noInstalled"))]
        : files.map(installedRow)),
    );
  };

  /** One page, two shelves: the library the site offers, and this install's own maps. */
  const showShelf = (installed: boolean): void => {
    libraryPane.hidden = installed;
    installedPane.hidden = !installed;
    libraryTab.classList.toggle("is-active", !installed);
    installedTab.classList.toggle("is-active", installed);
    if (installed) void refreshInstalled();
  };
  libraryTab.onclick = (): void => showShelf(false);
  installedTab.onclick = (): void => showShelf(true);

  const renderDetail = (map: SiteMap): void => {
    detailCover.replaceChildren();
    if (map.coverUrl) {
      const img = document.createElement("img");
      img.src = map.coverUrl;
      img.alt = map.name;
      img.draggable = false;
      detailCover.append(img);
    } else {
      const placeholder = document.createElement("span");
      placeholder.className = "home-map-card-placeholder";
      placeholder.textContent = map.name.slice(0, 2);
      detailCover.append(placeholder);
    }

    detailTitle.textContent = map.name;
    detailSlug = map.slug;
    if (detailBadge) detailBadge.hidden = !downloaded.has(map.slug);
    // The site's own order: author, players, version, size, then the update date.
    const rows: HTMLElement[] = [];
    if (map.author) rows.push(metaRow(t("home.author"), map.author));
    if (map.players) rows.push(metaRow(t("home.playersLabel"), map.players));
    if (map.version) rows.push(metaRow(t("home.versionLabel"), map.version));
    if (map.fileSize) rows.push(metaRow(t("home.sizeLabel"), formatBytes(map.fileSize)));
    rows.push(metaRow(t("home.updatedLabel"), formatDate(map.updatedAt)));
    detailMeta.replaceChildren(...rows);

    detailActions.replaceChildren();
    detailButton = null;
    if (map.downloadUrl) {
      const dl = createGlueButton({
        label: downloaded.has(map.slug) ? t("home.redownload") : t("home.download"),
        sub: formatBytes(map.fileSize) || undefined, size: "lg", bordered: true,
      });
      dl.button.onclick = (): void => void downloadMap(map, dl);
      detailActions.append(dl.root);
      detailButton = dl;
    } else {
      const none = document.createElement("p");
      none.className = "home-map-card-nofile";
      none.textContent = t("home.noFile");
      detailActions.append(none);
    }

    detailDesc.textContent = map.description || t("home.noDescription");
  };

  // ── Routing: #/ (launch), #/maps, #/maps/<slug>, #/about — pages, not anchors ──
  type View = "home" | "maps" | "about" | "detail";
  const views: Record<View, HTMLElement> = { home: hero, maps: mapsView, about: aboutView, detail: detailView };
  const route = (): void => {
    const hash = location.hash.replace(/^#\/?/, "");
    let view: View = "home";
    if (hash === "maps") view = "maps";
    else if (hash === "about") view = "about";
    else if (hash.startsWith("maps/")) {
      const slug = decodeURIComponent(hash.slice("maps/".length));
      const map = loadedMaps.find((item) => item.slug === slug);
      if (map) {
        renderDetail(map);
        view = "detail";
      } else {
        view = "maps";
      }
    }
    for (const [name, el] of Object.entries(views)) el.hidden = name !== view;
    corner.hidden = view !== "home";
    const navView = view === "detail" ? "maps" : view;
    for (const [i, a] of [...topLinks, ...sideLinks].entries()) {
      a.classList.toggle("is-active", navItems[i % navItems.length].view === navView);
    }
    page.scrollTop = 0;
  };
  window.addEventListener("hashchange", route);
  route();

  if (!isDesktopApp()) message(t("home.mapsUnconfigured")); // defensive: this page is the desktop boot
  else {
    void refreshInstall();
    void loadMaps();
  }

  return {
    dispose: () => {
      abort.abort();
      unbindHotkeys();
      window.removeEventListener("hashchange", route);
      page.remove();
    },
  };
}
