import { GlueButton } from "@warcraft-open/ui/react";
import { AndroidIcon, AppleIcon, HarmonyIcon, LinuxIcon, WindowsIcon } from "../Icons";
import type { DownloadRow } from "@/lib/db/schema";
import type { Messages } from "@/i18n/dictionaries/zh";
import { asPlatform, DIRECT_PLATFORMS, formatBytes, formatDate, type Platform } from "@/lib/format";

const ICONS: Record<Platform, React.ReactNode> = {
  windows: <WindowsIcon />,
  linux: <LinuxIcon />,
  macos: <AppleIcon />,
  android: <AndroidIcon />,
  harmony: <HarmonyIcon />,
  other: <WindowsIcon />,
};

/** 游戏下载按钮组。地址来自后台维护的 downloads 表。 */
export function GameDownloads({
  downloads,
  dict,
  locale,
}: {
  downloads: DownloadRow[];
  dict: Messages;
  locale: string;
}) {
  if (downloads.length === 0) {
    return <p className="empty-state">{dict.downloads.empty}</p>;
  }

  return (
    <div className="downloads__row">
      {downloads.map((item) => {
        const platform = asPlatform(item.platform);
        const label = item.label || dict.downloads.platforms[platform];
        const sub = [item.version, item.format, formatBytes(item.size)].filter(Boolean).join(" · ");
        const direct = DIRECT_PLATFORMS.includes(platform);
        return (
          <GlueButton
            key={item.id}
            size="lg"
            bordered
            href={direct ? item.url : `/download/${item.platform}`}
            external={direct}
            hotkey={label.slice(0, 1)}
            icon={ICONS[platform]}
            label={label}
            sub={sub || dict.downloads.download}
            tooltip={{
              title: `${label} — ${item.version ?? dict.downloads.download}`,
              body: (
                <>
                  {dict.hero.requires}
                  {item.updated_at ? <span className="downloads__tooltip-date">{formatDate(item.updated_at, locale)}</span> : null}
                </>
              ),
            }}
          />
        );
      })}
    </div>
  );
}
