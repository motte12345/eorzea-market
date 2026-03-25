"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense, useMemo } from "react";
import { formatGil } from "@/lib/utils";
import { getWatchlistPrices, type WatchlistItem } from "@/lib/api";

interface SearchItem {
  id: number;
  name_ja: string;
  name_en: string;
  icon_url: string;
  category: string;
  min_price: number | null;
}

interface SearchResponse {
  total: number;
  page: number;
  per_page: number;
  items: SearchItem[];
}

const REGIONS = ["Japan", "North-America", "Europe", "Oceania"];
const REGION_SHORT: Record<string, string> = {
  Japan: "JP", "North-America": "NA", Europe: "EU", Oceania: "OCE",
};
const PER_PAGE = 20;

export default function SearchPage() {
  return (
    <Suspense fallback={<p className="text-[var(--muted-foreground)]">読み込み中...</p>}>
      <SearchContent />
    </Suspense>
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<"name" | "id_asc" | "id_desc" | "price_asc" | "price_desc">("name");

  useEffect(() => {
    setSearchTerm(q);
    setPage(1);
  }, [q]);

  // 最大200件を一括取得
  const { data: searchData, isLoading } = useQuery({
    queryKey: ["search-full", searchTerm],
    queryFn: async (): Promise<SearchResponse> => {
      const res = await fetch(
        `/api/items/search/full?q=${encodeURIComponent(searchTerm)}&page=1&per_page=200`
      );
      return res.json();
    },
    enabled: searchTerm.length > 0,
  });

  // ソート
  const sortedItems = useMemo(() => {
    if (!searchData?.items) return [];
    const items = [...searchData.items];
    switch (sort) {
      case "price_asc":
        return items.sort((a, b) => (a.min_price ?? Infinity) - (b.min_price ?? Infinity));
      case "price_desc":
        return items.sort((a, b) => (b.min_price ?? -1) - (a.min_price ?? -1));
      case "id_asc":
        return items.sort((a, b) => a.id - b.id);
      case "id_desc":
        return items.sort((a, b) => b.id - a.id);
      case "name":
        return items.sort((a, b) => (a.name_ja || a.name_en).localeCompare(b.name_ja || b.name_en, "ja"));
    }
  }, [searchData, sort]);

  // ページネーション（クライアント側）
  const totalPages = Math.ceil(sortedItems.length / PER_PAGE);
  const pageItems = sortedItems.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const pageItemIds = pageItems.map((i) => i.id);

  // 表示中のアイテムのリージョン価格を取得
  const { data: regionPrices } = useQuery({
    queryKey: ["search-region-prices", pageItemIds],
    queryFn: () => getWatchlistPrices(pageItemIds),
    enabled: pageItemIds.length > 0,
  });

  const priceMap = useMemo(() => {
    const map = new Map<number, WatchlistItem>();
    if (regionPrices) {
      for (const item of regionPrices) {
        map.set(item.item_id, item);
      }
    }
    return map;
  }, [regionPrices]);

  function getRegionMin(itemId: number, region: string) {
    const item = priceMap.get(itemId);
    if (!item) return null;
    const prices = item.prices_by_dc.filter((p) => p.region === region);
    if (prices.length === 0) return null;
    return prices.reduce((a, b) => (a.min_price < b.min_price ? a : b));
  }

  function getArbitrage(itemId: number) {
    const mins = REGIONS.map((r) => {
      const p = getRegionMin(itemId, r);
      return p ? { ...p, region: r } : null;
    }).filter(Boolean) as { min_price: number; region: string }[];
    if (mins.length < 2) return null;
    const sorted = [...mins].sort((a, b) => a.min_price - b.min_price);
    const profit = sorted[sorted.length - 1].min_price - sorted[0].min_price;
    return profit > 0 ? profit : null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">検索結果</h2>
          {searchData && (
            <p className="text-sm text-[var(--muted-foreground)]">
              「{searchTerm}」{searchData.total}件
              {searchData.total > 200 && "（上位200件を表示）"}
            </p>
          )}
        </div>
        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value as typeof sort); setPage(1); }}
          className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
        >
          <option value="name">名前順</option>
          <option value="price_asc">安い順</option>
          <option value="price_desc">高い順</option>
          <option value="id_desc">ID（新しい順）</option>
          <option value="id_asc">ID（古い順）</option>
        </select>
      </div>

      {isLoading && <p className="text-[var(--muted-foreground)]">検索中...</p>}

      {pageItems.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--card)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted-foreground)]">
                <th className="px-3 py-2">アイテム</th>
                <th className="px-3 py-2">カテゴリ</th>
                <th className="px-3 py-2 text-right">最安値</th>
                {REGIONS.map((r) => (
                  <th key={r} className="px-3 py-2 text-right">{REGION_SHORT[r]}</th>
                ))}
                <th className="px-3 py-2 text-right">差益</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((item) => {
                const arb = getArbitrage(item.id);
                return (
                  <tr
                    key={item.id}
                    className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)] transition-colors"
                  >
                    <td className="px-3 py-2">
                      <a
                        href={`/market/items/${item.id}`}
                        className="flex items-center gap-2 hover:text-[var(--primary)]"
                      >
                        {item.icon_url && (
                          <img src={item.icon_url} alt="" className="h-6 w-6" />
                        )}
                        <span className="truncate">{item.name_ja || item.name_en}</span>
                      </a>
                    </td>
                    <td className="px-3 py-2 text-xs text-[var(--muted-foreground)]">
                      {item.category && (
                        <a
                          href={`/market/categories/${encodeURIComponent(item.category)}`}
                          className="hover:text-[var(--primary)]"
                        >
                          {item.category}
                        </a>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {(() => {
                        const allMins = REGIONS.map((r) => getRegionMin(item.id, r)).filter(Boolean);
                        if (allMins.length === 0) {
                          return item.min_price != null
                            ? formatGil(item.min_price)
                            : <span className="text-[var(--muted-foreground)]">-</span>;
                        }
                        const best = allMins.reduce((a, b) => a!.min_price < b!.min_price ? a : b)!;
                        return (
                          <div>
                            <span className="text-[var(--positive)]">{formatGil(best.min_price)}</span>
                            <div className="text-[10px] text-[var(--muted-foreground)]">{best.world_name}</div>
                          </div>
                        );
                      })()}
                    </td>
                    {REGIONS.map((region) => {
                      const price = getRegionMin(item.id, region);
                      return (
                        <td key={region} className="px-3 py-2 text-right font-mono text-xs">
                          {price ? (
                            <div>
                              {formatGil(price.min_price)}
                              <div className="text-[10px] text-[var(--muted-foreground)]">
                                {price.world_name}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[var(--muted-foreground)]">-</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {arb ? (
                        <span className="text-[var(--positive)]">+{formatGil(arb)}</span>
                      ) : (
                        <span className="text-[var(--muted-foreground)]">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {searchData && searchData.total === 0 && (
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
