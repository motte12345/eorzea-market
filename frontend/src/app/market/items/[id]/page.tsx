"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { use, useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  getItem,
  getItemPrices,
  getItemHistory,
  getItemPriceHistory,
  refreshItem,
  type PriceByWorld,
  type SaleRecord,
} from "@/lib/api";
import { PriceChart } from "@/components/price-chart";
import {
  addToWatchlist,
  isInWatchlist,
  removeFromWatchlist,
} from "@/lib/watchlist-store";
import { formatGil, timeAgo } from "@/lib/utils";
import { getSettings, saveSettings } from "@/lib/settings-store";

interface Props {
  params: Promise<{ id: string }>;
}

type Tab = "listings" | "history" | "chart";
type ListingSort = "price-asc" | "price-desc" | "server";

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

function sortWorlds(worlds: WorldSummary[], sort: ListingSort): WorldSummary[] {
  const sorted = [...worlds];
  switch (sort) {
    case "price-asc":
      return sorted.sort((a, b) => a.min_price - b.min_price);
    case "price-desc":
      return sorted.sort((a, b) => b.min_price - a.min_price);
    case "server":
      return sorted.sort((a, b) => a.world_name.localeCompare(b.world_name));
  }
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

const REGION_DC_ORDER: Record<string, string[]> = {};

interface HistoryWorldGroup {
  world_name: string;
  sales: SaleRecord[];
}

interface HistoryDCGroup {
  data_center: string;
  worlds: HistoryWorldGroup[];
  total: number;
}

function buildHistoryGroups(
  history: SaleRecord[],
  serverFilter: string
): { region: string; dcs: HistoryDCGroup[]; noData: boolean }[] {
  // サーバーフィルタがある場合、まず完全一致で絞り込み
  let filtered = history;
  let noData = false;

  if (serverFilter) {
    const exact = history.filter((s) => s.world_name === serverFilter);
    if (exact.length > 0) {
      filtered = exact;
    } else {
      // 該当サーバーの売買履歴がない → 全件表示（DCが不明なため）
      filtered = history;
      noData = true;
    }
  }

  const dcMap = new Map<string, Map<string, SaleRecord[]>>();
  for (const sale of filtered) {
    let worldMap = dcMap.get(sale.data_center);
    if (!worldMap) {
      worldMap = new Map();
      dcMap.set(sale.data_center, worldMap);
    }
    const list = worldMap.get(sale.world_name) ?? [];
    list.push(sale);
    worldMap.set(sale.world_name, list);
  }

  return Array.from(dcMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dc, worldMap]) => ({
      region: dc,
      dcs: [
        {
          data_center: dc,
          worlds: Array.from(worldMap.entries())
            .map(([name, sales]) => ({ world_name: name, sales }))
            .sort((a, b) => a.world_name.localeCompare(b.world_name)),
          total: Array.from(worldMap.values()).reduce((s, v) => s + v.length, 0),
        },
      ],
      noData,
    }));
}

