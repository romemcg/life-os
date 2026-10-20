import { UpdateWatcher } from "@/components/UpdateWatcher";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav, SubNav } from "@/components/Nav";
import { FocusEngine } from "@/components/Focus";
import { THEME_BOOT } from "@/lib/theme-boot";
import { TechBackground } from "@/components/TechBackground";
import { Space_Grotesk, DM_Sans } from "next/font/google";

const display = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display-face", display: "swap" });
const sans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans-face", display: "swap" });

const DEMO = process.env.LIFEOS_DEMO === "1" || !!process.env.VERCEL;

export const metadata: Metadata = { title: "LIFE OS", description: "Personal execution system" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F6F8FC" }, { media: "(prefers-color-scheme: dark)", color: "#070E1C" }] };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`light ${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="min-h-screen font-sans">
        <TechBackground />
        <Nav />
        <UpdateWatcher />
        <FocusEngine />
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:ml-60 lg:max-w-none lg:px-10 lg:pb-12 lg:pt-8">
          <div className="mx-auto max-w-6xl">
            {DEMO && (
              <div className="mb-4 rounded-2xl border border-ink-700 bg-ink-900 px-4 py-2 text-xs text-fog-300">
                Live demo with fictional data. Changes are temporary and reset on reload. <a className="underline" href="https://github.com/romemcg/life-os" target="_blank" rel="noreferrer">Source on GitHub</a>
              </div>
            )}
            <SubNav />{children}
          </div>
        </main>
      </body>
    </html>
  );
}
