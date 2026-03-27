"use client";

import { createContext, useContext } from "react";

export type Locale = "ja" | "en";

const COOKIE_NAME = "locale";

export function getLocale(): Locale {
  if (typeof document === "undefined") return "ja";
  const match = document.cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return (match?.[1] === "en" ? "en" : "ja") as Locale;
}

export function setLocale(locale: Locale): void {
  document.cookie = `${COOKIE_NAME}=${locale};path=/;max-age=${365 * 24 * 60 * 60}`;
}

const translations = {
  // Navigation
  home: { ja: "ホーム", en: "Home" },
  market: { ja: "マーケット", en: "Market" },
  categories: { ja: "カテゴリ", en: "Categories" },
  releaseNotes: { ja: "リリースノート", en: "Release Notes" },
  searchResults: { ja: "検索結果", en: "Search Results" },
  excludedItems: { ja: "除外アイテム", en: "Excluded Items" },

  // Section headers
  watchlist: { ja: "ウォッチリスト", en: "Watchlist" },
  ranking: { ja: "ランキング", en: "Rankings" },
  categoryList: { ja: "カテゴリ一覧", en: "Categories" },
  otherCategories: { ja: "その他のカテゴリ", en: "Other Categories" },
  excludedItemsTitle: { ja: "ランキング除外アイテム", en: "Excluded from Rankings" },

  // Table headers
  item: { ja: "アイテム", en: "Item" },
  category: { ja: "カテゴリ", en: "Category" },
  lowestPrice: { ja: "最安値", en: "Lowest" },
  profit: { ja: "差益", en: "Profit" },
  quantity: { ja: "数量", en: "Qty" },
  listingCount: { ja: "出品数", en: "Listings" },
  updated: { ja: "更新", en: "Updated" },
  latestTrade: { ja: "直近取引", en: "Latest" },
  count: { ja: "件数", en: "Count" },

  // Sort options
  sortName: { ja: "名前順", en: "Name" },
  sortPriceAsc: { ja: "安い順", en: "Price ↑" },
  sortPriceDesc: { ja: "高い順", en: "Price ↓" },
  sortIdDesc: { ja: "ID（新しい順）", en: "ID (Newest)" },
  sortIdAsc: { ja: "ID（古い順）", en: "ID (Oldest)" },
  sortServer: { ja: "サーバー名順", en: "Server" },

  // Status messages
  loading: { ja: "読み込み中...", en: "Loading..." },
  searching: { ja: "検索中...", en: "Searching..." },
  fetchingData: { ja: "データ取得中...", en: "Loading data..." },
  fetchingPrices: { ja: "価格データを取得中...", en: "Fetching prices..." },
  fetchingHistory: { ja: "売買履歴を取得中...", en: "Fetching history..." },
  firstLoadSlow: { ja: "初回はデータ取得に時間がかかることがあります", en: "First load may take a moment" },
  firstLoadSlowShort: { ja: "初回は少し時間がかかります。", en: "First load may take a moment." },
  noListings: { ja: "出品データがありません", en: "No listings" },
  noHistory: { ja: "売買履歴がありません", en: "No trade history" },
  noPriceHistory: { ja: "価格推移データがありません", en: "No price history" },
  noResults: { ja: "該当するアイテムが見つかりませんでした", en: "No items found" },

  // Watchlist
  emptyWatchlist: { ja: "ウォッチリストにアイテムがありません", en: "Your watchlist is empty" },
  emptyWatchlistHint: { ja: "上の検索バーからアイテムを探して追加してください", en: "Search for items above to add them" },
  profitCompare: { ja: "差益比較:", en: "Compare:" },
  addToWatchlist: { ja: "ウォッチリストに追加", en: "Add to Watchlist" },
  removeFromWatchlist: { ja: "ウォッチリストから削除", en: "Remove from Watchlist" },

  // Rankings
  expensiveItems: { ja: "高額アイテム", en: "Most Expensive" },
  arbitrageRanking: { ja: "JP ↔ NA 価格差ランキング", en: "JP ↔ NA Price Gap Ranking" },
  profitRateSort: { ja: "利益率順", en: "By Rate" },
  profitAmountSort: { ja: "差額順", en: "By Amount" },
  excludedItemsLink: { ja: "除外アイテム一覧", en: "Excluded items" },
  collapse: { ja: "折りたたむ", en: "Collapse" },

  // Item detail
  updatePrice: { ja: "価格を更新", en: "Refresh Price" },
  updating: { ja: "更新中...", en: "Updating..." },
  updateComplete: { ja: "更新完了", en: "Updated" },
  updateCooldown: { ja: "クールダウン中（2分間隔）", en: "Cooldown (2 min)" },
  updateFailed: { ja: "更新に失敗しました", en: "Update failed" },
  listingsTab: { ja: "出品一覧", en: "Listings" },
  historyTab: { ja: "売買履歴", en: "Trade History" },
  chartTab: { ja: "価格推移", en: "Price Chart" },
  lowest: { ja: "最安", en: "Min" },
  average: { ja: "平均", en: "Avg" },
  highest: { ja: "最高", en: "Max" },
  delete: { ja: "削除", en: "Delete" },

  // History
  server: { ja: "サーバー:", en: "Server:" },
  all: { ja: "すべて", en: "All" },
  clear: { ja: "クリア", en: "Clear" },

  // Pagination
  prev: { ja: "前へ", en: "Prev" },
  next: { ja: "次へ", en: "Next" },

  // Tax
  taxRate: { ja: "税率:", en: "Tax:" },

  // Search
  searchPlaceholder: { ja: "アイテム検索...", en: "Search items..." },
  searchInputPlaceholder: { ja: "アイテム名を入力...", en: "Enter item name..." },

  // Portal
  toolDescription: {
    ja: "全サーバーのマーケットボード価格をリアルタイム比較。DC間の転売差益を確認。",
    en: "Compare market board prices across all servers in real-time. Find cross-DC arbitrage opportunities.",
  },

  // Category groups
  mainSubArms: { ja: "メインアーム/サブアーム", en: "Weapons" },
  battleJobs: { ja: "バトルジョブ", en: "Battle Jobs" },
  crafters: { ja: "クラフター", en: "Crafters" },
  gatherers: { ja: "ギャザラー", en: "Gatherers" },
  armorAccessories: { ja: "防具/アクセサリ", en: "Armor & Accessories" },
  other: { ja: "その他", en: "Other" },
  housing: { ja: "ハウジング", en: "Housing" },

  // Footer
  copyright: {
    ja: "記載されている会社名・製品名・システム名などは、各社の商標、または登録商標です。",
    en: "Company names, product names, and system names mentioned are trademarks or registered trademarks of their respective owners.",
  },
} as const;

