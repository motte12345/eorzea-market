/**
 * ユーザー設定をローカルストレージで管理
 */

const STORAGE_KEY = "eorzea-market-settings";

export interface UserSettings {
  // ウォッチリスト: 差益計算に含めるリージョン
  arbRegions: string[];
  // ウォッチリスト: 税率インデックス
  taxIndex: number;
  // 出品一覧: ソート順
  listingSort: string;
  // 出品一覧: HQフィルタ
  hqFilter: string; // "all" | "true" | "false"
}

const DEFAULT_SETTINGS: UserSettings = {
  arbRegions: ["Japan", "North-America", "Europe", "Oceania"],
  taxIndex: 0,
  listingSort: "price-asc",
  hqFilter: "all",
};

export function getSettings(): UserSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(partial: Partial<UserSettings>): UserSettings {
  const current = getSettings();
  const updated = { ...current, ...partial };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}
