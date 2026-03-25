"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  getWatchlistPrices,
  getExpensiveItems,
  getArbitrageItems,
  getArbitrageProfitItems,
  type WatchlistItem,
  type RankingItem,
} from "@/lib/api";
import {
  getWatchlist,
  removeFromWatchlist as removeItem,
} from "@/lib/watchlist-store";
import { TaxSelect, TAX_OPTIONS } from "@/components/tax-toggle";
import { formatGil, calcArbitrageProfit } from "@/lib/utils";
import { getSettings, saveSettings } from "@/lib/settings-store";

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
  const [arbRegions, setArbRegions] = useState<string[]>(REGIONS);

  useEffect(() => {
    const s = getSettings();
    setTaxIndex(s.taxIndex);
    setArbRegions(s.arbRegions);
  }, []);

  function handleTaxChange(idx: number) {
    setTaxIndex(idx);
    saveSettings({ taxIndex: idx });
  }

  function toggleArbRegion(region: string) {
    setArbRegions((prev) => {
      const next = prev.includes(region)
        ? prev.filter((r) => r !== region)
        : [...prev, region];
      if (next.length < 2) return prev; // 最低2つ必要
      saveSettings({ arbRegions: next });
      return next;
    });
  }

  useEffect(() => {
    setItemIds(getWatchlist());
  }, []);

  const { data: watchlistData, isLoading } = useQuery({
    queryKey: ["watchlist", itemIds],
    queryFn: () => getWatchlistPrices(itemIds),
    enabled: itemIds.length > 0,
    refetchInterval: 60 * 1000,
  });

  const { data: expensiveItems } = useQuery({
    queryKey: ["ranking-expensive"],
    queryFn: () => getExpensiveItems(20),
    staleTime: 10 * 60 * 1000,
  });

  const { data: arbitrageItems } = useQuery({
    queryKey: ["ranking-arbitrage"],
    queryFn: () => getArbitrageItems(20),
    staleTime: 10 * 60 * 1000,
  });

  const { data: arbitrageProfitItems } = useQuery({
    queryKey: ["ranking-arbitrage-profit"],
    queryFn: () => getArbitrageProfitItems(20),
    staleTime: 10 * 60 * 1000,
  });

  const [expExpanded, setExpExpanded] = useState(false);
  const [arbExpanded, setArbExpanded] = useState(false);
  const [arbMode, setArbMode] = useState<"rate" | "profit">("profit");

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
    // 差益計算対象リージョンのみ
    const regionMins = arbRegions.map((r) => {
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
          {itemIds.length > 0 && (
            <span className="text-sm text-[var(--muted-foreground)]">
              {itemIds.length} アイテム
            </span>
          )}
        </div>

        {/* 差益設定 */}
        {itemIds.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-[var(--muted-foreground)]">差益比較:</span>
              {REGIONS.map((r) => (
                <label
                  key={r}
                  className="flex cursor-pointer items-center gap-1"
                >
                  <input
                    type="checkbox"
                    checked={arbRegions.includes(r)}
                    onChange={() => toggleArbRegion(r)}
                    className="accent-[var(--primary)]"
                  />
                  <span
                    className={
                      arbRegions.includes(r)
                        ? "text-[var(--foreground)]"
                        : "text-[var(--muted-foreground)]"
                    }
                  >
                    {REGION_SHORT[r]}
                  </span>
                </label>
              ))}
            </div>
            <TaxSelect value={taxIndex} onChange={handleTaxChange} />
          </div>
        )}

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
                    <th
                      key={r}
                      className={`px-3 py-2.5 text-right ${
                        arbRegions.includes(r) ? "" : "opacity-40"
                      }`}
                    >
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
                        const inArb = arbRegions.includes(region);
                        const isLowest =
                          inArb && arb && price && price.min_price === arb.cheapest.min_price;
                        const isHighest =
                          inArb && arb && price && price.min_price === arb.expensive.min_price;
                        return (
                          <td
                            key={region}
                            className={`px-3 py-2.5 text-right font-mono text-sm ${
                              inArb ? "" : "opacity-40"
                            }`}
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

      {/* ランキング */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">ランキング</h2>
        <a
          href="/market/excluded"
          className="text-xs text-[var(--muted-foreground)] hover:text-[var(--primary)]"
        >
          除外アイテム一覧
        </a>
      </div>
      <section className="grid gap-6 md:grid-cols-2">
        {/* 高額アイテム */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <h3 className="font-bold">高額アイテム</h3>
          </div>
          {expensiveItems && expensiveItems.length > 0 ? (
            <>
              <table className="w-full text-sm">
                <tbody>
                  {expensiveItems.slice(0, expExpanded ? 20 : 5).map((item, i) => (
                    <tr
                      key={item.item_id}
                      className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)] transition-colors"
                    >
                      <td className="px-4 py-2.5 w-8 text-center text-[var(--muted-foreground)]">
                        {i + 1}
                      </td>
                      <td className="py-2.5">
                        <a
                          href={`/market/items/${item.item_id}`}
                          className="flex items-center gap-2 hover:text-[var(--primary)]"
                        >
                          {item.icon_url && (
                            <img src={item.icon_url} alt="" className="h-6 w-6" />
                          )}
                          <div className="min-w-0">
                            <div className="truncate">
                              {item.name_ja || item.name_en}
                            </div>
                            <div className="text-[10px] text-[var(--muted-foreground)]">
                              {item.min_dc} {item.min_world}
                            </div>
                          </div>
                        </a>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-[var(--primary)]">
                        {formatGil(item.min_price ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {expensiveItems.length > 5 && (
                <button
                  onClick={() => setExpExpanded((v) => !v)}
                  className="w-full border-t border-[var(--border)] py-2 text-center text-xs text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
                >
                  {expExpanded ? "折りたたむ" : `他 ${expensiveItems.length - 5} 件を表示`}
                </button>
              )}
            </>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-[var(--muted-foreground)]">
              データ取得中...
            </p>
          )}
        </div>

        {/* 転売ランキング */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <h3 className="font-bold">JP ↔ NA 価格差ランキング</h3>
            <div className="flex rounded-md border border-[var(--border)]">
              <button
                onClick={() => { setArbMode("rate"); setArbExpanded(false); }}
                className={`px-2 py-0.5 text-xs ${
                  arbMode === "rate"
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "text-[var(--muted-foreground)]"
                }`}
              >
                利益率順
              </button>
              <button
                onClick={() => { setArbMode("profit"); setArbExpanded(false); }}
                className={`px-2 py-0.5 text-xs ${
                  arbMode === "profit"
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "text-[var(--muted-foreground)]"
                }`}
              >
                差額順
              </button>
            </div>
          </div>
          {(() => {
            const filtered = arbMode === "rate" ? arbitrageItems : arbitrageProfitItems;
            return filtered && filtered.length > 0 ? (
              <>
                <table className="w-full text-sm">
                  <tbody>
                    {filtered.slice(0, arbExpanded ? 20 : 5).map((item, i) => {
                      const buyDC = item.buy_info ?? "";
                      const sellDC = item.sell_info ?? "";
                      return (
                        <tr
                          key={item.item_id}
                          className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)] transition-colors"
                        >
                          <td className="px-4 py-2.5 w-8 text-center text-[var(--muted-foreground)]">
                            {i + 1}
                          </td>
                          <td className="py-2.5">
                            <a
                              href={`/market/items/${item.item_id}`}
                              className="flex items-center gap-2 hover:text-[var(--primary)]"
                            >
                              {item.icon_url && (
                                <img src={item.icon_url} alt="" className="h-6 w-6" />
                              )}
                              <div className="min-w-0">
                                <div className="truncate">
                                  {item.name_ja || item.name_en}
                                </div>
                                <div className="text-[10px] text-[var(--muted-foreground)]">
                                  {buyDC} → {sellDC}
                                </div>
                              </div>
                            </a>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="font-mono text-[var(--positive)]">
                              +{formatGil(item.profit ?? 0)}
                            </div>
                            <div className="text-[10px] text-[var(--muted-foreground)]">
                              {item.profit_rate}%
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filtered.length > 5 && (
                  <button
                    onClick={() => setArbExpanded((v) => !v)}
                    className="w-full border-t border-[var(--border)] py-2 text-center text-xs text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
                  >
                    {arbExpanded ? "折りたたむ" : `他 ${filtered.length - 5} 件を表示`}
                  </button>
                )}
              </>
            ) : (
              <p className="px-4 py-6 text-center text-sm text-[var(--muted-foreground)]">
                データ取得中...
              </p>
            );
          })()}
        </div>
      </section>
    </div>
  );
}
