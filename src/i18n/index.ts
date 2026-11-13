// Warcraft Open's own UI language (i18n).
//
// The GAME's text — unit names, tooltips, menu captions built from the install's FDFs —
// already follows the player's Warcraft III install (src/data/text.ts). This module covers
// the other half: the screens and labels that are OURS, which have no install string to
// come from (the load-files gate, the fallback menu, and the extra option rows we lay over
// the game's panels in src/overrides/).
//
// One locale at a time, resolved in this order:
//   1. `?lang=zhCN` / `?lang=enUS` on the URL — an explicit override, and the only way to
//      look at the other language without changing what the machine remembers;
//   2. `localStorage["warcraft-open.language"]` — what the language button last chose;
//   3. the browser's own language (`navigator.language`), so a Chinese browser opens in
//      Chinese and an English one in English;
//   4. English.
//
// Switching is a PAGE RELOAD rather than an in-place swap: the FDF screens cache the
// strings they layered at mount (ui/fdf/library.ts), so re-rendering them in place would
// mean rebuilding every mounted screen. A reload is honest, instant and always complete.

export type Locale = "enUS" | "zhCN";

/** The languages the engine's own UI is translated into, in the order the switcher shows. */
export const LOCALES: ReadonlyArray<{ id: Locale; label: string }> = [
  { id: "enUS", label: "English" },
  { id: "zhCN", label: "中文（简体）" },
];

const STORAGE_KEY = "warcraft-open.language";
const URL_PARAM = "lang";

