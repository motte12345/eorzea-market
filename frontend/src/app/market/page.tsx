"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getWatchlistPrices, type WatchlistItem } from "@/lib/api";
import {
  getWatchlist,
  removeFromWatchlist as removeItem,
} from "@/lib/watchlist-store";
import { TaxSelect, TAX_OPTIONS } from "@/components/tax-toggle";
import { formatGil, calcArbitrageProfit } from "@/lib/utils";

const REGIONS = ["Japan", "North-America", "Europe", "Oceania"];
const REGION_SHORT: Record<string, string> = {
  Japan: "JP",
  "North-America": "NA",
  Europe: "EU",
  Oceania: "OCE",
};

export default function HomePage() {
  const [itemIds, setItemIds] = useState<number[]>([]);
  const [taxIndex, setTaxIndex] = useState(0);

  useEffect(() => {
    setItemIds(getWatchlist());
  }, []);

  const { data: watchlistData, isLoading } = useQuery({
    queryKey: ["watchlist", itemIds],
    queryFn: () => getWatchlistPrices(itemIds),
    enabled: itemIds.length > 0,
    refetchInterval: 60 * 1000,
  });

  function handleRemove(itemId: number) {
    const updated = removeItem(itemId);
    setItemIds(updated);
  }

  function getRegionBestPrice(item: WatchlistItem, region: string) {
    const prices = item.prices_by_dc.filter((p) => p.region === region);
    if (prices.length === 0) return null;
    return prices.reduce((a, b) => (a.min_price < b.min_price ? a : b));
  }

  function getArbitrage(item: WatchlistItem) {
    const regionMins = REGIONS.map((r) => {
      const p = getRegionBestPrice(item, r);
      return p ? { ...p, region: r } : null;
    }).filter(Boolean) as (typeof item.prices_by_dc[0] & { region: string })[];

    if (regionMins.length < 2) return null;

    const sorted = [...regionMins].sort((a, b) => a.min_price - b.min_price);
    const cheapest = sorted[0];
    const expensive = sorted[sorted.length - 1];
    const tax = TAX_OPTIONS[taxIndex];
    const arb = calcArbitrageProfit(cheapest.min_price, expensive.min_price, tax.buyRate, tax.sellRate);

    return { cheapest, expensive, ...arb };
  }

  return (
    <div className="space-y-8">
      {/* ウォッチリスト */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">ウォッチリスト</h2>
          <div className="flex items-center gap-4">
            <TaxSelect value={taxIndex} onChange={setTaxIndex} />
            {itemIds.length > 0 && (
              <span className="text-sm text-[var(--muted-foreground)]">
                {itemIds.length} アイテム
              </span>
            )}
          </div>
        </div>

        {itemIds.length === 0 && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-8 text-center text-[var(--muted-foreground)]">
            <p>ウォッチリストにアイテムがありません</p>
            <p className="mt-2 text-sm">
              上の検索バーからアイテムを探して追加してください
            </p>
          </div>
        )}

        {isLoading && (
          <p className="text-[var(--muted-foreground)]">読み込み中...</p>
        )}

        {watchlistData && watchlistData.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--card)] text-left text-[var(--muted-foreground)]">
                  <th className="px-3 py-2.5">アイテム</th>
                  {REGIONS.map((r) => (
                    <th key={r} className="px-3 py-2.5 text-right">
                      {REGION_SHORT[r]}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-right">差益</th>
                  <th className="px-3 py-2.5 text-center w-10"></th>
                </tr>
              </thead>
              <tbody>
                {watchlistData.map((item) => {
                  const arb = getArbitrage(item);
                  return (
                    <tr
                      key={item.item_id}
                      className="border-b border-[var(--border)] transition-colors hover:bg-[var(--card)]"
                    >
                      <td className="px-3 py-2.5">
                        <a
                          href={`/market/items/${item.item_id}`}
                          className="flex items-center gap-2 hover:text-[var(--primary)]"
                        >
                          {item.icon_url && (
                            <img src={item.icon_url} alt="" className="h-6 w-6" />
                          )}
                          <span>{item.name_ja || item.name_en}</span>
                        </a>
                      </td>
                      {REGIONS.map((region) => {
                        const price = getRegionBestPrice(item, region);
                        const isLowest =
                          arb && price && price.min_price === arb.cheapest.min_price;
                        const isHighest =
                          arb && price && price.min_price === arb.expensive.min_price;
                        return (
                          <td
                            key={region}
                            className="px-3 py-2.5 text-right font-mono text-sm"
                          >
                            {price ? (
                              <a
                                href={`/market/items/${item.item_id}?tab=history&server=${encodeURIComponent(price.world_name)}`}
                                className="block hover:opacity-80"
                              >
                                <span
                                  className={
                                    isLowest
                                      ? "text-[var(--positive)]"
                                      : isHighest
                                        ? "text-[var(--destructive)]"
                                        : ""
                                  }
                                >
                                  {formatGil(price.min_price)}
                                </span>
                                <div className="text-[10px] text-[var(--muted-foreground)]">
                                  {price.world_name}
                                </div>
                              </a>
                            ) : (
                              <span className="text-[var(--muted-foreground)]">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-right font-mono text-sm">
                        {arb && arb.profit > 0 ? (
                          <div>
                            <span className="text-[var(--positive)]">
                              +{formatGil(arb.profit)}
                            </span>
                            <div className="text-[10px] text-[var(--muted-foreground)]">
                              {arb.rate.toFixed(1)}%
                            </div>
                          </div>
                        ) : (
                          <span className="text-[var(--muted-foreground)]">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => handleRemove(item.item_id)}
                          className="text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
                          title="削除"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
