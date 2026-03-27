"use client";

import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { LocaleToggle } from "@/components/locale-toggle";
import { useLocaleChange } from "@/app/providers";

export function Header() {
  const pathname = usePathname();
  const isMarket = pathname.startsWith("/market");
  const { t } = useTranslation();
  const changeLocale = useLocaleChange();

  return (
    <header className="border-b border-[var(--border)] px-6 py-3">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        {isMarket ? (
          <a href="/market" className="flex items-center gap-2">
            <img src="/market-icon.png" alt="" className="h-8 w-8" />
            <span className="text-xl font-bold text-[var(--primary)]">
              Eorzea Market
            </span>
          </a>
        ) : (
          <a href="/" className="flex items-center gap-2">
            <img src="/icon.png" alt="" className="h-8 w-8" />
            <span className="text-xl font-bold text-[var(--primary)]">
              QP Tools
            </span>
          </a>
        )}

        <nav className="flex flex-shrink-0 items-center gap-4 text-sm">
          <a href="/" className="hover:text-[var(--primary)]">
            {t("home")}
          </a>
          <a href="/market" className="hover:text-[var(--primary)]">
            {t("market")}
          </a>
          {isMarket && (
            <>
              <a href="/market/categories" className="hover:text-[var(--primary)]">
                {t("categories")}
              </a>
              <a href="/market/releases" className="hover:text-[var(--primary)]">
                {t("releaseNotes")}
              </a>
            </>
          )}
          <LocaleToggle onChange={changeLocale} />
        </nav>
      </div>
    </header>
  );
}
