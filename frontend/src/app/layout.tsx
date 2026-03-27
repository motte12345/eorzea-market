import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Breadcrumb } from "@/components/breadcrumb";
import { Header } from "@/components/header";
import { SearchBar } from "@/components/search-bar";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "QP Tools",
  description: "ツール集",
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
            __html: `var eorzeadb = { dynamic_tooltip: false };`,
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
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
