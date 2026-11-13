import { currentLocale } from ".";

// Chinese for the labels Warcraft Open ADDS to the game's own FDF screens (`src/overrides/ui/GlobalStrings.fdf`).
//
// Those keys have no counterpart in the player's install — the 2003 game never had a "Healthbars:"
// row or a gamepad button — so the install's own localization cannot translate them. The English
// file stays the single source of truth for the strings and their comments; this table supplies
// the Chinese VALUES, keyed by the same GlobalStrings key. A key missing here simply stays
// English (the transform below only swaps values it knows), and keys are matched line by line
// so the rest of the file — comments, layout, any future entries — is carried through untouched.
const ZH: Readonly<Record<string, string>> = {
  COLON_COMPUTER_PLUS: "电脑+（强化 AI）：",
  COLON_ALL_TALK: "全体语音：",
  COLON_OBSERVER_MODE: "观战模式：",
  COMPUTER_PLUS_DEFAULT: "默认使用电脑+ AI",
  OBSERVERS_TEAM: "观战者",
  COLON_HEALTHBARS: "生命条：",
  DEFAULT_HEALTHBARS: "默认",
  TEAM_COLORED_HEALTHBARS: "队伍颜色",
  COLON_HOTKEYS: "快捷键：",
  HOTKEYS_LEGACY: "经典",
  HOTKEYS_GRID: "网格",
  HOTKEYS_CUSTOM: "自定义",
  SHOW_HOTKEYS_ON_BUTTONS: "在命令按钮上显示快捷键",
  DETECT_GAMEPAD: "检测手柄",
  UNPAIR_GAMEPAD: "断选手柄",
  VOICE_CONTROL: "语音控制",
  COLON_VOICE_CONTROL: "语音控制：",
  DOWNLOAD_VOICE_CONTROL: "下载语音控制依赖",
  DOWNLOADING_VOICE_CONTROL: "正在下载语音控制",
  VOICE_CONTROL_TITLE: "语音控制",
  VSYNC: "垂直同步",
  VSYNC_RESTART: "更改垂直同步需要重启魔兽争霸开源版。现在重启吗？",
  LOW_PERFORMANCE_MODE: "低性能模式",
  MENUS_4_3: "4:3 菜单",
  COLON_SERVER: "服务器：",
  THIS_COMPUTER: "本机",
  NEUTRAL: "中立",
};

/**
 * The English StringList file with the known values swapped for Chinese, when the engine UI is
 * Chinese. Every other locale gets the file back byte for byte.
 */
export function localizedFdfStrings(english: string): string {
  if (currentLocale() !== "zhCN") return english;
  return english
    .split("\n")
    .map((line) => {
      const match = /^\s*([A-Za-z0-9_]+)\s+"/.exec(line);
      if (!match) return line;
      const zh = ZH[match[1]];
      return zh === undefined ? line : line.replace(/"[^"]*"/, `"${zh}"`);
    })
    .join("\n");
}

/**
 * Keys the INSTALL's own GlobalStrings leaves in English even in the zhCN data set (the
 * observer panel's `REPLAY_CAMERA` is one: the label reads "Auto Camera" over a Chinese HUD).
 * Applied to a loaded string table rather than to our override file, because these lines are
 * the install's, not ours.
 */
const INSTALL_ZH: Readonly<Record<string, string>> = {
  REPLAY_CAMERA: "自动视角",
};

/** Swap `INSTALL_ZH`'s keys in a loaded GlobalStrings table, when the UI is Chinese. */
export function localizeGlobalStrings(strings: Map<string, string>): void {
  if (currentLocale() !== "zhCN") return;
  for (const [key, value] of Object.entries(INSTALL_ZH)) strings.set(key, value);
}
