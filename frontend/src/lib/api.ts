const API_BASE = "/api";

export interface ItemSearchResult {
  id: number;
  name_ja: string;
  name_en: string;
  icon_url: string;
  category: string;
}

export interface ItemDetail {
  id: number;
  name_ja: string;
  name_en: string;
  icon_url: string;
  category: string;
  lodestone_id: string | null;
}

export interface PriceByWorld {
  world_id: number;
  world_name: string;
  data_center: string;
  region: string;
  price_per_unit: number;
  quantity: number;
  hq: boolean;
  retainer_name: string;
  fetched_at: string;
  last_upload_at: string | null;
}

export interface DCStats {
  data_center: string;
  region: string;
  min_price: number;
  avg_price: number;
  max_price: number;
  listing_count: number;
  total_quantity: number;
}

export interface SaleRecord {
  price_per_unit: number;
  quantity: number;
  hq: boolean;
  sold_at: string;
  world_name: string;
  data_center: string;
}

export interface WatchlistPriceEntry {
  region: string;
  data_center: string;
  world_name: string;
  min_price: number;
}

export interface PriceHistoryEntry {
  date: string;
  min_price: number;
  avg_price: number;
  max_price: number;
  volume: number;
  hq: boolean;
  data_center: string;
}

export interface WatchlistItem {
  item_id: number;
  name_ja: string;
  name_en: string;
  icon_url: string;
  prices_by_dc: WatchlistPriceEntry[];
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, options);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function searchItems(query: string): Promise<ItemSearchResult[]> {
  return fetchJson(`/items/search?q=${encodeURIComponent(query)}`);
}

export async function getItem(itemId: number): Promise<ItemDetail> {
  return fetchJson(`/items/${itemId}`);
}

export async function getItemPrices(
  itemId: number,
  hq?: boolean
): Promise<PriceByWorld[]> {
  const params = new URLSearchParams();
  if (hq !== undefined) params.set("hq", String(hq));
  const qs = params.toString();
  return fetchJson(`/items/${itemId}/prices${qs ? `?${qs}` : ""}`);
}

export async function getItemStats(itemId: number): Promise<DCStats[]> {
  return fetchJson(`/items/${itemId}/stats`);
}

export async function getItemHistory(
  itemId: number,
  limit = 50
): Promise<SaleRecord[]> {
  return fetchJson(`/items/${itemId}/history?limit=${limit}`);
}

export async function getItemPriceHistory(
  itemId: number,
  days = 30
): Promise<PriceHistoryEntry[]> {
  return fetchJson(`/items/${itemId}/price-history?days=${days}`);
}

export interface RankingItem {
  item_id: number;
  name_ja: string;
  name_en: string;
  icon_url: string;
  min_price?: number;
  listing_count?: number;
  min_dc?: string;
  min_world?: string;
  buy_price?: number;
  buy_info?: string;
  sell_price?: number;
  sell_info?: string;
  profit?: number;
  profit_rate?: number;
}

export async function getExpensiveItems(limit = 5): Promise<RankingItem[]> {
  return fetchJson(`/ranking/expensive?limit=${limit}`);
}

export async function getArbitrageItems(limit = 20): Promise<RankingItem[]> {
  return fetchJson(`/ranking/arbitrage?limit=${limit}`);
}

export async function getArbitrageProfitItems(limit = 20): Promise<RankingItem[]> {
  return fetchJson(`/ranking/arbitrage-profit?limit=${limit}`);
}

export async function refreshItem(itemId: number): Promise<void> {
  await fetchJson(`/refresh/${itemId}`, { method: "POST" });
}

export async function getWatchlistPrices(
  itemIds: number[]
): Promise<WatchlistItem[]> {
  return fetchJson("/watchlist/prices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(itemIds),
  });
}

export interface ExclusionRequestResponse {
  status: "requested" | "already_excluded";
  item_id: number;
  request_count?: number;
}

export async function requestExclusion(
  itemId: number
): Promise<ExclusionRequestResponse> {
  return fetchJson(`/exclusion-requests/${itemId}`, { method: "POST" });
}
