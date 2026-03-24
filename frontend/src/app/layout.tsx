import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Breadcrumb } from "@/components/breadcrumb";
import { Header } from "@/components/header";
import { SearchBar } from "@/components/search-bar";

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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `var eorzeadb = { dynamic_tooltip: true };`,
          }}
        />
        <script src="https://lds-img.finalfantasyxiv.com/pc/global/js/eorzeadb/loader.js?v3" />
      </head>
      <body>
        <Providers>
          <Header />
          <Breadcrumb />
          <SearchBar />
          <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
          <footer className="border-t border-[var(--border)] px-6 py-4 mt-12">
            <div className="mx-auto max-w-7xl text-center text-[10px] leading-relaxed text-[var(--muted-foreground)]">
              <p>
                FINAL FANTASY XIV &copy; SQUARE ENIX CO., LTD. All Rights Reserved.
              </p>
              <p>
                記載されている会社名・製品名・システム名などは、各社の商標、または登録商標です。
              </p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
