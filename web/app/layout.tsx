import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "@openwar3/ui/ui.css";
import "./globals.css";
import { HtmlLang } from "@/components/site/HtmlLang";

// Nowar Sans — the game's own fallback face. The full file is 9.7 MB of CJK; this is its Latin
// subset, renamed "OpenWar3 Sans" because the OFL forbids a modified copy from carrying the
// Reserved Font Name. It ships with the UI kit (packages/ui/src/fonts/, licence beside it).
const gameFont = localFont({
  src: "../node_modules/@openwar3/ui/src/fonts/OpenWar3Sans.woff2",
  variable: "--font-game",
  display: "swap",
  fallback: ["Trebuchet MS", "system-ui", "sans-serif"],
});

const SITE = "https://openwar3.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? SITE),
  title: "魔兽争霸开源版 · Warcraft III Open",
  description:
    "用 TypeScript 重写的魔兽争霸 III 引擎。A modern, open-source reimplementation of the Warcraft III engine.",
  openGraph: {
    title: "魔兽争霸开源版 · Warcraft III Open",
    description: "A modern, open-source reimplementation of the Warcraft III engine.",
    images: ["/media/game2.avif"],
    type: "website",
  },
  twitter: { card: "summary_large_image", images: ["/media/game2.avif"] },
};

export const viewport: Viewport = {
  themeColor: "#02040b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" className={gameFont.variable}>
      <body>
        <HtmlLang />
        {children}
      </body>
    </html>
  );
}
