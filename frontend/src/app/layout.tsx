import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/header";

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
          <Header />
          <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