// The engine's own messages. Every key exists in both catalogues — `zhCN` is typed as
// `Record<MessageKey, string>`, so a missing translation is a compile error rather than an
// English sentence in the middle of a Chinese screen.
const EN = {
  // The product name; the window/tab title and the brand the gate prints.
  "app.title": "Warcraft Open",
  "update.downloading": "Downloading {app} {version}…",
  "update.downloadingGeneric": "Downloading the update…",
  "gate.subtitleNative":
    "Select your Warcraft III (The Frozen Throne) folder. Every player has to be on the same game data, and it is checked at every launch. You will only be asked once: the game remembers where it is. Nothing is uploaded; your install is read from your own disk.",
  "gate.subtitleBrowser":
    "Select your Warcraft III (The Frozen Throne) folder to begin. Every player has to be on the same game data. The menu is built from the game's own files, so they're loaded first. Nothing is uploaded — your install is read locally in the browser.",
  "gate.load": "Play",
  "gate.chooseFolder": "Choose Warcraft III Folder",
  "gate.downloadZh": "Download Chinese version",
  "gate.downloadEn": "Download English version",
  "gate.loading": "Loading game data…",
  "gate.loaded": "Data successfully loaded",
  "gate.noWar3Folder": "No Warcraft III folder selected.",
  "gate.noFolder": "No folder selected.",
  "gate.loadFailed": "Couldn't load that folder: {error}",
  "gate.folderMissing": "Your Warcraft III folder is no longer at {path}.",
  "gate.wrongVersion":
    "That folder is Warcraft III {version}. Warcraft Open plays {required} — every player has to be on the same game data, so this is checked every launch.",
  "gate.unknownVersion":
    "That folder does not say which Warcraft III it is. Warcraft Open plays {required} (The Frozen Throne).",
  "gate.noGameData":
    "That folder has no Warcraft III game data in it (no Data folder). Select the Warcraft III {required} folder itself — the one with Warcraft III.exe in it.",
  "gate.oldVersion":
    "That folder is a Warcraft III older than {required}. Warcraft Open plays {required} (The Frozen Throne) — every player has to be on the same game data, so this is checked every launch.",
  // The launcher the load screen is dressed as (ui/gate.ts).
  "gate.tagline": "Warcraft III",
  "gate.edition": "Warcraft III · The Frozen Throne",
  "gate.headline": "Enter the battlefield",
  "gate.before": "Before you start",
  "gate.pointLocal": "Your game files are read on this device and never uploaded.",
  "gate.pointVersion": "Needs Warcraft III: The Frozen Throne, the build every player shares.",
  "gate.pointPlay": "Campaign, custom games and LAN are all here; online play joins the server's room list.",
  "gate.downloadHint": "No Warcraft III folder on this machine? Download one from the cloud storage link — Chinese or English — then point the game at it.",
  "gate.footer": "Warcraft Open is an unofficial fan reimplementation. No game files are included.",

  "menu.singlePlayer": "Single Player",
  "menu.online": "Online",
  "menu.multiplayer": "Multiplayer",
  "menu.options": "Options",
  "menu.credits": "Credits",
  "menu.quit": "Quit",
  "menu.installLoaded": "Install loaded — authentic assets active.",
  "menu.noInstall":
    "No install — flying placeholder terrain (WASD / drag / wheel). Click to import your Warcraft III folder.",
  "menu.loadingArchives": "Loading archives…",
  "menu.mounted": "{profile}: mounted {mounted}",
  "menu.missing": " — missing {missing}",
  "menu.fileCount": " — {count} files. Try warcraftOpen.vfs.list() in the console.",
  "menu.importFailed": "Import failed: {error}",

  // Our own captions on the game's FDF menu, carrying the accelerator markup the other
  // buttons carry. "Online" is ours: Warcraft Open multiplayer targets our own service.
  "menu.onlineCaption": "O|Cffffffffn|Rline",
  "menu.editionTft": "The Frozen Throne",
  "menu.editionRoc": "Reign of Chaos",

  // "Change Game Folder": re-pick the install the menus are built from (ui/fdfMainMenu.ts).
  "menu.changeInstall": "Change Game Folder",
  "menu.changeInstallTip": "Pick a different Warcraft III folder. The game reloads from it.",

  // The few console labels the HUD draws itself rather than reading from an FDF.
  "hud.status": "Status:",
  "hud.inventory": "Inventory",
  "hud.damage": "Damage:",
  "hud.armor": "Armor:",
  "hud.strength": "Strength:",
  "hud.agility": "Agility:",
  "hud.intelligence": "Intelligence:",
  "hud.levelName": "Level {level} {name}",
  "hud.experience": "Experience: {into} / {span}",
  "hud.experienceMax": "Experience: (max level)",
  "hud.gold": "Gold: {gold}",
  "hud.invulnerable": "Invulnerable",
  "hud.carryingGold": "Carrying {gold} gold",
  "hud.carryingLumber": "Carrying {lumber} lumber",
  "hud.build": "Build {name}",
  "hud.revive": "Revive {name}",

  // The Multiplayer (LAN) browser (ui/fdfLan.ts) and the reachability line it prints from
  // src/net/lobby.ts. The game's own captions around them come from the install.
  "lan.title": "Multiplayer",
  "lan.gamesTitle": "Network Games",
  "lan.gamesInfo": "Games on your network appear below.",
  "lan.createGame": "Create Game",
  "lan.joinGame": "Join Game",
  "lan.serversList": "Servers List",
  "lan.noGames": "No games found. Create one.",
  "lan.selectGame": "Select a game and choose Join.",
  "lan.willDownload": "Joining will download {map}.",
  "lan.playerDefault": "Player",
  "lan.unreachableDev": "Other computers cannot see your games. Restart the server with --host.",
  "lan.unreachableNoNetwork":
    "Other computers cannot see your games — this computer is not on a network.",
  "lan.joinAt": "Other players join at {addresses}",

  // The Servers dialog (ui/joinAddressDialog.ts), its row notes, and the lobby's address band.
  "lan.joinServerTitle": "Join Server",
  "lan.joinServerInfo": "Games created on these servers will appear on your games list.",
  "lan.serversLabel": "Servers:",
  "lan.add": "Add",
  "lan.done": "Done",
  "lan.serverCurrent": "in use",
  "lan.serverWaiting": "waiting",
  "lan.serverOffline": "offline",
  "lan.serverDisconnected": "not connected",
  "lan.serverFound": "on your network",
  "lan.removeServer": "Remove {address}",
  "lan.hostedOn": "Hosted on:",
  "lan.othersJoin": "Others join at (click to copy):",
  "lan.copied": "Copied.",
  "lan.badAddress": "\"{input}\" is not an address. Try 192.168.1.42 or 192.168.1.42:{port}.",
  "lan.ownAddress": "That address is this computer — your own games are already listed.",

  // The slot menus (ui/playerSlots.ts). The classic trio mirrors GlobalStrings' COMPUTER_*
  // rows; the Computer+ trio is ours, named after them.
  "slot.open": "Open",
  "slot.closed": "Closed",
  "slot.computerEasy": "Computer (Easy)",
  "slot.computerNormal": "Computer (Normal)",
  "slot.computerInsane": "Computer (Insane)",
  "slot.computerPlusEasy": "Computer+ (Easy)",
  "slot.computerPlusNormal": "Computer+ (Normal)",
  "slot.computerPlusInsane": "Computer+ (Insane)",

  // The lobby's race dropdown and the loading screen's slot rows (data/races.ts).
  "race.human": "Human",
  "race.orc": "Orc",
  "race.undead": "Undead",
  "race.nightelf": "Night Elf",
  "race.random": "Random",

  // The dev tools drawer (ui/devTools.ts) — ours, not the game's: WC3 has no debug UI.
  "dev.title": "Dev Tools",
  "dev.collapse": "Collapse the dev tools",
  "dev.tab.spawn": "Spawn",
  "dev.tab.cheats": "Cheats",
  "dev.tab.overlays": "Overlays",
  "dev.kind.hero": "Heroes",
  "dev.kind.unit": "Units",
  "dev.kind.building": "Buildings",
  "dev.kind.item": "Items",
  "dev.singular.hero": "Hero",
  "dev.singular.unit": "Unit",
  "dev.singular.building": "Building",
  "dev.singular.item": "Item",
  "dev.race.human": "Human",
  "dev.race.orc": "Orc",
  "dev.race.undead": "Undead",
  "dev.race.nightelf": "Night Elf",
  "dev.race.naga": "Naga",
  "dev.race.creeps": "Creeps",
  "dev.race.demon": "Demon",
  "dev.race.critters": "Critters",
  "dev.race.commoner": "Commoner",
  "dev.race.other": "Other",
  "dev.item.artifact": "Artifact",
  "dev.item.charged": "Charged",
  "dev.item.miscellaneous": "Miscellaneous",
  "dev.item.permanent": "Permanent",
  "dev.item.powerup": "PowerUp",
  "dev.item.purchasable": "Purchasable",
  "dev.item.campaign": "Campaign",
  "dev.search": "Search name or rawcode…",
  "dev.all": "All",
  "dev.meleeOnly": "Melee only",
  "dev.meleeOnlyTip": "Hide the campaign-only types (a search always finds them)",
  "dev.empty": "Nothing matches.",
  "dev.onMap": "{count} on the map now",
  "dev.campaign": " · campaign",
  "dev.owner": "Owner",
  "dev.level": "Level",
  "dev.count": "Count",
  "dev.spawnCentre": "Spawn at the centre of the screen",
  "dev.placeTip": "Every left-click on the map spawns there; right-click or Esc stops",
  "dev.learnAll": "Learn all",
  "dev.learnAllTip": "Every skill at its top rank, and a full mana bar",
  "dev.place": "Click map to place",
  "dev.placing": "Placing — right-click stops",
  "dev.you": "You",
  "dev.team": "Team {team}",
  "dev.cheat.kill": "Kill/Destroy",
  "dev.cheat.killTip": "Kill every selected unit, or destroy every selected building",
  "dev.section.economy": "Economy",
  "dev.section.cheats": "Cheats",
  "dev.section.selection": "Selection",
  "dev.cheat.gold": "+5000 Gold",
  "dev.cheat.lumber": "+5000 Lumber",
  "dev.cheat.food": "+Food",
  "dev.cheat.fastBuild": "Fast Build",
  "dev.cheat.godMode": "God Mode",
  "dev.cheat.day": "Set Day",
  "dev.cheat.night": "Set Night",
  "dev.cheat.upgrades": "All Upgrades",
  "dev.cheat.hp": "Full HP",
  "dev.cheat.mp": "Full MP",
  "dev.cheat.cooldown": "Reset Cooldown",
  "dev.cheat.fastBuildTip": "Builds and training finish in about a second",
  "dev.cheat.upgradesTip": "Research every upgrade in the game at its highest level",
  "dev.speed.pace": "Pace",
  "dev.speed.title": "Sim Speed",
  "dev.speed.tip": "Game pace as a percentage of the Game Speed (100% = as set). Enter to apply.",
  "dev.overlays.regions": "Show Regions",
  "dev.overlays.regionsTip": "Outline the map's named trigger regions (gg_rct_*)",
  "dev.overlays.concede": "Show Concede",
  "dev.overlays.concedeTip":
    "Show each Computer+ player's concede reading (despair against the line, and the dwell)",
  "dev.overlays.colliders": "Show Colliders",
  "dev.overlays.pathing": "Show Pathing",
  "dev.legend.click": "Click / selection",
  "dev.legend.obstruction": "Pathing obstruction",
  "dev.legend.fogBlocker": "Fog-of-war (line-of-sight) blocker",
  "dev.legend.pathingGrid": "Pathing grid",
  "dev.legend.blockedCell": "Blocked cell",
  "dev.legend.unitPath": "Unit path",
  "dev.concede.title": "Concede — Computer+",
  "dev.concede.none": "No Computer+ players",
  "dev.concede.player": "Player {player}",
  "dev.concede.noTerms": "no terms live",
  "dev.concede.left": "left the game",
  "dev.concede.conceded": "conceded — leaving",
  "dev.concede.teamLost": "half the team gone — concedes now",
  "dev.concede.notBefore": "nothing decided before {time} (now {now})",
  "dev.concede.clause": "clause {clause}",
  "dev.concede.despair": "despair",
  "dev.concede.hopeless": "hopeless ({why}) {dwell} / {after} s",
  "dev.concede.hopelessStart": "hopeless ({why}) — dwell starts next pass",
  "dev.concede.playingOn": "playing on",

  // The hotkey editor (ui/hotkeyEditor.ts): page and group captions, and the notes on a button.
  "hotkey.commands": "Commands",
  "hotkey.build": "Build",
  "hotkey.learn": "Learn",
  "hotkey.heroes": "Heroes",
  "hotkey.units": "Units",
  "hotkey.buildings": "Buildings",
  "hotkey.special": "Special",
  "hotkey.selectButton": "Select a button on the card.",
  "hotkey.cardHint": "Click a button to change its key. Drag it onto another slot to move it.",
  "hotkey.oneKeyAllLevels": "One key for all {levels} levels.",
  "hotkey.clash": "{key} is also {names} on this card.",
  "hotkey.alsoOn": "Also on: {names}.",
  "hotkey.andMore": " and {count} more",
  "hotkey.doubleClick": "Double-click to open its card.",
  "hotkey.unsaved": "Unsaved changes",
  "hotkey.sessionOnly": "Saved keys last until the game is closed: this browser cannot write to the folder.",
  "hotkey.title": "Hotkey Editor",
  "hotkey.keyLabel": "Hotkey:",
  "hotkey.activeState": "Active state",
  "hotkey.reset": "Reset",
  "hotkey.resetAll": "Reset All",
  "hotkey.save": "Save",
  "hotkey.cancel": "Cancel",
  "hotkey.discard": "Discard your changes to the hotkeys?",
  "hotkey.resetConfirm": "Reset every hotkey, button position and tooltip to the game's defaults?",

  // The map-info pane's VALUES (ui/mapBrowser.ts). Its labels — "Suggested Players", "Map
  // Size", "Map Tileset" — come out of the install's own FDF and are already Chinese there;
  // these are the halves that are OURS: the word the World Editor coins for a player-count
  // bucket, and the tileset names its terrain dialog lists. A map's own name and blurb are NOT
  // here — they belong to the map and its sidecar (i18n/mapLanguage.ts `info`/`wts`).
  "mapinfo.size.small": "Small",
  "mapinfo.size.medium": "Medium",
  "mapinfo.size.large": "Large",
  "mapinfo.tileset.A": "Ashenvale",
  "mapinfo.tileset.B": "Barrens",
  "mapinfo.tileset.C": "Felwood",
  "mapinfo.tileset.D": "Dungeon",
  "mapinfo.tileset.F": "Lordaeron Fall",
  "mapinfo.tileset.G": "Underground",
  "mapinfo.tileset.I": "Icecrown",
  "mapinfo.tileset.J": "Dalaran Ruins",
  "mapinfo.tileset.K": "Black Citadel",
  "mapinfo.tileset.L": "Lordaeron Summer",
  "mapinfo.tileset.N": "Northrend",
  "mapinfo.tileset.O": "Outland",
  "mapinfo.tileset.Q": "Village Fall",
  "mapinfo.tileset.V": "Village",
  "mapinfo.tileset.W": "Lordaeron Winter",
  "mapinfo.tileset.X": "Dalaran",
  "mapinfo.tileset.Y": "Cityscape",
  "mapinfo.tileset.Z": "Sunken Ruins",

  // The Download Maps dialog (ui/mapSitesPanel.ts, ui/mapSites.ts).
  "mapsites.title": "Download Maps",
  "mapsites.done": "Done",
  "mapsites.import": "Import map file…",
  "mapsites.importTip": "Add a .w3x or .w3m you already have to your maps",
  "mapsites.autoAdded": "Maps you download here are added to your list automatically.",
  "mapsites.note": "Download a map there, then Import it here — or drop the file on this window.",
  "mapsites.openSite": "Open {site}",
  "mapsites.openInBrowser": "Open in browser ↗",
  "mapsites.openInBrowserTip": "Open this page in your own web browser",
  "mapsites.back": "Back",
  "mapsites.forward": "Forward",
  "mapsites.reload": "Reload",
  "mapsites.home": "{site} home",
  "mapsites.loading": "Loading {site}…",
  "mapsites.couldNotOpen": "Could not open {site}: {error}",
  "mapsites.searchPlaceholder": "Search EpicWar",
  "mapsites.searchHint": "Type a map's name to search EpicWar's archive.",
  "mapsites.couldNotReach": "Could not reach EpicWar: {error}",
  "mapsites.noMatch": "Nothing on EpicWar matches \"{query}\".",
  "mapsites.byAuthor": "by {author}",
  "mapsites.players": "{count} players",
  "mapsites.download": "Download",
  "mapsites.notAMap": "Not a map",
  "mapsites.notAMapTip": "{file} is not a .w3x or .w3m map",
  "mapsites.downloadingShort": "Downloading…",
  "mapsites.added": "Added ✓",
  "mapsites.retry": "Retry",
  "mapsites.couldNotDownload": "Could not download {file}: {error}",
  "mapsites.downloadFailed": "{name} did not download ({why}).",
  "mapsites.downloadProgress": "Downloading {name} — {percent}%",
  "mapsites.downloading": "Downloading {name}…",
  "mapsites.addedSession": "Added {name} for this session only: {why}",
  "mapsites.addedTo": "Added {name} to Maps\\Download.",
  "mapsites.addedMany": "Added {names}.",
  "mapsites.refused": "Not a map file: {names}.",
  "mapsites.keptSessionOnly": "Kept for this session only: {why}",
  "mapsites.siteAnswered": "The site answered {status}.",
  "mapsites.notReachable": "This copy of the game cannot reach the map sites.",
  "mapsites.notPlayable": "That file is not a map this game can play.",
  "mapsites.blurb.epicwar": "A huge archive of custom maps, new and old.",
  "mapsites.blurb.hive": "The largest modding community — reviewed and approved maps.",
  "mapsites.blurb.wc3maps": "An archive of every map played on Battle.net, with its statistics.",

  // The map list's search box (ui/mapFind.ts).
  "mapsearch.placeholder": "Search maps (Ctrl+F)",
  "mapsearch.clear": "Clear",
  "mapsearch.clearTip": "Clear (Esc)",

  // The shared dialog's button (ui/patchDialog.ts); its title and text come from the caller.
  "patch.ok": "OK",

  // Gamepad pairing toasts and prompt (ui/gamepad.ts).
  "gamepad.none": "No gamepad found.",
  "gamepad.paired": "Gamepad paired.",
  "gamepad.disconnected": "Gamepad disconnected.",
  "gamepad.detected": "Gamepad detected — press START to pair.",
  "gamepad.pressAny": "Press any button on your gamepad…",
  "gamepad.unpaired": "Gamepad unpaired.",

  // The observer HUD's own labels (ui/observerHud.ts), and the fallbacks it gives the install's
  // uiString lookups when the install has no row of its own.
  "observer.menu": "Menu (|Cfffed312F10|R)",
  "observer.chat": "Chat (|Cfffed312F12|R)",
  "observer.production": "Production",
  "observer.units": "Units",
  "observer.upgrades": "Upgrades",
  "observer.levelFmt": "Level %u",
  "observer.levelClass": "Level %u %s",
  "observer.level": "Level {level}",
  "observer.jobProgress": "{verb} ({secs}s)",
  "observer.constructing": "Constructing",
  "observer.researching": "Researching",
  "observer.reviving": "Reviving",
  "observer.training": "Training",
  "observer.gold": "Gold:",

  // Voice Control (voice/control.ts) and its speech model's download (ui/voiceDownload.ts).
  "voice.micUnavailable": "Voice Control: microphone unavailable or permission refused.",
  "voice.listening": "Listening…",
  "voice.noCatch": "Voice Control: didn't catch that.",
  "voice.modelFailed": "Voice Control: the speech model could not run.",
  "voice.notACommand": "Voice Control: “{heard}” is not a command.",
  "voiceDownload.ask": "Voice Control needs its speech model (|cffffcc00{mb} MB|r), downloaded once and kept on this computer.|n|nDownload it now?",
  "voiceDownload.title": "Downloading Voice Control",
  "voiceDownload.titleDone": "Voice Control is ready",
  "voiceDownload.titleFailed": "Download failed",
  "voiceDownload.fetching": "Speech model, {mb} MB — kept on this computer.",
  "voiceDownload.done": "Hold |cffffcc00Period (.)|r and speak a command.",
  "voiceDownload.failed": "The speech model could not be downloaded.|n{why}",

  // LAN lobby odds and ends (net/lobby.ts) and the map download's dialog (ui/mapDownload.ts).
  "lan.reconnecting": "Reconnecting…",
  "lan.serverSilent": "That server is not answering.",
  "lan.gameEnded": "The game has ended.",
  "lan.mapTitle": "Downloading Map",
  "lan.mapFailed": "There was an error downloading the map file.",
  "lan.mapTitleCancelled": "Download Cancelled",
  "lan.mapStarted": "Match started before the download could finish.",
  "lan.mapTitleFailed": "Download Failed",
  "lan.mapGone": "The game is no longer available.",
  "lan.mapLine": "{name}{size} from {host}",

  // Player-facing errors (main.ts): the reconnect dialog and the missing-glue-file alert.
  "error.reconnectBody": "Disconnected from |cffffcc00{map}|r|n|n{time}|n|nReconnect?",
  "error.reconnectTime": "Time to reconnect {n}s...",
  "error.aLanGame": "a LAN game",
  "error.noSuchMap": "No such map in this install: {path}",
  "error.glueFilesMissing": "This install is missing the UI\\FrameDef\\Glue files the menus are built from, so the game can't be set up. Re-import a complete Warcraft III (TFT 1.30.4) folder.",

  // HUD tooltips of ours (ui/hud.ts) and the ally panel's squelch toggle (ui/allianceDialog.ts).
  "hud.cancel": "Cancel",
  "hud.selectBuilder": "Select the worker building this",
  "hud.mute": "Mute",
  "hud.unmute": "Unmute",

  // The desktop front page (src/ui/home.ts): the site's layout with the game's own buttons.
  "home.navHome": "Overview",
  "home.navMaps": "Maps",
  "home.navAbout": "About",
  "home.kicker": "Warcraft III · The Frozen Throne",
  "home.tagline": "Enter the battlefield",
  "home.lede":
    "Warcraft Open is an open-source re-creation of Warcraft III. Point it at your own game files, press play, and download community maps straight into your game folder.",
  "home.play": "Launch Game",
  "home.changeFolder": "Change Game Folder",
  "home.folder": "Game folder · Warcraft III {version} · {path}",
  "home.folderNone": "No game folder selected yet.",
  "home.folderMissing": "Your Warcraft III folder is no longer at {path}.",
  "home.folderChanged": "Game folder changed to {path}.",
  "home.loadFailed": "Couldn't load that folder: {error}",
  "home.maps": "Featured Maps",
  "home.mapsLoading": "Loading maps…",
  "home.mapsEmpty": "No maps published yet.",
  "home.mapsUnconfigured": "The map library is not configured for this build.",
  "home.mapsFailed": "The map library is unavailable right now.",
  "home.mapsRetry": "Retry",
  "home.back": "← Back to maps",
  "home.detail": "Details",
  "home.mapDetail": "Map Details",
  "home.author": "Author",
  "home.playersLabel": "Players",
  "home.versionLabel": "Version",
  "home.sizeLabel": "Size",
  "home.updatedLabel": "Updated",
  "home.noDescription": "No description yet.",
  "home.login": "Sign in / Register",
  "home.comingSoon": "Sign-in is still under development.",
  "home.quitApp": "Exit",
  "home.checkUpdate": "Check for updates",
  "home.updateChecking": "Checking…",
  "home.updateLatest": "You are on the latest version.",
  "home.updateFound": "Version {version} is available. Download it now?",
  "home.updateReady": "The update is downloaded. Restart to install it?",
  "home.updateFailed": "Update failed: {error}",
  "home.updateDesktopOnly": "Online updates are available in the desktop app.",
  "home.download": "Download",
  "home.downloading": "Downloading…",
  "home.downloadedBadge": "Downloaded",
  "home.redownload": "Download again",
  "home.noFile": "No file yet",
  "home.mapNoFile": "{name} has no downloadable file yet.",
  "home.mapFailed": "Couldn't save {name}: {error}",
  "home.pickFirst": "Choose your Warcraft III folder before downloading maps.",
  "home.library": "Library",
  "home.installed": "Installed",
  "home.searchPlaceholder": "Search name, author or description",
  "home.search": "Search",
  "home.allCategories": "All",
  "home.catMoba": "MOBA",
  "home.catHeroDefense": "Hero defense",
  "home.catRpg": "RPG",
  "home.catCampaign": "Campaign",
  "home.catMelee": "Melee",
  "home.catOther": "Other",
  "home.noResults": "No maps match your search.",
  "home.noInstalled": "No maps have been downloaded yet.",
  "home.delete": "Delete",
  "home.deleteConfirm": "Delete {name} from the game's Maps folder?",
  "home.mapDeleted": "{name} was deleted.",
  "home.deleteFailed": "Couldn't delete the map: {error}",
  "home.about": "About",
  "home.aboutText":
    "Warcraft Open is an unofficial fan re-creation. No Blizzard game files are bundled: the game reads the Warcraft III folder on your own disk, and every player has to be on the same game data.",

  "language.label": "Language",
  "language.switch": "Language: {language}",
  "language.next": "Switch to {language}",
} as const;

