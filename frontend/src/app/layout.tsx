import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "QP Tools",
  description: "FFXIV プレイヤー向けツール集",
  icons: { icon: "/icon.png" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <Providers>
          <header className="border-b border-[var(--border)] px-6 py-4">
            <div className="mx-auto flex max-w-7xl items-center justify-between">
              <a href="/" className="flex items-center gap-2">
                <img src="/icon.png" alt="" className="h-8 w-8" />
                <span className="text-xl font-bold text-[var(--primary)]">
                  QP Tools
                </span>
              </a>
              <nav className="flex gap-4 text-sm">
                <a href="/" className="hover:text-[var(--primary)]">
                  ホーム
                </a>
                <a href="/market" className="hover:text-[var(--primary)]">
                  マーケット
                </a>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
