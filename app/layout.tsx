import { UpdateWatcher } from "@/components/UpdateWatcher";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav, SubNav } from "@/components/Nav";
import { THEME_BOOT } from "@/lib/theme-boot";

export const metadata: Metadata = { title: "LIFE OS", description: "Personal execution system" };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="min-h-screen font-sans">
        <Nav />
        <UpdateWatcher />
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:ml-60 lg:max-w-none lg:px-10 lg:pb-12 lg:pt-8">
          <div className="mx-auto max-w-6xl"><SubNav />{children}</div>
        </main>
      </body>
    </html>
  );
}
