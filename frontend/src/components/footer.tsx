"use client";

import { useTranslation } from "@/lib/i18n";

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-[var(--border)] px-6 py-4 mt-12">
      <div className="mx-auto max-w-7xl text-center text-[10px] leading-relaxed text-[var(--muted-foreground)]">
        <p>
          FINAL FANTASY XIV &copy; SQUARE ENIX CO., LTD. All Rights Reserved.
        </p>
        <p>{t("copyright")}</p>
      </div>
    </footer>
  );
}
