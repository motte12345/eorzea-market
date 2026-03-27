"use client";

import { useTranslation, taxLabel } from "@/lib/i18n";

export interface TaxSetting {
  buyRate: number;
  sellRate: number;
}

export const TAX_OPTIONS: TaxSetting[] = [
  { buyRate: 0.05, sellRate: 0.05 },
  { buyRate: 0.05, sellRate: 0.03 },
  { buyRate: 0.05, sellRate: 0.00 },
  { buyRate: 0.03, sellRate: 0.05 },
  { buyRate: 0.03, sellRate: 0.03 },
  { buyRate: 0.03, sellRate: 0.00 },
];

interface Props {
  value: number;
  onChange: (index: number) => void;
}

export function TaxSelect({ value, onChange }: Props) {
  const { t, locale } = useTranslation();

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-[var(--muted-foreground)]">{t("taxRate")}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
      >
        {TAX_OPTIONS.map((opt, i) => (
          <option key={i} value={i}>
            {taxLabel(opt.buyRate, opt.sellRate, locale)}
          </option>
        ))}
      </select>
    </div>
  );
}
