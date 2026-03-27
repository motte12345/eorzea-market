"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n";

interface ExcludedData {
  ids: number[];
  items: { id: number; name_ja: string; name_en: string; icon_url: string }[];
  note: string;
}

async function fetchExcluded(): Promise<ExcludedData> {
  const res = await fetch("/api/ranking/excluded");
  return res.json();
}

export default function ExcludedPage() {
  const { t, name: itemName } = useTranslation();
  const { data } = useQuery({
    queryKey: ["excluded"],
    queryFn: fetchExcluded,
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">{t("excludedItemsTitle")}</h2>

      {data && (
        <>
          <p className="text-sm text-[var(--muted-foreground)]">{data.note}</p>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted-foreground)]">
                  <th className="px-4 py-2">ID</th>
                  <th className="px-4 py-2">{t("item")}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)] transition-colors"
                  >
                    <td className="px-4 py-2 font-mono text-[var(--muted-foreground)]">
                      {item.id}
                    </td>
                    <td className="px-4 py-2">
                      <a
                        href={`/market/items/${item.id}`}
                        className="flex items-center gap-2 hover:text-[var(--primary)]"
                      >
                        {item.icon_url && (
                          <img src={item.icon_url} alt="" className="h-6 w-6" />
                        )}
                        <span>{itemName(item.name_ja, item.name_en)}</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
