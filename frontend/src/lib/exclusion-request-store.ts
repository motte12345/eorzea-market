/**
 * 同一ブラウザから同じアイテムへの除外申請を防ぐためのローカルストレージ
 */

const STORAGE_KEY = "eorzea-market-exclusion-requested";

export function getRequestedExclusions(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function markExclusionRequested(itemId: number): number[] {
  const current = getRequestedExclusions();
  if (current.includes(itemId)) return current;
  const updated = [...current, itemId];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function hasRequestedExclusion(itemId: number): boolean {
  return getRequestedExclusions().includes(itemId);
}
