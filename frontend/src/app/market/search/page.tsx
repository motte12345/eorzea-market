"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { formatGil } from "@/lib/utils";

interface SearchResponse {
  total: number;
  page: number;
  per_page: number;
  items: {
    id: number;
    name_ja: string;
    name_en: string;
    icon_url: string;
    category: string;
    min_price: number | null;
  }[];
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQ);
  const [searchTerm, setSearchTerm] = useState(initialQ);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (initialQ) {
      setQuery(initialQ);
      setSearchTerm(initialQ);
    }
  }, [initialQ]);

  const { data, isLoading } = useQuery({
    queryKey: ["search-full", searchTerm, page],
    queryFn: async (): Promise<SearchResponse> => {
      const res = await fetch(
        `/api/items/search/full?q=${encodeURIComponent(searchTerm)}&page=${page}&per_page=20`
      );
      return res.json();
    },
    enabled: searchTerm.length > 0,
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchTerm(query.trim());
    setPage(1);
  }

  const totalPages = data ? Math.ceil(data.total / data.per_page) : 0;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">検索結果</h2>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="アイテム名を入力..."
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-[var(--primary)] px-6 py-2 font-medium text-[var(--primary-foreground)] hover:opacity-90"
        >
          検索
        </button>
      </form>

      {isLoading && <p className="text-[var(--muted-foreground)]">検索中...</p>}

      {data && (
        <p className="text-sm text-[var(--muted-foreground)]">
          「{searchTerm}」の検索結果: {data.total}件
        </p>
      )}

      {data && data.items.length > 0 && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted-foreground)]">
                <th className="px-4 py-2">アイテム</th>
                <th className="px-4 py-2">カテゴリ</th>
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
                  <td className="px-4 py-2 text-[var(--muted-foreground)]">
                    {item.category && (
                      <a
                        href={`/market/categories/${encodeURIComponent(item.category)}`}
                        className="hover:text-[var(--primary)]"
                      >
                        {item.category}
                      </a>
                    )}
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

      {data && data.total === 0 && (
        <p className="text-[var(--muted-foreground)]">該当するアイテムが見つかりませんでした</p>
      )}

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
