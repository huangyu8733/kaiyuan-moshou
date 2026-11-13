# 魔兽争霸开源版（Warcraft Open）

<img src="public/demoscreens/launcher-home.avif" width="800">
<img src="public/demoscreens/game-main-menu.avif" width="800">
<img src="public/demoscreens/launcher-maps.avif" width="800">
<img src="public/demoscreens/game-server.avif" width="800">

魔兽争霸开源版是用 TypeScript 重写的《魔兽争霸 III：冰封王座》开源引擎，支持 Windows / Linux / macOS。程序不包含任何暴雪游戏文件，运行时读取你指定目录中的游戏资源；如果还没有游戏文件，可以到官网「资料下载」获取中文版或英文版。内置地图库与多语言文件下载、局域网与在线联机、Computer+ 电脑 AI、快捷键编辑与语音控制。

A recreation of the **Warcraft III** engine in TypeScript. Ships **zero Blizzard assets** — it reads
the Warcraft III folder you point it at. Game files (Chinese and English) are available from the
[downloads page](https://warcraft.hhkj.me/zh/downloads).

## Features

- **Cross-platform** — Windows, Linux, macOS, anything with a browser
- **Multiplayer reconnect** — no more dropped games lost
- **Computer+** — a smarter melee AI that never cheats ([how it works](docs/computer-plus.md))
- **Huge control groups** and a **select-army hotkey** (-)
- **Built-in map downloader** — search and download EpicWar maps from the map list, browse Hive
  Workshop and wc3maps inside the game, and a LAN game fetches the host's map if you don't have it
- **Hotkey editor** — rebind any command card in-game and save it to your `CustomKeys.txt`
  (Options → Gameplay → Hotkeys: Custom; [how it works](docs/hotkeys.md#the-editor-issue-156))
- **Voice control** accessibility mode
- **Push-to-talk voice chat** in multiplayer

## Quick start

Download the desktop app from [Releases](../../releases), run it, and point it at your Warcraft III
folder. It remembers the folder and updates itself.

From source:

```bash
pnpm install
pnpm dev     # http://localhost:5173
pnpm app     # desktop app (after pnpm build)
pnpm test    # every check; the data-backed suites skip without an install
```

LAN and online play works out of the box in the desktop app — see [docs/multiplayer.md](docs/multiplayer.md).

Want to help? Start with [CONTRIBUTING.md](CONTRIBUTING.md).

## Legal

Original code, no copyrighted assets. Game files are read locally and never uploaded.
Licensed under the [MIT License](LICENSE).
