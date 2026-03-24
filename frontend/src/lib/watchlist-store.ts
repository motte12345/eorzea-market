/**
 * ウォッチリストをローカルストレージで管理
 */

const STORAGE_KEY = "eorzea-market-watchlist";

export function getWatchlist(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToWatchlist(itemId: number): number[] {
  const current = getWatchlist();
  if (current.includes(itemId)) return current;
  const updated = [...current, itemId];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function removeFromWatchlist(itemId: number): number[] {
  const updated = getWatchlist().filter((id) => id !== itemId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function isInWatchlist(itemId: number): boolean {
  return getWatchlist().includes(itemId);
}
