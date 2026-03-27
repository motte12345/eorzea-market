"use client";

import { useLocale, type Locale } from "@/lib/i18n";

interface Props {
  onChange: (locale: Locale) => void;
}

export function LocaleToggle({ onChange }: Props) {
  const locale = useLocale();

  return (
    <button
      onClick={() => onChange(locale === "ja" ? "en" : "ja")}
      className="rounded border border-[var(--border)] px-2 py-0.5 text-xs hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
    >
      {locale === "ja" ? "EN" : "JP"}
    </button>
  );
}
