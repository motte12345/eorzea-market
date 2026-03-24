"use client";

export interface TaxSetting {
  buyRate: number;
  sellRate: number;
  label: string;
}

export const TAX_OPTIONS: TaxSetting[] = [
  { buyRate: 0.05, sellRate: 0.05, label: "購入5% / 売却5%" },
  { buyRate: 0.05, sellRate: 0.03, label: "購入5% / 売却3%" },
  { buyRate: 0.05, sellRate: 0.00, label: "購入5% / 売却0%" },
  { buyRate: 0.03, sellRate: 0.05, label: "購入3% / 売却5%" },
  { buyRate: 0.03, sellRate: 0.03, label: "購入3% / 売却3%" },
  { buyRate: 0.03, sellRate: 0.00, label: "購入3% / 売却0%" },
];

interface Props {
  value: number;
  onChange: (index: number) => void;
}

export function TaxSelect({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-[var(--muted-foreground)]">税率:</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
      >
        {TAX_OPTIONS.map((opt, i) => (
          <option key={i} value={i}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
