"use client";

import { useQuery } from "@tanstack/react-query";
import { use, useState } from "react";
import { formatGil } from "@/lib/utils";

interface Props {
  params: Promise<{ category: string }>;
}

interface CategoryItemsResponse {
  total: number;
  page: number;
  per_page: number;
  items: {
    id: number;
    name_ja: string;
    name_en: string;
    icon_url: string;
    min_price: number | null;
  }[];
}

export default function CategoryItemsPage({ params }: Props) {
  const { category } = use(params);
  const categoryName = decodeURIComponent(category);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("name");

  const { data, isLoading } = useQuery({
    queryKey: ["category-items", categoryName, page, sort],
    queryFn: async (): Promise<CategoryItemsResponse> => {
      const res = await fetch(
        `/api/categories/${encodeURIComponent(categoryName)}/items?page=${page}&per_page=20&sort=${sort}`
      );
      return res.json();
    },
  });

  const totalPages = data ? Math.ceil(data.total / data.per_page) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{categoryName}</h2>
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value); setPage(1); }}
            className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
          >
            <option value="name">名前順</option>
            <option value="price_asc">安い順</option>
            <option value="price_desc">高い順</option>
          </select>
          {data && (
            <span className="text-sm text-[var(--muted-foreground)]">
              {data.total}件
            </span>
          )}
        </div>
      </div>

      {isLoading && (
        <p className="text-[var(--muted-foreground)]">読み込み中...</p>
      )}

      {data && data.items.length > 0 && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted-foreground)]">
                <th className="px-4 py-2">アイテム</th>
                <th className="px-4 py-2 text-right">最安値</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)] transition-colors"
                >
                  <td className="px-4 py-2">
                    <a
                      href={`/market/items/${item.id}`}
                      className="flex items-center gap-2 hover:text-[var(--primary)]"
                    >
                      {item.icon_url && (
                        <img src={item.icon_url} alt="" className="h-6 w-6" />
                      )}
                      <span>{item.name_ja || item.name_en}</span>
                    </a>
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {item.min_price != null
                      ? formatGil(item.min_price)
                      : <span className="text-[var(--muted-foreground)]">-</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded border border-[var(--border)] px-3 py-1 text-sm disabled:opacity-30"
          >
            前へ
          </button>
          <span className="text-sm text-[var(--muted-foreground)]">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded border border-[var(--border)] px-3 py-1 text-sm disabled:opacity-30"
          >
            次へ
          </button>
        </div>
      )}
    </div>
  );
}