export type MessageKey = keyof typeof EN;

const ZH: Record<MessageKey, string> = {
  "app.title": "魔兽争霸开源版",
  "update.downloading": "正在下载{app} {version}…",
  "update.downloadingGeneric": "正在下载更新…",
  "gate.subtitleNative":
    "选择你的《魔兽争霸 III：冰封王座》文件夹。所有玩家必须使用相同的游戏数据，且每次启动都会检查。你只会被询问一次：游戏会记住它的位置。不会上传任何内容；安装只从本地磁盘读取。",
  "gate.subtitleBrowser":
    "选择你的《魔兽争霸 III：冰封王座》文件夹以开始。所有玩家必须使用相同的游戏数据。菜单由游戏自身的文件构建，因此会先加载它们。不会上传任何内容——安装只在浏览器本地读取。",
  "gate.load": "开始游戏",
  "gate.chooseFolder": "选择《魔兽争霸 III》文件夹",
  "gate.downloadZh": "下载中文版",
  "gate.downloadEn": "下载英文版",
  "gate.loading": "正在加载游戏数据…",
  "gate.loaded": "数据加载成功",
  "gate.noWar3Folder": "未选择《魔兽争霸 III》文件夹。",
  "gate.noFolder": "未选择文件夹。",
  "gate.loadFailed": "无法加载该文件夹：{error}",
  "gate.folderMissing": "你的《魔兽争霸 III》文件夹已不在 {path}。",
  "gate.wrongVersion":
    "该文件夹是《魔兽争霸 III》{version}。魔兽争霸开源版 使用 {required}——所有玩家必须使用相同的游戏数据，因此每次启动都会检查。",
  "gate.unknownVersion": "无法确定该文件夹是哪个版本的《魔兽争霸 III》。魔兽争霸开源版 使用 {required}（冰封王座）。",
  "gate.noGameData":
    "该文件夹中没有《魔兽争霸 III》游戏数据（缺少 Data 文件夹）。请选择《魔兽争霸 III》{required} 文件夹本身——即包含 Warcraft III.exe 的那个文件夹。",
  "gate.oldVersion":
    "该文件夹是早于 {required} 的《魔兽争霸 III》。魔兽争霸开源版 使用 {required}（冰封王座）——所有玩家必须使用相同的游戏数据，因此每次启动都会检查。",
  // 载入页的对战平台外观（ui/gate.ts）。
  "gate.tagline": "魔兽争霸 III",
  "gate.edition": "魔兽争霸 III · 冰封王座",
  "gate.headline": "进入战场",
  "gate.before": "开始之前",
  "gate.pointLocal": "游戏文件只在本机读取，不会上传到任何服务器。",
  "gate.pointVersion": "需要《魔兽争霸 III：冰封王座》，所有玩家必须使用同一份游戏数据。",
  "gate.pointPlay": "战役、自定义游戏与局域网都在这里；联机从大厅的服务器列表进入。",
  "gate.downloadHint": "本机没有《魔兽争霸 III》文件夹？可从网盘下载中文版或英文版，再用上面的按钮选择该文件夹。",
  "gate.footer": "魔兽争霸开源版 是非官方粉丝重制，不附带任何游戏文件。",

  "menu.singlePlayer": "单人游戏",
  "menu.online": "在线",
  "menu.multiplayer": "多人游戏",
  "menu.options": "选项",
  "menu.credits": "制作人员",
  "menu.quit": "退出",
  "menu.installLoaded": "安装已加载——正在使用原版资源。",
  "menu.noInstall": "未找到安装——正在使用飞行占位地形（WASD / 拖动 / 滚轮）。点击导入《魔兽争霸 III》文件夹。",
  "menu.loadingArchives": "正在加载档案…",
  "menu.mounted": "{profile}：已挂载 {mounted}",
  "menu.missing": "——缺少 {missing}",
  "menu.fileCount": "——{count} 个文件。可在控制台尝试 warcraftOpen.vfs.list()。",
  "menu.importFailed": "导入失败：{error}",

  // No white letter to gild: a Chinese caption carries no Latin accelerator, and the
  // button still answers N through `shortcutOverrides` (ui/fdfMainMenu.ts).
  "menu.onlineCaption": "在线",
  "menu.editionTft": "冰封王座",
  "menu.editionRoc": "混乱之治",

  // "Change Game Folder": re-pick the install the menus are built from (ui/fdfMainMenu.ts).
  "menu.changeInstall": "更换游戏目录",
  "menu.changeInstallTip": "选择另一个《魔兽争霸 III》文件夹，游戏将从该目录重新加载。",

  // The few console labels the HUD draws itself rather than reading from an FDF.
  "hud.status": "状态：",
  "hud.inventory": "物品栏",
  "hud.damage": "伤害：",
  "hud.armor": "护甲：",
  "hud.strength": "力量：",
  "hud.agility": "敏捷：",
  "hud.intelligence": "智力：",
  "hud.levelName": "等级 {level} {name}",
  "hud.experience": "经验：{into} / {span}",
  "hud.experienceMax": "经验：（已满级）",
  "hud.gold": "金币：{gold}",
  "hud.invulnerable": "无敌",
  "hud.carryingGold": "携带 {gold} 金币",
  "hud.carryingLumber": "携带 {lumber} 木材",
  "hud.build": "建造 {name}",
  "hud.revive": "复活 {name}",

  "lan.title": "多人游戏",
  "lan.gamesTitle": "网络游戏",
  "lan.gamesInfo": "局域网中的游戏会显示在下方。",
  "lan.createGame": "创建游戏",
  "lan.joinGame": "加入游戏",
  "lan.serversList": "服务器列表",
  "lan.noGames": "没有找到游戏，请创建一个。",
  "lan.selectGame": "选择一个游戏，然后点击加入。",
  "lan.willDownload": "加入时将下载 {map}。",
  "lan.playerDefault": "玩家",
  "lan.unreachableDev": "其他电脑看不到你的游戏。请用 --host 重启服务器。",
  "lan.unreachableNoNetwork": "其他电脑看不到你的游戏——这台电脑不在网络上。",
  "lan.joinAt": "其他玩家通过 {addresses} 加入",

  "lan.joinServerTitle": "加入服务器",
  "lan.joinServerInfo": "在这些服务器上创建的游戏会显示在你的游戏列表中。",
  "lan.serversLabel": "服务器：",
  "lan.add": "添加",
  "lan.done": "完成",
  "lan.serverCurrent": "使用中",
  "lan.serverWaiting": "等待中",
  "lan.serverOffline": "离线",
  "lan.serverDisconnected": "未连接",
  "lan.serverFound": "局域网发现",
  "lan.removeServer": "移除 {address}",
  "lan.hostedOn": "所在服务器：",
  "lan.othersJoin": "其他玩家输入此地址加入（点击复制）：",
  "lan.copied": "已复制。",
  "lan.badAddress": "“{input}”不是有效地址。请尝试 192.168.1.42 或 192.168.1.42:{port}。",
  "lan.ownAddress": "这是本机地址——你自己的游戏已经在列表中了。",

  "slot.open": "开放",
  "slot.closed": "关闭",
  "slot.computerEasy": "电脑（简单）",
  "slot.computerNormal": "电脑（普通）",
  "slot.computerInsane": "电脑（令人发狂的）",
  "slot.computerPlusEasy": "电脑+（简单）",
  "slot.computerPlusNormal": "电脑+（普通）",
  "slot.computerPlusInsane": "电脑+（令人发狂的）",

  "race.human": "人族",
  "race.orc": "兽族",
  "race.undead": "不死族",
  "race.nightelf": "暗夜精灵",
  "race.random": "随机",

  "dev.title": "开发者工具",
  "dev.collapse": "收起开发者工具",
  "dev.tab.spawn": "生成",
  "dev.tab.cheats": "作弊",
  "dev.tab.overlays": "叠加层",
  "dev.kind.hero": "英雄",
  "dev.kind.unit": "单位",
  "dev.kind.building": "建筑",
  "dev.kind.item": "物品",
  "dev.singular.hero": "英雄",
  "dev.singular.unit": "单位",
  "dev.singular.building": "建筑",
  "dev.singular.item": "物品",
  "dev.race.human": "人族",
  "dev.race.orc": "兽族",
  "dev.race.undead": "不死族",
  "dev.race.nightelf": "暗夜精灵",
  "dev.race.naga": "娜迦",
  "dev.race.creeps": "野怪",
  "dev.race.demon": "恶魔",
  "dev.race.critters": "小动物",
  "dev.race.commoner": "平民",
  "dev.race.other": "其他",
  "dev.item.artifact": "神器",
  "dev.item.charged": "充能",
  "dev.item.miscellaneous": "杂项",
  "dev.item.permanent": "永久",
  "dev.item.powerup": "能量提升",
  "dev.item.purchasable": "可购买",
  "dev.item.campaign": "战役",
  "dev.search": "搜索名称或代码…",
  "dev.all": "全部",
  "dev.meleeOnly": "仅对战",
  "dev.meleeOnlyTip": "隐藏仅战役出现的类型（搜索始终能找到它们）",
  "dev.empty": "没有匹配项。",
  "dev.onMap": "地图上现有 {count} 个",
  "dev.campaign": " · 战役",
  "dev.owner": "所属",
  "dev.level": "等级",
  "dev.count": "数量",
  "dev.spawnCentre": "在屏幕中央生成",
  "dev.placeTip": "在地图上左键即可在该处生成；右键或 Esc 停止",
  "dev.learnAll": "学满技能",
  "dev.learnAllTip": "所有技能升到最高等级，并充满法力",
  "dev.place": "点击地图放置",
  "dev.placing": "放置中——右键停止",
  "dev.you": "你",
  "dev.team": "队伍 {team}",
  "dev.cheat.kill": "杀死/摧毁",
  "dev.cheat.killTip": "杀死所有选中的单位，或摧毁所有选中的建筑",
  "dev.section.economy": "经济",
  "dev.section.cheats": "作弊",
  "dev.section.selection": "选中单位",
  "dev.cheat.gold": "+5000 金币",
  "dev.cheat.lumber": "+5000 木材",
  "dev.cheat.food": "+人口",
  "dev.cheat.fastBuild": "快速建造",
  "dev.cheat.godMode": "无敌模式",
  "dev.cheat.day": "设为白天",
  "dev.cheat.night": "设为夜晚",
  "dev.cheat.upgrades": "全部升级",
  "dev.cheat.hp": "满生命",
  "dev.cheat.mp": "满法力",
  "dev.cheat.cooldown": "重置冷却",
  "dev.cheat.fastBuildTip": "建造与训练约一秒完成",
  "dev.cheat.upgradesTip": "研究游戏中所有升级至最高等级",
  "dev.speed.pace": "速度",
  "dev.speed.title": "模拟速度",
  "dev.speed.tip": "游戏节奏相对于“游戏速度”的百分比（100% = 按设定值）。回车应用。",
  "dev.overlays.regions": "显示区域",
  "dev.overlays.regionsTip": "勾出地图中命名的触发区域（gg_rct_*）",
  "dev.overlays.concede": "显示认输读数",
  "dev.overlays.concedeTip": "显示每个 Computer+ 玩家的认输读数（绝望值与阈值，以及持续时间）",
  "dev.overlays.colliders": "显示碰撞体",
  "dev.overlays.pathing": "显示寻路",
  "dev.legend.click": "点击 / 选择",
  "dev.legend.obstruction": "寻路阻挡",
  "dev.legend.fogBlocker": "战争迷雾（视线）阻挡",
  "dev.legend.pathingGrid": "寻路网格",
  "dev.legend.blockedCell": "阻挡格",
  "dev.legend.unitPath": "单位路径",
  "dev.concede.title": "认输 — Computer+",
  "dev.concede.none": "没有 Computer+ 玩家",
  "dev.concede.player": "玩家 {player}",
  "dev.concede.noTerms": "无生效条款",
  "dev.concede.left": "已离开游戏",
  "dev.concede.conceded": "已认输——正在离开",
  "dev.concede.teamLost": "队伍半数已失——立即认输",
  "dev.concede.notBefore": "{time} 之前不做判定（当前 {now}）",
  "dev.concede.clause": "条款 {clause}",
  "dev.concede.despair": "绝望值",
  "dev.concede.hopeless": "无望（{why}）{dwell} / {after} 秒",
  "dev.concede.hopelessStart": "无望（{why}）——下一轮开始计时",
  "dev.concede.playingOn": "继续游戏",

  "hotkey.commands": "命令",
  "hotkey.build": "建造",
  "hotkey.learn": "学习",
  "hotkey.heroes": "英雄",
  "hotkey.units": "单位",
  "hotkey.buildings": "建筑",
  "hotkey.special": "特殊",
  "hotkey.selectButton": "请在命令卡上选择一个按钮。",
  "hotkey.cardHint": "点击按钮可修改其快捷键。将其拖到另一个格子上即可移动。",
  "hotkey.oneKeyAllLevels": "所有 {levels} 个等级共用一个按键。",
  "hotkey.clash": "{key} 在此卡上也是 {names}。",
  "hotkey.alsoOn": "同样用于：{names}。",
  "hotkey.andMore": "，以及另外 {count} 个",
  "hotkey.doubleClick": "双击打开其命令卡。",
  "hotkey.unsaved": "未保存的更改",
  "hotkey.sessionOnly": "已保存的按键仅在游戏关闭前有效：此浏览器无法写入该文件夹。",
  "hotkey.title": "快捷键编辑器",
  "hotkey.keyLabel": "快捷键：",
  "hotkey.activeState": "激活状态",
  "hotkey.reset": "重置",
  "hotkey.resetAll": "全部重置",
  "hotkey.save": "保存",
  "hotkey.cancel": "取消",
  "hotkey.discard": "放弃对快捷键的更改？",
  "hotkey.resetConfirm": "将所有快捷键、按钮位置和提示重置为游戏默认值？",

  // 地图信息面板上的“值”（ui/mapBrowser.ts）。它旁边的标签（“建议玩家”“地图尺寸”
  // “地形”）来自安装自己的 FDF，中文安装已是中文；这里是我们自己的两半：世界编辑器
  // 按玩家数分档造的那个词，以及它地形列表里的地形名。地图自己的名字和简介不在这里——
  // 那属于地图和它的侧车文件（i18n/mapLanguage.ts 的 `info` / `wts`）。
  "mapinfo.size.small": "小型",
  "mapinfo.size.medium": "中型",
  "mapinfo.size.large": "大型",
  "mapinfo.tileset.A": "灰谷",
  "mapinfo.tileset.B": "贫瘠之地",
  "mapinfo.tileset.C": "费伍德森林",
  "mapinfo.tileset.D": "地牢",
  "mapinfo.tileset.F": "洛丹伦的秋天",
  "mapinfo.tileset.G": "地下",
  "mapinfo.tileset.I": "冰冠冰川",
  "mapinfo.tileset.J": "达拉然废墟",
  "mapinfo.tileset.K": "黑色城堡",
  "mapinfo.tileset.L": "洛丹伦的夏天",
  "mapinfo.tileset.N": "诺森德",
  "mapinfo.tileset.O": "外域",
  "mapinfo.tileset.Q": "村庄的秋天",
  "mapinfo.tileset.V": "村庄",
  "mapinfo.tileset.W": "洛丹伦的冬天",
  "mapinfo.tileset.X": "达拉然",
  "mapinfo.tileset.Y": "城市",
  "mapinfo.tileset.Z": "沉没的废墟",

  "mapsites.title": "下载地图",
  "mapsites.done": "完成",
  "mapsites.import": "导入地图文件…",
  "mapsites.importTip": "将已有的 .w3x 或 .w3m 地图添加到你的地图列表",
  "mapsites.autoAdded": "在此下载的地图会自动添加到你的列表中。",
  "mapsites.note": "在那里下载地图，然后在此导入——或将文件拖到此窗口。",
  "mapsites.openSite": "打开 {site}",
  "mapsites.openInBrowser": "在浏览器中打开 ↗",
  "mapsites.openInBrowserTip": "在你自己的浏览器中打开此页面",
  "mapsites.back": "后退",
  "mapsites.forward": "前进",
  "mapsites.reload": "重新加载",
  "mapsites.home": "{site} 首页",
  "mapsites.loading": "正在加载 {site}…",
  "mapsites.couldNotOpen": "无法打开 {site}：{error}",
  "mapsites.searchPlaceholder": "搜索 EpicWar",
  "mapsites.searchHint": "输入地图名称以搜索 EpicWar 的档案库。",
  "mapsites.couldNotReach": "无法连接 EpicWar：{error}",
  "mapsites.noMatch": "EpicWar 上没有与“{query}”匹配的结果。",
  "mapsites.byAuthor": "作者：{author}",
  "mapsites.players": "{count} 名玩家",
  "mapsites.download": "下载",
  "mapsites.notAMap": "非地图文件",
  "mapsites.notAMapTip": "{file} 不是 .w3x 或 .w3m 地图",
  "mapsites.downloadingShort": "正在下载…",
  "mapsites.added": "已添加 ✓",
  "mapsites.retry": "重试",
  "mapsites.couldNotDownload": "无法下载 {file}：{error}",
  "mapsites.downloadFailed": "{name} 下载失败（{why}）。",
  "mapsites.downloadProgress": "正在下载 {name} — {percent}%",
  "mapsites.downloading": "正在下载 {name}…",
  "mapsites.addedSession": "已添加 {name}，仅在本次会话中有效：{why}",
  "mapsites.addedTo": "已将 {name} 添加到 Maps\\Download。",
  "mapsites.addedMany": "已添加 {names}。",
  "mapsites.refused": "不是地图文件：{names}。",
  "mapsites.keptSessionOnly": "仅在本次会话中保留：{why}",
  "mapsites.siteAnswered": "站点返回了 {status}。",
  "mapsites.notReachable": "此版本的游戏无法访问地图站点。",
  "mapsites.notPlayable": "该文件不是本游戏能玩的地图。",
  "mapsites.blurb.epicwar": "海量自定义地图存档，新老皆有。",
  "mapsites.blurb.hive": "最大的地图制作社区——经过审核与批准的地图。",
  "mapsites.blurb.wc3maps": "收录所有在 Battle.net 上玩过的地图及其统计数据。",

  "mapsearch.placeholder": "搜索地图 (Ctrl+F)",
  "mapsearch.clear": "清除",
  "mapsearch.clearTip": "清除 (Esc)",

  "patch.ok": "确定",

  "gamepad.none": "未找到游戏手柄。",
  "gamepad.paired": "游戏手柄已配对。",
  "gamepad.disconnected": "游戏手柄已断开。",
  "gamepad.detected": "检测到游戏手柄——按 START 配对。",
  "gamepad.pressAny": "请按游戏手柄上的任意键…",
  "gamepad.unpaired": "已取消手柄配对。",

  "observer.menu": "菜单 (|Cfffed312F10|R)",
  "observer.chat": "聊天 (|Cfffed312F12|R)",
  "observer.production": "生产",
  "observer.units": "单位",
  "observer.upgrades": "升级",
  "observer.levelFmt": "等级 %u",
  "observer.levelClass": "等级 %u %s",
  "observer.level": "等级 {level}",
  "observer.jobProgress": "{verb}（{secs} 秒）",
  "observer.constructing": "建造中",
  "observer.researching": "研究中",
  "observer.reviving": "复活中",
  "observer.training": "训练中",
  "observer.gold": "金币：",

  "voice.micUnavailable": "语音控制：麦克风不可用或权限被拒绝。",
  "voice.listening": "正在聆听…",
  "voice.noCatch": "语音控制：没有听清。",
  "voice.modelFailed": "语音控制：语音模型无法运行。",
  "voice.notACommand": "语音控制：“{heard}”不是有效命令。",
  "voiceDownload.ask": "语音控制需要其语音模型（|cffffcc00{mb} MB|r），下载一次后会保存在这台电脑上。|n|n现在下载吗？",
  "voiceDownload.title": "正在下载语音控制",
  "voiceDownload.titleDone": "语音控制已就绪",
  "voiceDownload.titleFailed": "下载失败",
  "voiceDownload.fetching": "语音模型，{mb} MB——保存在这台电脑上。",
  "voiceDownload.done": "按住 |cffffcc00句号键 (.)|r 并说出命令。",
  "voiceDownload.failed": "无法下载语音模型。|n{why}",

  "lan.reconnecting": "正在重新连接…",
  "lan.serverSilent": "该服务器没有响应。",
  "lan.gameEnded": "游戏已结束。",
  "lan.mapTitle": "正在下载地图",
  "lan.mapFailed": "下载地图文件时出错。",
  "lan.mapTitleCancelled": "下载已取消",
  "lan.mapStarted": "下载完成前比赛已开始。",
  "lan.mapTitleFailed": "下载失败",
  "lan.mapGone": "该游戏已不可用。",
  "lan.mapLine": "{name}{size}，来自 {host}",

  "error.reconnectBody": "与 |cffffcc00{map}|r 的连接已断开|n|n{time}|n|n是否重新连接？",
  "error.reconnectTime": "重新连接剩余 {n} 秒…",
  "error.aLanGame": "一场局域网游戏",
  "error.noSuchMap": "此安装中没有该地图：{path}",
  "error.glueFilesMissing": "此安装缺少构建菜单所需的 UI\\FrameDef\\Glue 文件，因此无法进入游戏设置。请重新导入完整的《魔兽争霸 III》（冰封王座 1.30.4）文件夹。",

  "hud.cancel": "取消",
  "hud.selectBuilder": "选择正在建造此建筑的工人",
  "hud.mute": "静音",
  "hud.unmute": "取消静音",

  // 桌面启动页（src/ui/home.ts）：官网同构布局，按钮换成启动器自己的动作。
  "home.navHome": "概览",
  "home.navMaps": "地图",
  "home.navAbout": "关于",
  "home.kicker": "魔兽争霸 III · 冰封王座",
  "home.tagline": "进入战场",
  "home.lede":
    "魔兽争霸开源版是《魔兽争霸 III：冰封王座》的开源重制。选择你本机的游戏目录即可一键启动，还能浏览并直接把社区地图（含多语言文件）下载到游戏地图文件夹。",
  "home.play": "启动游戏",
  "home.changeFolder": "更换游戏目录",
  "home.folder": "游戏目录 · 魔兽争霸 III {version} · {path}",
  "home.folderNone": "尚未选择游戏目录。",
  "home.folderMissing": "你的《魔兽争霸 III》目录已不在 {path}。",
  "home.folderChanged": "游戏目录已更换为 {path}。",
  "home.loadFailed": "无法加载该目录：{error}",
  "home.maps": "精选地图",
  "home.mapsLoading": "正在加载地图…",
  "home.mapsEmpty": "还没有发布地图。",
  "home.mapsUnconfigured": "此版本未配置地图库地址。",
  "home.mapsFailed": "地图库暂时不可用。",
  "home.mapsRetry": "重试",
  "home.back": "← 返回地图",
  "home.detail": "详情",
  "home.mapDetail": "地图详情",
  "home.author": "作者",
  "home.playersLabel": "玩家",
  "home.versionLabel": "版本",
  "home.sizeLabel": "大小",
  "home.updatedLabel": "更新",
  "home.noDescription": "暂无介绍。",
  "home.login": "登录 / 注册",
  "home.comingSoon": "登录注册功能待开发。",
  "home.quitApp": "退出程序",
  "home.checkUpdate": "检查更新",
  "home.updateChecking": "正在检查…",
  "home.updateLatest": "已是最新版本。",
  "home.updateFound": "发现新版本 {version}，现在下载吗？",
  "home.updateReady": "更新已下载，重启安装吗？",
  "home.updateFailed": "更新失败：{error}",
  "home.updateDesktopOnly": "在线升级仅在桌面版可用。",
  "home.download": "下载",
  "home.downloading": "下载中…",
  "home.downloadedBadge": "已下载",
  "home.redownload": "重新下载",
  "home.noFile": "暂无文件",
  "home.mapNoFile": "{name} 还没有可下载的文件。",
  "home.mapFailed": "保存 {name} 失败：{error}",
  "home.pickFirst": "请先选择游戏目录，再下载地图。",
  "home.library": "地图库",
  "home.installed": "已安装",
  "home.searchPlaceholder": "搜索地图名、作者或介绍",
  "home.search": "搜索",
  "home.allCategories": "全部",
  "home.catMoba": "对抗（MOBA）",
  "home.catHeroDefense": "英雄防守",
  "home.catRpg": "角色扮演（RPG）",
  "home.catCampaign": "战役",
  "home.catMelee": "对战（Melee）",
  "home.catOther": "其他",
  "home.noResults": "没有找到符合条件的地图。",
  "home.noInstalled": "还没有下载过地图。",
  "home.delete": "删除",
  "home.deleteConfirm": "确定从游戏的 Maps 目录删除 {name} 吗？",
  "home.mapDeleted": "已删除 {name}。",
  "home.deleteFailed": "删除地图失败：{error}",
  "home.about": "关于",
  "home.aboutText":
    "魔兽争霸开源版是非官方的爱好者重制项目，使用 TypeScript 重写引擎并直接读取原版游戏资源。程序不包含任何暴雪游戏文件：游戏读取你自己磁盘上的《魔兽争霸 III》目录，所有玩家必须使用相同的游戏数据。支持局域网与在线联机、地图库、Computer+ 电脑 AI 和中英文界面。",

  "language.label": "语言",
  "language.switch": "语言：{language}",
  "language.next": "切换到{language}",
};

