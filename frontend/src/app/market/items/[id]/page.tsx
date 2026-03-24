"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { use, useEffect, useState } from "react";
import {
  getItem,
  getItemPrices,
  getItemHistory,
  getItemPriceHistory,
  refreshItem,
  type PriceByWorld,
} from "@/lib/api";
import { PriceChart } from "@/components/price-chart";
import {
  addToWatchlist,
  isInWatchlist,
  removeFromWatchlist,
} from "@/lib/watchlist-store";
import { formatGil, timeAgo } from "@/lib/utils";

interface Props {
  params: Promise<{ id: string }>;
}

type Tab = "listings" | "history" | "chart";

const REGION_ORDER = ["Japan", "North-America", "Europe", "Oceania"];

interface WorldSummary {
  world_name: string;
  min_price: number;
  min_listing: PriceByWorld;
  listing_count: number;
  all_listings: PriceByWorld[];
  last_upload_at: string | null;
}

interface DCGroup {
  data_center: string;
  worlds: WorldSummary[];
  total_listings: number;
}

interface RegionGroup {
  region: string;
  dcs: DCGroup[];
  min_price: number;
  min_world: string;
}

function buildRegionGroups(prices: PriceByWorld[]): RegionGroup[] {
  // DC → World → listings
  const regionMap = new Map<string, Map<string, Map<string, PriceByWorld[]>>>();

  for (const p of prices) {
    let dcMap = regionMap.get(p.region);
    if (!dcMap) {
      dcMap = new Map();
      regionMap.set(p.region, dcMap);
    }
    let worldMap = dcMap.get(p.data_center);
    if (!worldMap) {
      worldMap = new Map();
      dcMap.set(p.data_center, worldMap);
    }
    const list = worldMap.get(p.world_name) ?? [];
    list.push(p);
    worldMap.set(p.world_name, list);
  }

  return REGION_ORDER
    .filter((r) => regionMap.has(r))
    .map((region) => {
      const dcMap = regionMap.get(region)!;
      let regionMin = Infinity;
      let regionMinWorld = "";

      const dcs: DCGroup[] = Array.from(dcMap.entries())
        .map(([dc, worldMap]) => {
          const worlds: WorldSummary[] = Array.from(worldMap.entries())
            .map(([worldName, listings]) => {
              const sorted = [...listings].sort(
                (a, b) => a.price_per_unit - b.price_per_unit
              );
              const minPrice = sorted[0].price_per_unit;
              if (minPrice < regionMin) {
                regionMin = minPrice;
                regionMinWorld = worldName;
              }
              // last_upload_at: そのワールドの出品の中で最新のもの
              const uploadTimes = listings
                .map((l) => l.last_upload_at)
                .filter(Boolean) as string[];
              const latestUpload =
                uploadTimes.length > 0
                  ? uploadTimes.sort().reverse()[0]
                  : null;

              return {
                world_name: worldName,
                min_price: minPrice,
                min_listing: sorted[0],
                listing_count: listings.length,
                all_listings: sorted,
                last_upload_at: latestUpload,
              };
            })
            .sort((a, b) => a.min_price - b.min_price);

          return {
            data_center: dc,
            worlds,
            total_listings: worlds.reduce((s, w) => s + w.listing_count, 0),
          };
        })
        .sort((a, b) => {
          const aMin = a.worlds[0]?.min_price ?? Infinity;
          const bMin = b.worlds[0]?.min_price ?? Infinity;
          return aMin - bMin;
        });

      return { region, dcs, min_price: regionMin, min_world: regionMinWorld };
    });
}

