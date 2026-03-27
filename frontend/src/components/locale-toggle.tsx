"use client";

import { useLocale, type Locale } from "@/lib/i18n";

interface Props {
  onChange: (locale: Locale) => void;
}

export function LocaleToggle({ onChange }: Props) {
  const locale = useLocale();

  return (
    <div className="flex rounded-md border border-[var(--border)] text-xs">
      <button
        onClick={() => onChange("ja")}
        className={`px-2 py-0.5 rounded-l-md transition-colors ${
          locale === "ja"
            ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        }`}
      >
        JP
      </button>
      <button
        onClick={() => onChange("en")}
        className={`px-2 py-0.5 rounded-r-md transition-colors ${
          locale === "en"
            ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        }`}
      >
        EN
      </button>
    </div>
  );
}