type TranslationKey = keyof typeof translations;

export const LocaleContext = createContext<Locale>("ja");

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useTranslation() {
  const locale = useLocale();
  return {
    locale,
    t: (key: TranslationKey) => translations[key][locale],
    name: (nameJa: string, nameEn: string) =>
      locale === "en" && nameEn ? nameEn : nameJa || nameEn,
  };
}

// Tax labels need parameters, handle separately
export function taxLabel(buyRate: number, sellRate: number, locale: Locale): string {
  const bp = Math.round(buyRate * 100);
  const sp = Math.round(sellRate * 100);
  return locale === "ja"
    ? `購入${bp}% / 売却${sp}%`
    : `Buy ${bp}% / Sell ${sp}%`;
}

// Dynamic text helpers
export function itemCount(n: number, locale: Locale): string {
  return locale === "ja" ? `${n}件` : `${n} items`;
}

export function itemCountSuffix(n: number, locale: Locale): string {
  return locale === "ja" ? `${n} アイテム` : `${n} items`;
}

export function showMoreText(n: number, locale: Locale): string {
  return locale === "ja" ? `他 ${n} 件を表示` : `Show ${n} more`;
}

export function moreItemsText(n: number, locale: Locale): string {
  return locale === "ja" ? `他 ${n} 件` : `${n} more`;
}

export function top200Text(locale: Locale): string {
  return locale === "ja" ? "（上位200件を表示）" : "(showing top 200)";
}

export function searchResultsText(term: string, total: number, locale: Locale): string {
  return locale === "ja" ? `「${term}」${total}件` : `"${term}" — ${total} results`;
}

export function serverListingText(servers: number, listings: number, locale: Locale): string {
  return locale === "ja"
    ? `${servers}サーバー / ${listings}件`
    : `${servers} servers / ${listings} listings`;
}

export function noHistoryForServer(server: string, locale: Locale): string {
  return locale === "ja"
    ? `${server} の売買履歴はありません。同DC内の他サーバーの履歴を表示しています。`
    : `No history for ${server}. Showing other servers in the same DC.`;
}