export default function ItemDetailPage({ params }: Props) {
  const { id } = use(params);
  const itemId = Number(id);
  const [hqFilter, setHqFilter] = useState<boolean | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<Tab>("listings");
  const [expandedWorlds, setExpandedWorlds] = useState<Set<string>>(new Set());
  const [inWatchlist, setInWatchlist] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState("");

  useEffect(() => {
    setInWatchlist(isInWatchlist(itemId));
  }, [itemId]);

  const { data: item } = useQuery({
    queryKey: ["item", itemId],
    queryFn: () => getItem(itemId),
  });

  const { data: prices, isLoading: pricesLoading } = useQuery({
    queryKey: ["item-prices", itemId, hqFilter],
    queryFn: () => getItemPrices(itemId, hqFilter),
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["item-history", itemId],
    queryFn: () => getItemHistory(itemId, 100),
    enabled: activeTab === "history",
  });

  // 公式ツールチップの再初期化
  useEffect(() => {
    if (item?.lodestone_id) {
      const w = window as unknown as Record<string, unknown>;
      const edb = w.eorzeadb as Record<string, unknown> | undefined;
      if (edb && typeof edb.init === "function") {
        const jq = w.jQuery as (() => void) | undefined;
        if (jq) {
          (edb.init as (jq: unknown) => void)(jq);
        }
      }
    }
  }, [item]);

  const { data: priceHistory } = useQuery({
    queryKey: ["item-price-history", itemId],
    queryFn: () => getItemPriceHistory(itemId, 30),
    enabled: activeTab === "chart",
  });

  const queryClient = useQueryClient();

  function toggleWatchlist() {
    if (inWatchlist) {
      removeFromWatchlist(itemId);
      setInWatchlist(false);
    } else {
      addToWatchlist(itemId);
      setInWatchlist(true);
    }
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    setRefreshMsg("");
    try {
      await refreshItem(itemId);
      await queryClient.invalidateQueries({ queryKey: ["item-prices", itemId] });
      await queryClient.invalidateQueries({ queryKey: ["item-stats", itemId] });
      setRefreshMsg("更新完了");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("429")) {
        // レスポンスからクールダウン残り時間を取得
        setRefreshMsg("クールダウン中（2分間隔）");
      } else {
        setRefreshMsg("更新に失敗しました");
      }
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setRefreshMsg(""), 5000);
    }
  }

  function toggleWorld(key: string) {
    setExpandedWorlds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const regionGroups = prices ? buildRegionGroups(prices) : [];
  const totalListings = prices?.length ?? 0;
  const globalMin =
    prices && prices.length > 0
      ? Math.min(...prices.map((p) => p.price_per_unit))
      : null;

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {item?.icon_url && (
            <img src={item.icon_url} alt="" className="h-12 w-12" />
          )}
          <div>
            <h1 className="text-2xl font-bold">
              {item?.lodestone_id ? (
                <a
                  href={`https://jp.finalfantasyxiv.com/lodestone/playguide/db/item/${item.lodestone_id}/`}
                  className="eorzeadb_link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {item.name_ja || item.name_en}
                </a>
              ) : (
                item?.name_ja || item?.name_en || `Item #${itemId}`
              )}
            </h1>
            <div className="flex gap-3 text-sm text-[var(--muted-foreground)]">
              {item?.name_en && <span>{item.name_en}</span>}
              {item?.category && (
                <span className="rounded bg-[var(--muted)] px-2 py-0.5">
                  {item.category}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-shrink-0 gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="rounded-lg bg-[var(--muted)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--border)] disabled:opacity-50"
          >
            {isRefreshing ? "更新中..." : "価格を更新"}
          </button>
          {refreshMsg && (
            <span className="self-center text-xs text-[var(--muted-foreground)]">
              {refreshMsg}
            </span>
          )}
          <button
            onClick={toggleWatchlist}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              inWatchlist
              ? "bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--destructive)] hover:text-white"
              : "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90"
            }`}
          >
            {inWatchlist ? "ウォッチリストから削除" : "ウォッチリストに追加"}
          </button>
        </div>
      </div>

      {/* タブ & フィルタ */}
      <div className="flex items-center justify-between border-b border-[var(--border)]">
        <div className="flex gap-1">
          {(
            [
              { key: "listings", label: `出品一覧 (${totalListings})` },
              { key: "history", label: "売買履歴" },
              { key: "chart", label: "価格推移" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-b-2 border-[var(--primary)] text-[var(--primary)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "listings" && (
          <div className="flex gap-1 pb-1">
            {[
              { label: "All", value: undefined },
              { label: "HQ", value: true },
              { label: "NQ", value: false },
            ].map((opt) => (
              <button
                key={String(opt.value)}
                onClick={() => setHqFilter(opt.value)}
                className={`rounded px-2.5 py-1 text-xs font-medium ${
                  hqFilter === opt.value
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 出品一覧 */}
      {activeTab === "listings" && (
        <>
          {pricesLoading && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-8 text-center">
              <p className="text-[var(--foreground)]">価格データを取得中...</p>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                初回はデータ取得に時間がかかることがあります
              </p>
            </div>
          )}

          {regionGroups.map((rg) => (
            <div key={rg.region} className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--muted-foreground)]">
                {rg.region}
                <span className="ml-2 text-xs font-normal">
                  最安 {formatGil(rg.min_price)}
                  {rg.min_world && (
                    <span className="ml-1 text-[var(--muted-foreground)]">
                      ({rg.min_world})
                    </span>
                  )}
                </span>
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {rg.dcs.map((dc) => {
                  const dcMin = dc.worlds[0]?.min_price ?? 0;
                  return (
                    <div
                      key={dc.data_center}
                      className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]"
                    >
                      {/* DC ヘッダー */}
                      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[var(--primary)]">
                            {dc.data_center}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span>
                            最安{" "}
                            <span
                              className={`font-mono font-bold ${
                                dcMin === globalMin
                                  ? "text-[var(--positive)]"
                                  : ""
                              }`}
                            >
                              {formatGil(dcMin)}
                            </span>
                          </span>
                          <span className="text-[var(--muted-foreground)]">
                            {dc.worlds.length}サーバー / {dc.total_listings}件
                          </span>
                        </div>
                      </div>

                      {/* ワールド別テーブル */}
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-[var(--muted-foreground)]">
                            <th className="px-3 py-1.5 text-left font-normal">
                              Server
                            </th>
                            <th className="px-3 py-1.5 text-right font-normal">
                              最安値
                            </th>
                            <th className="px-3 py-1.5 text-right font-normal">
                              数量
                            </th>
                            <th className="px-3 py-1.5 text-center font-normal">
                              HQ
                            </th>
                            <th className="px-3 py-1.5 text-right font-normal">
                              出品数
                            </th>
                            <th className="px-3 py-1.5 text-right font-normal">
                              更新
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {dc.worlds.map((world) => {
                            const worldKey = `${dc.data_center}:${world.world_name}`;
                            const isExpanded = expandedWorlds.has(worldKey);
                            return (
                              <>
                                <tr
                                  key={world.world_name}
                                  className={`border-t border-[var(--border)] transition-colors ${
                                    world.listing_count > 1
                                      ? "cursor-pointer hover:bg-[var(--muted)]"
                                      : ""
                                  }`}
                                  onClick={() =>
                                    world.listing_count > 1 &&
                                    toggleWorld(worldKey)
                                  }
                                >
                                  <td className="px-3 py-1.5">
                                    {world.listing_count > 1 && (
                                      <span className="mr-1 text-[var(--muted-foreground)]">
                                        {isExpanded ? "▼" : "▶"}
                                      </span>
                                    )}
                                    {world.world_name}
                                  </td>
                                  <td
                                    className={`px-3 py-1.5 text-right font-mono ${
                                      world.min_price === globalMin
                                        ? "font-bold text-[var(--positive)]"
                                        : ""
                                    }`}
                                  >
                                    {formatGil(world.min_price)}
                                  </td>
                                  <td className="px-3 py-1.5 text-right font-mono">
                                    {world.min_listing.quantity}
                                  </td>
                                  <td className="px-3 py-1.5 text-center">
                                    {world.min_listing.hq && (
                                      <span className="text-yellow-400">★</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-1.5 text-right font-mono text-[var(--muted-foreground)]">
                                    {world.listing_count}
                                  </td>
                                  <td className="px-3 py-1.5 text-right text-[var(--muted-foreground)]">
                                    {timeAgo(world.last_upload_at)}
                                  </td>
                                </tr>
                                {isExpanded &&
                                  world.all_listings.slice(0, 10).map((l, i) => (
                                    <tr
                                      key={`${world.world_name}-${i}`}
                                      className="border-t border-[var(--border)] bg-[var(--muted)]"
                                    >
                                      <td className="px-3 py-1 pl-8 text-[var(--muted-foreground)]">
                                        {l.retainer_name}
                                      </td>
                                      <td className="px-3 py-1 text-right font-mono">
                                        {formatGil(l.price_per_unit)}
                                      </td>
                                      <td className="px-3 py-1 text-right font-mono">
                                        {l.quantity}
                                      </td>
                                      <td className="px-3 py-1 text-center">
                                        {l.hq && (
                                          <span className="text-yellow-400">
                                            ★
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-3 py-1" colSpan={2}></td>
                                    </tr>
                                  ))}
                                {isExpanded &&
                                  world.all_listings.length > 10 && (
                                    <tr
                                      key={`${world.world_name}-more`}
                                      className="border-t border-[var(--border)] bg-[var(--muted)]"
                                    >
                                      <td
                                        colSpan={6}
                                        className="px-3 py-1 text-center text-[var(--muted-foreground)]"
                                      >
                                        他 {world.all_listings.length - 10} 件
                                      </td>
                                    </tr>
                                  )}
                              </>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {prices && prices.length === 0 && (
            <p className="py-8 text-center text-[var(--muted-foreground)]">
              出品データがありません
            </p>
          )}
        </>
      )}

      {/* 売買履歴 */}
      {activeTab === "history" && (
        <>
          {historyLoading && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-8 text-center">
              <p className="text-[var(--foreground)]">売買履歴を取得中...</p>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                初回は少し時間がかかります。
              </p>
            </div>
          )}
          {!historyLoading && history && history.length > 0 ? (() => {
            // DC別にグルーピング
            const dcMap = new Map<string, typeof history>();
            for (const sale of history) {
              const list = dcMap.get(sale.data_center) ?? [];
              list.push(sale);
              dcMap.set(sale.data_center, list);
            }
            const dcGroups = Array.from(dcMap.entries()).sort(
              ([a], [b]) => a.localeCompare(b)
            );

            return (
              <div className="grid gap-3 md:grid-cols-2">
                {dcGroups.map(([dc, sales]) => (
                  <div
                    key={dc}
                    className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]"
                  >
                    <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
                      <span className="font-bold text-[var(--primary)]">{dc}</span>
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {sales.length}件
                      </span>
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[var(--muted-foreground)]">
                          <th className="px-3 py-1.5 text-left font-normal">Server</th>
                          <th className="px-3 py-1.5 text-right font-normal">単価</th>
                          <th className="px-3 py-1.5 text-right font-normal">数量</th>
                          <th className="px-3 py-1.5 text-center font-normal">HQ</th>
                          <th className="px-3 py-1.5 text-right font-normal">日時</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sales.slice(0, 15).map((sale, i) => (
                          <tr
                            key={i}
                            className="border-t border-[var(--border)] hover:bg-[var(--muted)] transition-colors"
                          >
                            <td className="px-3 py-1">{sale.world_name}</td>
                            <td className="px-3 py-1 text-right font-mono">
                              {formatGil(sale.price_per_unit)}
                            </td>
                            <td className="px-3 py-1 text-right font-mono">
                              {sale.quantity}
                            </td>
                            <td className="px-3 py-1 text-center">
                              {sale.hq && <span className="text-yellow-400">★</span>}
                            </td>
                            <td className="px-3 py-1 text-right text-[var(--muted-foreground)]">
                              {new Date(sale.sold_at).toLocaleString("ja-JP", {
                                month: "numeric",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {sales.length > 15 && (
                      <div className="border-t border-[var(--border)] px-3 py-1.5 text-center text-xs text-[var(--muted-foreground)]">
                        他 {sales.length - 15} 件
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })() : !historyLoading ? (
            <p className="py-8 text-center text-[var(--muted-foreground)]">
              売買履歴がありません
            </p>
          ) : null}
        </>
      )}

      {/* 価格推移グラフ */}
      {activeTab === "chart" && (
        <PriceChart data={priceHistory ?? []} />
      )}
    </div>
  );
}