/** Parse a BCP-47 tag (or a WC3 locale name) into a locale this module knows. */
function normalize(tag: string | null | undefined): Locale | null {
  if (!tag) return null;
  const lower = tag.toLowerCase();
  if (lower.startsWith("zh")) return "zhCN";
  if (lower.startsWith("en")) return "enUS";
  return null;
}

function urlLocale(): Locale | null {
  if (typeof location === "undefined") return null;
  try {
    return normalize(new URLSearchParams(location.search).get(URL_PARAM));
  } catch {
    return null;
  }
}

function storedLocale(): Locale | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return normalize(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

let cached: Locale | null = null;

/** The locale the engine's own UI is drawn in. Resolved once, then cached. */
export function currentLocale(): Locale {
  if (cached) return cached;
  // Chinese is this build's default: `?lang=` wins, then the language the player picked
  // last time, then zhCN — we no longer sniff `navigator.language`, so an English system
  // still opens in Chinese. English stays one click away (the language switch) or `?lang=enUS`.
  cached = urlLocale() ?? storedLocale() ?? "zhCN";
  return cached;
}

/**
 * A hero's name as the UI should print it. WC3 prints the hero's GIVEN name where it has one
 * ("Usyl", "Razzil Darkbrew"), and a map's own given names are whatever its author typed — in
 * DotA 6.90G they are English, so the Chinese UI would show "Usyl" where the translated class
 * name ("矮人狙击手") belongs. Chinese keeps the class name for a given name that has no
 * Chinese in it; English, and given names that ARE Chinese (the install's own), never change.
 */
export function displayHeroName(properName: string | undefined, typeName: string): string {
  if (!properName) return typeName;
  return currentLocale() === "zhCN" && !/[\u4e00-\u9fff]/.test(properName) ? typeName : properName;
}

/** Set the UI language and remember it. Callers that want the change on screen NOW reload
 *  the page (see the header); the API itself only persists and notifies. */
export function setLocale(locale: Locale): void {
  cached = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* storage disabled — the choice stands for this session only */
  }
  applyDocumentLang();
}

/** Translate a key, interpolating `{name}` placeholders. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const template = (currentLocale() === "zhCN" ? ZH : EN)[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

/** The language NAME for the switcher, in the other language — "English" while the UI is
 *  Chinese, "中文（简体）" while it is English. */
export function otherLocaleLabel(): string {
  const other = currentLocale() === "zhCN" ? LOCALES[0] : LOCALES[1];
  return other.label;
}

/** The locale's own name, for the current-language readout. */
export function currentLocaleLabel(): string {
  return (currentLocale() === "zhCN" ? LOCALES[1] : LOCALES[0]).label;
}

function applyDocumentLang(): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = currentLocale() === "zhCN" ? "zh-CN" : "en-US";
  document.documentElement.dataset.locale = currentLocale();
  document.title = t("app.title");
}

/**
 * Boot hook: resolve the language and stamp it on `<html>` (so the browser hyphenates, the
 * font stack and assistive tech all see it). Safe to call more than once.
 */
export function initI18n(): Locale {
  const locale = currentLocale();
  applyDocumentLang();
  return locale;
}