function HistorySection({
  history,
  isLoading,
  serverFilter,
  onServerFilterChange,
}: {
  history: SaleRecord[];
  isLoading: boolean;
  serverFilter: string;
  onServerFilterChange: (s: string) => void;
}) {
  const [expandedWorlds, setExpandedWorlds] = useState<Set<string>>(new Set());

  function toggleWorld(key: string) {
    setExpandedWorlds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // サーバー一覧（フィルタ用 - 売買履歴のサーバー + URLパラメータのサーバー）
  const servers = useMemo(() => {
    const set = new Set(history.map((s) => s.world_name));
    if (serverFilter) set.add(serverFilter);
    return Array.from(set).sort();
  }, [history, serverFilter]);

  const groups = useMemo(
    () => buildHistoryGroups(history, serverFilter),
    [history, serverFilter]
  );

  if (isLoading) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-8 text-center">
        <p className="text-[var(--foreground)]">売買履歴を取得中...</p>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          初回は少し時間がかかります。
        </p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <p className="py-8 text-center text-[var(--muted-foreground)]">
        売買履歴がありません
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* サーバーフィルタ */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--muted-foreground)]">サーバー:</span>
        <select
          value={serverFilter}
          onChange={(e) => onServerFilterChange(e.target.value)}
          className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
        >
          <option value="">すべて</option>
          {servers.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {serverFilter && (
          <button
            onClick={() => onServerFilterChange("")}
            className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            クリア
          </button>
        )}
      </div>

      {groups.some((g) => g.noData) && serverFilter && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm text-[var(--muted-foreground)]">
          {serverFilter} の売買履歴はありません。同DC内の他サーバーの履歴を表示しています。
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {groups.map(({ dcs }) =>
          dcs.map((dc) => (
            <div
              key={dc.data_center}
              className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]"
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
                <span className="font-bold text-[var(--primary)]">
                  {dc.data_center}
                </span>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {dc.total}件
                </span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[var(--muted-foreground)]">
                    <th className="px-3 py-1.5 text-left font-normal">Server</th>
                    <th className="px-3 py-1.5 text-right font-normal">直近取引</th>
                    <th className="px-3 py-1.5 text-right font-normal">件数</th>
                  </tr>
                </thead>
                <tbody>
                  {dc.worlds.map((world) => {
                    const key = `h:${dc.data_center}:${world.world_name}`;
                    const isExpanded = expandedWorlds.has(key);
                    const latest = world.sales[0];
                    return (
                      <>
                        <tr
                          key={world.world_name}
                          className="border-t border-[var(--border)] cursor-pointer hover:bg-[var(--muted)] transition-colors"
                          onClick={() => toggleWorld(key)}
                        >
                          <td className="px-3 py-1.5">
                            <span className="mr-1 text-[var(--muted-foreground)]">
                              {isExpanded ? "▼" : "▶"}
                            </span>
                            {world.world_name}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono">
                            {latest && formatGil(latest.price_per_unit)}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-[var(--muted-foreground)]">
                            {world.sales.length}
                          </td>
                        </tr>
                        {isExpanded &&
                          world.sales.slice(0, 15).map((sale, i) => (
                            <tr
                              key={`${world.world_name}-${i}`}
                              className="border-t border-[var(--border)] bg-[var(--muted)]"
                            >
                              <td className="px-3 py-1 pl-8 text-right text-[var(--muted-foreground)]">
                                {new Date(sale.sold_at).toLocaleString("ja-JP", {
                                  month: "numeric",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </td>
                              <td className="px-3 py-1 text-right font-mono">
                                {formatGil(sale.price_per_unit)}
                              </td>
                              <td className="px-3 py-1 text-right font-mono">
                                ×{sale.quantity}
                                {sale.hq && (
                                  <span className="ml-1 text-yellow-400">★</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        {isExpanded && world.sales.length > 15 && (
                          <tr
                            key={`${world.world_name}-more`}
                            className="border-t border-[var(--border)] bg-[var(--muted)]"
                          >
                            <td
                              colSpan={3}
                              className="px-3 py-1 text-center text-[var(--muted-foreground)]"
                            >
                              他 {world.sales.length - 15} 件
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function ItemDetailPage({ params }: Props) {
  const { id } = use(params);
  const itemId = Number(id);
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "listings";
  const initialServer = searchParams.get("server") || "";
  const [hqFilter, setHqFilter] = useState<boolean | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [historyServer, setHistoryServer] = useState(initialServer);
  const [listingSort, setListingSort] = useState<ListingSort>("price-asc");

  // 設定から初期値を読み込み
  useEffect(() => {
    const s = getSettings();
    setListingSort(s.listingSort as ListingSort);
    if (s.hqFilter === "true") setHqFilter(true);
    else if (s.hqFilter === "false") setHqFilter(false);
  }, []);

  function handleSortChange(sort: ListingSort) {
    setListingSort(sort);
    saveSettings({ listingSort: sort });
  }

  function handleHqChange(val: boolean | undefined) {
    setHqFilter(val);
    saveSettings({ hqFilter: val === undefined ? "all" : String(val) });
  }
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

  // 公式ツールチップ: overflow:hidden を監視して visible に修正
  useEffect(() => {
    const fixTooltip = () => {
      const el = document.getElementById("eorzeadb_tooltip");
      if (el) {
        el.style.overflow = "visible";
        el.style.zIndex = "99999";
      }
    };

    // MutationObserver でスタイル変更を監視
    const observer = new MutationObserver(fixTooltip);
    const tryObserve = () => {
      const el = document.getElementById("eorzeadb_tooltip");
      if (el) {
        observer.observe(el, { attributes: true, attributeFilter: ["style"] });
        fixTooltip();
      } else {
        setTimeout(tryObserve, 500);
      }
    };
    tryObserve();

    return () => observer.disconnect();
  }, []);

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
          <div className="flex items-center gap-3 pb-1">
            <div className="flex gap-1">
              {[
                { label: "All", value: undefined },
                { label: "HQ", value: true },
                { label: "NQ", value: false },
              ].map((opt) => (
                <button
                  key={String(opt.value)}
                  onClick={() => handleHqChange(opt.value)}
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
            <select
              value={listingSort}
              onChange={(e) => handleSortChange(e.target.value as ListingSort)}
              className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
            >
              <option value="price-asc">安い順</option>
              <option value="price-desc">高い順</option>
              <option value="server">サーバー名順</option>
            </select>
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
                          {sortWorlds(dc.worlds, listingSort).map((world) => {
                            const worldKey = `${dc.data_center}:${world.world_name}`;
                            const dcMaxPrice = Math.max(
                              ...dc.worlds.map((w) => w.min_price)
                            );
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
                                        ? "font-bold text-[var(--positive)] underline"
                                        : world.min_price === dcMin
                                          ? "text-[var(--positive)]"
                                          : world.min_price === dcMaxPrice && dcMin !== dcMaxPrice
                                            ? "text-[var(--destructive)]"
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
        <HistorySection
          history={history ?? []}
          isLoading={historyLoading}
          serverFilter={historyServer}
          onServerFilterChange={setHistoryServer}
        />
      )}

      {/* 価格推移グラフ */}
      {activeTab === "chart" && (
        <PriceChart data={priceHistory ?? []} />
      )}
    </div>
  );
}
