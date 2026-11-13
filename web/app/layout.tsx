import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "@warcraft-open/ui/ui.css";
import "./globals.css";
import { HtmlLang } from "@/components/site/HtmlLang";

// Nowar Sans — the game's own fallback face. The full file is 9.7 MB of CJK; this is its Latin
// subset, renamed "Warcraft Open Sans" because the OFL forbids a modified copy from carrying the
// Reserved Font Name. It ships with the UI kit (packages/ui/src/fonts/, licence beside it).
const gameFont = localFont({
  src: "../node_modules/@warcraft-open/ui/src/fonts/WarcraftOpenSans.woff2",
  variable: "--font-game",
  display: "swap",
  fallback: ["Trebuchet MS", "system-ui", "sans-serif"],
});

const SITE = "https://warcraft.hhkj.me";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? SITE),
  title: "魔兽争霸开源版 · Warcraft Open",
  description:
    "用 TypeScript 重写的魔兽争霸 III 引擎。A modern, open-source reimplementation of the Warcraft III engine.",
  openGraph: {
    title: "魔兽争霸开源版 · Warcraft Open",
    description: "A modern, open-source reimplementation of the Warcraft III engine.",
    images: ["/media/hero.avif"],
    type: "website",
  },
  twitter: { card: "summary_large_image", images: ["/media/hero.avif"] },
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
