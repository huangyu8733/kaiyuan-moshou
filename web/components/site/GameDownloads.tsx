"use client";

import { useEffect, useState } from "react";
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

type Os = "macos" | "windows" | "linux";
type Arch = "arm64" | "x64";

function detectOs(): Os | null {
  const ua = navigator.userAgent.toLowerCase();
  if (/mac os x|macintosh/.test(ua)) return "macos";
  if (/windows/.test(ua)) return "windows";
  if (/linux/.test(ua) && !/android/.test(ua)) return "linux";
  return null;
}

/** Safari on Apple Silicon still says "Intel Mac" in the UA; its GPU string does not. */
function appleSiliconByGpu(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl") as WebGLRenderingContext | null;
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    const renderer = ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
    return /apple/i.test(renderer);
  } catch {
    return false;
  }
}

async function detectArch(os: Os): Promise<Arch> {
  const uaData = (navigator as unknown as {
    userAgentData?: { getHighEntropyValues(hints: string[]): Promise<{ architecture?: string; bitness?: string }> };
  }).userAgentData;
  if (uaData?.getHighEntropyValues) {
    try {
      const values = await uaData.getHighEntropyValues(["architecture", "bitness"]);
      if (values.architecture === "arm") return "arm64";
      if (values.bitness === "64") return "x64";
    } catch {
      // Fall through to the UA/GPU guess.
    }
  }
  if (os === "macos") return appleSiliconByGpu() ? "arm64" : "x64";
  return "x64";
}

/** The one build on this page that fits the machine the visitor is holding. */
function pickRecommended(downloads: DownloadRow[], os: Os, arch: Arch): DownloadRow | null {
  const text = (row: DownloadRow): string => `${row.label ?? ""} ${row.format ?? ""} ${row.url}`.toLowerCase();
  if (os === "macos") {
    return (
      downloads.find(
        (row) => asPlatform(row.platform) === "macos" &&
          (arch === "arm64" ? /apple silicon|arm64/.test(text(row)) : /intel|x64/.test(text(row))),
      ) ?? null
    );
  }
  if (os === "linux") {
    return (
      downloads.find(
        (row) => asPlatform(row.platform) === "linux" &&
          (arch === "arm64" ? /arm64/.test(text(row)) : /appimage/.test(text(row)) && !/arm64/.test(text(row))),
      ) ?? null
    );
  }
  if (os === "windows") return downloads.find((row) => asPlatform(row.platform) === "windows") ?? null;
  return null;
}

/** 游戏下载按钮组。地址来自后台维护的 downloads 表；进入页面后按当前系统把合适的那个排在最前。 */
export function GameDownloads({
  downloads,
  dict,
  locale,
}: {
  downloads: DownloadRow[];
  dict: Messages;
  locale: string;
}) {
  const [recommendedId, setRecommendedId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const os = detectOs();
    if (!os) return;
    void detectArch(os).then((arch) => {
      if (cancelled) return;
      const match = pickRecommended(downloads, os, arch);
      if (match) setRecommendedId(match.id);
    });
    return () => {
      cancelled = true;
    };
  }, [downloads]);

  if (downloads.length === 0) {
    return <p className="empty-state">{dict.downloads.empty}</p>;
  }

  const recommended = downloads.find((row) => row.id === recommendedId) ?? null;
  const ordered = recommended ? [recommended, ...downloads.filter((row) => row.id !== recommended.id)] : downloads;

  return (
    <div className="downloads__group">
      {recommended ? (
        <p className="downloads__recommend">
          {dict.hero.recommended}：{recommended.label || dict.downloads.platforms[asPlatform(recommended.platform)]}
        </p>
      ) : null}
      <div className="downloads__row">
        {ordered.map((item) => {
          const platform = asPlatform(item.platform);
          const label = item.label || dict.downloads.platforms[platform];
          const sub = [item.version, item.format, formatBytes(item.size)].filter(Boolean).join(" · ");
          const direct = DIRECT_PLATFORMS.includes(platform);
          return (
            <div className="downloads__item" key={item.id}>
              {item.id === recommendedId ? <span className="downloads__badge">{dict.hero.recommendedBadge}</span> : null}
              <GlueButton
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
                      {item.updated_at ? (
                        <span className="downloads__tooltip-date">{formatDate(item.updated_at, locale)}</span>
                      ) : null}
                    </>
                  ),
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
